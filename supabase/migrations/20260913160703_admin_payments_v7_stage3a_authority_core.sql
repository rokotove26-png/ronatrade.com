-- Admin Payments V7 Stage 3C/3C.1 generic authority persistence.
-- Branch migration only. PRODUCTION_DDL remains HOLD.
-- This migration is intentionally designed for a fresh application; it has not been applied in production.

create schema if not exists portal_private;
create extension if not exists pgcrypto;

create or replace function portal_private.admin_payments_v7_valid_currency(value text)
returns boolean
language sql
immutable
as $$
  select value is not null and btrim(value) ~ '^[A-Z]{3}$';
$$;

-- Payment attribution is a sealed aggregate: header + complete line snapshot are committed in one row.
-- The compatibility child relation below is a read-only view over that immutable snapshot.
create table portal_private.payment_business_attributions_v7 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id),
  classification text not null,
  attribution_mode text not null check (attribution_mode in ('EXACT','SCOPE_ONLY','NO_DEAL_BINDING')),
  decision_type text null check (decision_type is null or decision_type in ('BIND_TO_DEAL','ASSIGN_ADVANCE_PAYMENT')),
  authority_kind text not null,
  authority_source_ref text null,
  business_scope_refs text[] not null default '{}',
  scope_deal_keys uuid[] not null default '{}',
  lines_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(lines_snapshot) = 'array'),
  principal_payment_key uuid null references portal_private.payments(id),
  materialization_status text not null default 'NOT_MATERIALIZED',
  authority_state text not null default 'AUTHORITATIVE',
  lifecycle_state text not null default 'CURRENT',
  effective_at timestamptz not null,
  supersedes_id uuid null references portal_private.payment_business_attributions_v7(id),
  supersedes_authority_refs jsonb not null default '[]'::jsonb,
  source_version text null,
  source_timestamp timestamptz null,
  source_refs jsonb not null default '[]'::jsonb,
  source_locked boolean not null default true check (source_locked),
  actor_id text null,
  actor_role text null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (payment_key, idempotency_key),
  check (
    (attribution_mode = 'EXACT' and jsonb_array_length(lines_snapshot) > 0 and cardinality(scope_deal_keys) > 0)
    or (attribution_mode = 'SCOPE_ONLY' and jsonb_array_length(lines_snapshot) = 0 and cardinality(scope_deal_keys) > 0)
    or (attribution_mode = 'NO_DEAL_BINDING' and jsonb_array_length(lines_snapshot) = 0 and cardinality(scope_deal_keys) = 0)
  ),
  -- Stage 3C.1 semantic invariant. Owner decisions have exactly one legal persistence mode.
  -- Source/system authorities may be exact, or may preserve only a known business scope for
  -- the explicitly non-exact business classes below. NO_DEAL_BINDING is reserved for RONA ADVANCE.
  check (
    case
      when decision_type = 'BIND_TO_DEAL' then
        attribution_mode = 'EXACT'
        and classification in ('RESOLVED','KNOWN_MULTI_DEAL_EXACT_SPLIT')
      when decision_type = 'ASSIGN_ADVANCE_PAYMENT' then
        attribution_mode = 'NO_DEAL_BINDING'
        and classification = 'RONA_ADVANCE_DEAL_SPEND'
      when decision_type is null then
        attribution_mode = 'EXACT'
        or (
          attribution_mode = 'SCOPE_ONLY'
          and classification in ('SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY','ASSOCIATED_BANK_FEE','OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED')
        )
      else false
    end
  )
);

create index payment_business_attributions_v7_payment_idx
  on portal_private.payment_business_attributions_v7(payment_key, lifecycle_state, effective_at);

create or replace function portal_private.validate_payment_business_attribution_v7()
returns trigger
language plpgsql
as $$
declare
  payment_amount numeric;
  payment_currency text;
  scope_count integer;
  scope_distinct integer;
  existing_scope_count integer;
  line_count integer;
  line_distinct integer;
  existing_line_count integer;
  line_sum numeric;
begin
  select p.amount::numeric, upper(btrim(p.currency::text))
    into payment_amount, payment_currency
  from portal_private.payments p
  where p.id = new.payment_key;

  if not found then
    raise exception 'PAYMENT_AUTHORITY_PAYMENT_NOT_FOUND';
  end if;
  if payment_amount is null or payment_amount <= 0 then
    raise exception 'PAYMENT_AUTHORITY_PAYMENT_AMOUNT_INVALID';
  end if;
  if not portal_private.admin_payments_v7_valid_currency(payment_currency) then
    raise exception 'PAYMENT_AUTHORITY_PAYMENT_CURRENCY_INVALID';
  end if;

  select count(*), count(distinct scope.deal_key)
    into scope_count, scope_distinct
  from unnest(new.scope_deal_keys) as scope(deal_key);

  if scope_count <> scope_distinct then
    raise exception 'PAYMENT_AUTHORITY_DUPLICATE_SCOPE_DEAL';
  end if;

  select count(*) into existing_scope_count
  from portal_private.deals d
  where d.id = any(new.scope_deal_keys);

  if existing_scope_count <> scope_count then
    raise exception 'PAYMENT_AUTHORITY_SCOPE_DEAL_INVALID';
  end if;

  if new.attribution_mode = 'EXACT' then
    if exists (
      select 1
      from jsonb_array_elements(new.lines_snapshot) item
      where jsonb_typeof(item) <> 'object'
         or item->>'deal_key' is null
         or item->>'amount' is null
         or item->>'currency' is null
         or coalesce(item->>'amount_status','EXACT') <> 'EXACT'
         or (item->>'amount')::numeric <= 0
         or not portal_private.admin_payments_v7_valid_currency(upper(btrim(item->>'currency')))
         or upper(btrim(item->>'currency')) <> payment_currency
    ) then
      raise exception 'PAYMENT_AUTHORITY_EXACT_LINE_INVALID';
    end if;

    select count(*),
           count(distinct (item->>'deal_key')::uuid),
           coalesce(sum((item->>'amount')::numeric),0)
      into line_count, line_distinct, line_sum
    from jsonb_array_elements(new.lines_snapshot) item;

    if line_count = 0 or line_count <> line_distinct then
      raise exception 'PAYMENT_AUTHORITY_DUPLICATE_EXACT_DEAL';
    end if;

    select count(*) into existing_line_count
    from portal_private.deals d
    where d.id in (
      select distinct (item->>'deal_key')::uuid
      from jsonb_array_elements(new.lines_snapshot) item
    );

    if existing_line_count <> line_distinct then
      raise exception 'PAYMENT_AUTHORITY_EXACT_DEAL_INVALID';
    end if;

    if line_sum <> payment_amount then
      raise exception 'PAYMENT_AUTHORITY_EXACT_COVERAGE_MISMATCH';
    end if;

    if scope_count <> line_distinct
       or exists (
         select 1 from unnest(new.scope_deal_keys) as scope(deal_key)
         where not exists (
           select 1 from jsonb_array_elements(new.lines_snapshot) item
           where (item->>'deal_key')::uuid = scope.deal_key
         )
       )
       or exists (
         select 1 from jsonb_array_elements(new.lines_snapshot) item
         where not ((item->>'deal_key')::uuid = any(new.scope_deal_keys))
       ) then
      raise exception 'PAYMENT_AUTHORITY_SCOPE_LINES_MISMATCH';
    end if;

  elsif new.attribution_mode = 'SCOPE_ONLY' then
    if jsonb_array_length(new.lines_snapshot) <> 0 or scope_count = 0 then
      raise exception 'PAYMENT_AUTHORITY_SCOPE_ONLY_INVALID';
    end if;

  elsif new.attribution_mode = 'NO_DEAL_BINDING' then
    if jsonb_array_length(new.lines_snapshot) <> 0 or scope_count <> 0 then
      raise exception 'PAYMENT_AUTHORITY_NO_DEAL_BINDING_INVALID';
    end if;
  else
    raise exception 'PAYMENT_AUTHORITY_MODE_INVALID';
  end if;

  return new;
end;
$$;

create trigger payment_business_attributions_v7_validate
before insert on portal_private.payment_business_attributions_v7
for each row execute function portal_private.validate_payment_business_attribution_v7();

create view portal_private.payment_business_attribution_lines_v7 as
select
  (a.id::text || ':' || line.ordinality::text) as id,
  a.id as attribution_id,
  (line.item->>'deal_key')::uuid as deal_key,
  (line.item->>'amount')::numeric as amount,
  upper(btrim(line.item->>'currency'))::char(3) as currency,
  'EXACT'::text as amount_status,
  coalesce(line.item->'source_refs', a.source_refs, '[]'::jsonb) as source_refs,
  a.created_at
from portal_private.payment_business_attributions_v7 a
cross join lateral jsonb_array_elements(a.lines_snapshot) with ordinality as line(item, ordinality)
where a.attribution_mode = 'EXACT';

create or replace function portal_private.reject_v7_authority_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'V7 authority records are immutable; append a superseding authority instead';
end;
$$;

create trigger payment_business_attributions_v7_immutable
before update or delete on portal_private.payment_business_attributions_v7
for each row execute function portal_private.reject_v7_authority_mutation();

create trigger payment_business_attribution_lines_v7_read_only
instead of insert or update or delete on portal_private.payment_business_attribution_lines_v7
for each row execute function portal_private.reject_v7_authority_mutation();

-- Owner request/action audit is immutable and separate from the authority aggregate. The authority
-- is business truth; this table preserves the request, optimistic-lock expectation and action audit.
create table portal_private.owner_payment_decision_audit_v7 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id),
  resulting_authority_id uuid not null references portal_private.payment_business_attributions_v7(id),
  event_type text not null check (event_type = 'OWNER_PAYMENT_DECISION'),
  action text not null check (action in ('BIND_TO_DEAL','ASSIGN_ADVANCE_PAYMENT')),
  actor_id text not null,
  actor_role text not null check (actor_role in ('OWNER','ADMIN')),
  expected_current_authority_id uuid null,
  expected_current_authority_ref jsonb null,
  effective_at timestamptz not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  request_snapshot jsonb not null check (jsonb_typeof(request_snapshot) = 'object'),
  previous_authority_snapshot jsonb null,
  current_reconciliation_snapshot jsonb null,
  resulting_authority_snapshot jsonb not null check (jsonb_typeof(resulting_authority_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (payment_key, idempotency_key),
  unique (resulting_authority_id)
);

create trigger owner_payment_decision_audit_v7_immutable
before update or delete on portal_private.owner_payment_decision_audit_v7
for each row execute function portal_private.reject_v7_authority_mutation();

-- Atomic Owner decision persistence. One DB function call owns serialization, optimistic lock,
-- idempotency, sealed authority insert and immutable request/action audit insert. It never updates
-- a previous authority; correction is append + supersession only.
create or replace function portal_private.persist_owner_payment_decision_v7(
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

-- Finance authority is a complete normalized record. DB integrity and runtime integrity both fail closed.
create table portal_private.deal_finance_authority_v7 (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id),
  total_to_receive numeric(24,8) not null,
  due_now numeric(24,8) not null,
  expected_not_due numeric(24,8) not null,
  future_conditional numeric(24,8) not null,
  obligation_currency char(3) not null,
  contractual_payment_currency char(3) null,
  mixed_inbound_accounting_currency char(3) null,
  finance_status text not null,
  documentary_status text not null,
  authority_state text not null default 'AUTHORITATIVE',
  lifecycle_state text not null default 'CURRENT',
  effective_at timestamptz not null,
  supersedes_id uuid null references portal_private.deal_finance_authority_v7(id),
  supersedes_authority_refs jsonb not null default '[]'::jsonb,
  source_version text null,
  source_timestamp timestamptz null,
  source_refs jsonb not null default '[]'::jsonb,
  source_locked boolean not null default true check (source_locked),
  created_at timestamptz not null default now(),
  check (total_to_receive >= 0),
  check (due_now >= 0),
  check (expected_not_due >= 0),
  check (future_conditional >= 0),
  check (due_now <= total_to_receive),
  check (expected_not_due <= total_to_receive),
  check (future_conditional <= total_to_receive),
  check (due_now + expected_not_due + future_conditional <= total_to_receive),
  check (portal_private.admin_payments_v7_valid_currency(obligation_currency::text)),
  check (contractual_payment_currency is null or portal_private.admin_payments_v7_valid_currency(contractual_payment_currency::text)),
  check (mixed_inbound_accounting_currency is null or portal_private.admin_payments_v7_valid_currency(mixed_inbound_accounting_currency::text))
);

create index deal_finance_authority_v7_deal_idx
  on portal_private.deal_finance_authority_v7(deal_key, lifecycle_state, effective_at);

create trigger deal_finance_authority_v7_immutable
before update or delete on portal_private.deal_finance_authority_v7
for each row execute function portal_private.reject_v7_authority_mutation();