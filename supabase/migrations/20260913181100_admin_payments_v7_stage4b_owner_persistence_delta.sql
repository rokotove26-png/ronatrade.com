-- Admin Payments V7 Stage 4B — production Owner-persistence delta preparation.
-- PREPARATION ONLY. Do not apply without separate Owner authorization.
-- Production already contains the split V7 substrate through 20260913161909.
-- This migration intentionally creates only the missing persistence primitive and hardens its privileges.

create function portal_private.persist_owner_payment_decision_v7(
  p_expected_current_authority_id uuid,
  p_authority jsonb,
  p_audit jsonb
)
returns portal_private.payment_business_attributions_v7
language plpgsql
security invoker
as $$
declare
  v_payment_key uuid;
  v_idempotency_key text;
  v_current_ids uuid[];
  v_current_id uuid;
  v_existing portal_private.payment_business_attributions_v7%rowtype;
  v_existing_request jsonb;
  v_existing_action text;
  v_existing_actor_id text;
  v_existing_actor_role text;
  v_inserted portal_private.payment_business_attributions_v7%rowtype;
  v_audit_id uuid;
  v_scope_deal_keys uuid[];
  v_business_scope_refs text[];
begin
  if p_authority is null or jsonb_typeof(p_authority) <> 'object'
     or p_audit is null or jsonb_typeof(p_audit) <> 'object' then
    raise exception 'OWNER_DECISION_PERSISTENCE_ENVELOPE_REQUIRED';
  end if;

  if coalesce(p_authority->>'decision_type','') not in ('BIND_TO_DEAL','ASSIGN_ADVANCE_PAYMENT') then
    raise exception 'OWNER_DECISION_TYPE_INVALID';
  end if;

  v_payment_key := (p_authority->>'payment_key')::uuid;
  v_idempotency_key := nullif(btrim(p_authority->>'idempotency_key'),'');
  if v_payment_key is null or v_idempotency_key is null then
    raise exception 'OWNER_DECISION_IDENTITY_REQUIRED';
  end if;

  -- A per-payment transaction-scoped lock makes current-authority and idempotency checks serial.
  perform pg_advisory_xact_lock(hashtextextended(v_payment_key::text, 0));

  -- Idempotent replay is checked before optimistic state because the original successful decision
  -- is now the current leaf. Same key + same audited request returns the original authority.
  select * into v_existing
  from portal_private.payment_business_attributions_v7 a
  where a.payment_key = v_payment_key
    and a.idempotency_key = v_idempotency_key;

  if found then
    select request_snapshot, action, actor_id, actor_role
      into v_existing_request, v_existing_action, v_existing_actor_id, v_existing_actor_role
    from portal_private.owner_payment_decision_audit_v7
    where resulting_authority_id = v_existing.id;

    if not found
       or v_existing_request is distinct from p_audit->'request_snapshot'
       or v_existing_action is distinct from p_audit->>'action'
       or v_existing_actor_id is distinct from p_audit->>'actor_id'
       or v_existing_actor_role is distinct from upper(p_audit->>'actor_role') then
      raise exception 'OWNER_DECISION_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing;
  end if;

  select array_agg(current_leaf.id order by current_leaf.effective_at desc, current_leaf.created_at desc, current_leaf.id)
    into v_current_ids
  from (
    select a.id, a.effective_at, a.created_at
    from portal_private.payment_business_attributions_v7 a
    where a.payment_key = v_payment_key
      and upper(a.authority_state) not in ('REJECTED','REVERSED','INVALID','INACTIVE','SUPERSEDED')
      and upper(a.lifecycle_state) not in ('SUPERSEDED','REVERSED','REJECTED','CANCELLED','INACTIVE','ARCHIVED')
      and not exists (
        select 1
        from portal_private.payment_business_attributions_v7 child
        where child.payment_key = a.payment_key
          and child.supersedes_id = a.id
          and upper(child.authority_state) not in ('REJECTED','REVERSED','INVALID','INACTIVE','SUPERSEDED')
          and upper(child.lifecycle_state) not in ('SUPERSEDED','REVERSED','REJECTED','CANCELLED','INACTIVE','ARCHIVED')
      )
  ) current_leaf;

  if coalesce(cardinality(v_current_ids),0) > 1 then
    raise exception 'OWNER_DECISION_CURRENT_AUTHORITY_CONFLICT';
  end if;
  v_current_id := case when coalesce(cardinality(v_current_ids),0) = 1 then v_current_ids[1] else null end;

  if v_current_id is distinct from p_expected_current_authority_id then
    raise exception 'STALE_OWNER_DECISION';
  end if;
  if nullif(p_authority->>'supersedes_id','')::uuid is distinct from p_expected_current_authority_id then
    raise exception 'OWNER_DECISION_SUPERSESSION_MISMATCH';
  end if;

  if p_audit->>'payment_key' is distinct from v_payment_key::text
     or p_audit->>'resulting_authority_id' is distinct from p_authority->>'id'
     or p_audit->>'action' is distinct from p_authority->>'decision_type'
     or p_audit->>'actor_id' is distinct from p_authority->>'actor_id'
     or upper(p_audit->>'actor_role') is distinct from upper(p_authority->>'actor_role')
     or p_audit->>'idempotency_key' is distinct from v_idempotency_key
     or p_audit->'request_snapshot' is null then
    raise exception 'OWNER_DECISION_AUDIT_MISMATCH';
  end if;

  if upper(p_authority->>'actor_role') not in ('OWNER','ADMIN') then
    raise exception 'OWNER_DECISION_ACTOR_ROLE_INVALID';
  end if;

  v_scope_deal_keys := array(
    select value::uuid
    from jsonb_array_elements_text(coalesce(p_authority->'scope_deal_keys','[]'::jsonb)) value
  );
  v_business_scope_refs := array(
    select value
    from jsonb_array_elements_text(coalesce(p_authority->'business_scope_refs','[]'::jsonb)) value
  );
  v_audit_id := coalesce(nullif(p_audit->>'id','')::uuid, gen_random_uuid());

  insert into portal_private.payment_business_attributions_v7(
    id,payment_key,classification,attribution_mode,decision_type,authority_kind,authority_source_ref,
    business_scope_refs,scope_deal_keys,lines_snapshot,principal_payment_key,materialization_status,
    authority_state,lifecycle_state,effective_at,supersedes_id,supersedes_authority_refs,
    source_version,source_timestamp,source_refs,source_locked,actor_id,actor_role,idempotency_key
  ) values (
    (p_authority->>'id')::uuid,
    v_payment_key,
    p_authority->>'classification',
    p_authority->>'attribution_mode',
    p_authority->>'decision_type',
    coalesce(nullif(p_authority->>'authority_kind',''),'OWNER'),
    nullif(p_authority->>'authority_source_ref',''),
    v_business_scope_refs,
    v_scope_deal_keys,
    coalesce(p_authority->'lines_snapshot','[]'::jsonb),
    nullif(p_authority->>'principal_payment_key','')::uuid,
    coalesce(nullif(p_authority->>'materialization_status',''),'NOT_MATERIALIZED'),
    coalesce(nullif(p_authority->>'authority_state',''),'AUTHORITATIVE'),
    coalesce(nullif(p_authority->>'lifecycle_state',''),'CURRENT'),
    (p_authority->>'effective_at')::timestamptz,
    p_expected_current_authority_id,
    coalesce(p_authority->'supersedes_authority_refs','[]'::jsonb),
    nullif(p_authority->>'source_version',''),
    nullif(p_authority->>'source_timestamp','')::timestamptz,
    coalesce(p_authority->'source_refs','[]'::jsonb),
    coalesce((p_authority->>'source_locked')::boolean,false),
    p_authority->>'actor_id',
    upper(p_authority->>'actor_role'),
    v_idempotency_key
  ) returning * into v_inserted;

  insert into portal_private.owner_payment_decision_audit_v7(
    id,payment_key,resulting_authority_id,event_type,action,actor_id,actor_role,
    expected_current_authority_id,expected_current_authority_ref,effective_at,idempotency_key,
    request_fingerprint,request_snapshot,previous_authority_snapshot,current_reconciliation_snapshot,
    resulting_authority_snapshot
  ) values (
    v_audit_id,
    v_payment_key,
    v_inserted.id,
    coalesce(nullif(p_audit->>'event_type',''),'OWNER_PAYMENT_DECISION'),
    p_audit->>'action',
    p_audit->>'actor_id',
    upper(p_audit->>'actor_role'),
    p_expected_current_authority_id,
    p_audit->'expected_current_authority_ref',
    coalesce(nullif(p_audit->>'effective_at','')::timestamptz,v_inserted.effective_at),
    v_idempotency_key,
    coalesce(nullif(p_audit->>'request_fingerprint',''),v_idempotency_key),
    p_audit->'request_snapshot',
    p_audit->'previous_authority_snapshot',
    p_audit->'current_reconciliation_snapshot',
    coalesce(p_audit->'resulting_authority_snapshot',p_authority)
  );

  return v_inserted;
end;
$$;

alter function portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)
  set search_path = pg_catalog, portal_private;

revoke execute on function portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)
  from public, anon, authenticated, service_role, rona_payments_v7_reader;
