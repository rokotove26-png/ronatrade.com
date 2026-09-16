-- PR548 independent review R3/R4/R5/R6. Candidate only: no activation/backfill here.
-- No bank, Payments, Finance or Deal values are modified by this migration.

-- Structural uniqueness closes the concurrent second-active-issuer insertion race.
-- An inconsistent existing authority set causes the migration to fail, never to pick a winner.
create unique index application_one_active_operations_authority_v2
 on portal_private.ai_service_identities(business_role)
 where business_role='OPERATIONS_DIRECTOR' and status='ACTIVE' and revoked_at is null;

create or replace function portal_private.application_operations_authority_v2()
returns uuid language plpgsql volatile security definer
set search_path='pg_catalog','portal_private' as $$
declare n integer; k uuid;
begin
  -- A deactivation waits for the in-flight transaction, never half-disables a submit.
  perform 1 from portal_private.client_application_policy_v2
    where singleton and enabled and authority_role='OPERATIONS_DIRECTOR'
      and nullif(btrim(authorization_source),'') is not null for share;
  if not found then raise exception 'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE'; end if;
  select count(*),(array_agg(id))[1] into n,k from portal_private.ai_service_identities
    where business_role::text='OPERATIONS_DIRECTOR' and status::text='ACTIVE'
      and revoked_at is null and (not_before is null or not_before<=now());
  if n<>1 then raise exception 'APPLICATION_OPERATIONS_AUTHORITY_UNAVAILABLE'; end if;
  perform 1 from portal_private.ai_service_identities where id=k and status::text='ACTIVE'
    and revoked_at is null and (not_before is null or not_before<=now()) for share;
  if not found then raise exception 'APPLICATION_OPERATIONS_AUTHORITY_UNAVAILABLE'; end if;
  return k;
end $$;

-- Gate even a receipt-only retry, before any allocation or payload write.
alter function portal_private.server_client_submit_application_v12(uuid,uuid,text,text,uuid,numeric,
  portal_private.price_mode_enum,numeric,character,text,text,date,date,text,uuid,uuid)
  rename to server_client_submit_application_review_base_v2;
create function portal_private.server_client_submit_application_v12(
 p_auth_user uuid,p_session_id uuid,p_client_id text,p_contract_id text,p_publication_item_id uuid,
 p_quantity_tonnes numeric,p_price_mode portal_private.price_mode_enum,p_proposed_price numeric,
 p_proposed_currency character,p_destination_country text,p_destination_station text,
 p_delivery_period_from date,p_delivery_period_to date,p_idempotency_key text,p_request_id uuid,p_correlation_id uuid
) returns table(application_id text,status text) language plpgsql security definer
set search_path='pg_catalog','portal_private' as $$
begin
 perform portal_private.application_operations_authority_v2();
 if current_setting('rona.application_atomic_bundle',true) is distinct from 'on' then raise exception 'ATOMIC_APPLICATION_BUNDLE_REQUIRED'; end if;
 return query select * from portal_private.server_client_submit_application_review_base_v2(
  p_auth_user,p_session_id,p_client_id,p_contract_id,p_publication_item_id,p_quantity_tonnes,p_price_mode,
  p_proposed_price,p_proposed_currency,p_destination_country,p_destination_station,p_delivery_period_from,
  p_delivery_period_to,p_idempotency_key,p_request_id,p_correlation_id);
end $$;
alter function portal_private.submit_client_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid)
 rename to submit_client_application_bundle_review_base_v2;
create function portal_private.submit_client_application_bundle_v2(
 p_auth_user uuid,p_session_id uuid,p_body jsonb,p_request_id uuid,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare previous text; result jsonb;
begin
 perform portal_private.application_operations_authority_v2();
 previous:=current_setting('rona.application_atomic_bundle',true);
 perform set_config('rona.application_atomic_bundle','on',true);
 result:=portal_private.submit_client_application_bundle_review_base_v2(
  p_auth_user,p_session_id,p_body,p_request_id,p_correlation_id);
 perform set_config('rona.application_atomic_bundle',coalesce(previous,''),true);
 return result;
end $$;
create function portal_private.guard_application_policy_insert_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin perform portal_private.application_operations_authority_v2(); return new; end $$;
create trigger aa_application_policy_insert_v2 before insert on portal_private.client_applications
 for each row execute function portal_private.guard_application_policy_insert_v2();

-- Gate old reachable application paths during the disabled cutover, not only the new adapter.
create trigger aa_application_policy_update_v2 before update of status,price_mode,proposed_price,proposed_currency,quantity_tonnes,linked_deal_key
 on portal_private.client_applications for each row execute function portal_private.guard_application_policy_insert_v2();
create function portal_private.guard_application_source_policy_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 if new.actor_role::text='CLIENT' and (new.event_type='CLIENT_APPLICATION_SUBMIT'
   or new.payload->>'message_type'='DELIVERED_PRICE_CALCULATION_REQUEST_V1'
   or new.payload->>'message_type' like 'APPLICATION_DETAILS_%') then
  perform portal_private.application_operations_authority_v2();
  if current_setting('rona.application_atomic_bundle',true) is distinct from 'on' then raise exception 'ATOMIC_APPLICATION_SOURCE_REQUIRED'; end if;
 end if;
 return new;
end $$;
create trigger aa_application_source_policy_v2 before insert on portal_private.portal_reverse_events
 for each row execute function portal_private.guard_application_source_policy_v2();
revoke all on function portal_private.guard_application_source_policy_v2() from public,anon,authenticated,service_role;

-- Registration is a permanent historical relationship, not a FK to a disposable live row.
-- The NOT VALID phase is deliberate. Reviewed activation registers legacy identities, then
-- validates the FK before allowing a release read/submit. No registration row is rewritten.
alter table portal_private.deal_registrations drop constraint if exists deal_registrations_application_key_fkey;
alter table portal_private.deal_registrations add constraint deal_registrations_application_registry_v2_fkey
 foreign key(application_key) references portal_private.client_application_registry_v2(application_key)
 on delete restrict not valid;
create table portal_private.client_application_deal_provenance_v2 (
 application_key uuid not null references portal_private.client_application_registry_v2(application_key),
 deal_key uuid not null references portal_private.deals(id),
 deal_snapshot jsonb not null,
 registration_snapshot jsonb,
 source_sha256 text not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(application_key,deal_key)
);
alter table portal_private.client_application_deal_provenance_v2 enable row level security;
revoke all on portal_private.client_application_deal_provenance_v2 from public,anon,authenticated,service_role;
create trigger application_deal_provenance_immutable_v2 before update or delete
 on portal_private.client_application_deal_provenance_v2 for each row
 execute function portal_private.guard_application_append_only_v2();

alter function portal_private.application_retention_decision_v2(uuid) rename to application_retention_decision_review_base_v2;
create function portal_private.application_retention_decision_v2(p_application_key uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare decision jsonb; a portal_private.client_applications; missing integer; unsafe integer;
begin
 decision:=portal_private.application_retention_decision_review_base_v2(p_application_key);
 if decision->>'reason' is distinct from 'REGISTERED_DEAL_DEPENDENCY' then return decision; end if;
 select * into a from portal_private.client_applications where id=p_application_key;
 -- Preserve active Deal authority: only already-cancelled/closed Deals permit retirement.
 select count(*) filter(where d.id is null),count(*) filter(where
   d.business_status is distinct from 'CANCELLED' or d.lifecycle_state::text is distinct from 'CLOSED')
 into missing,unsafe from (
   select a.linked_deal_key k where a.linked_deal_key is not null
   union select dr.deal_key from portal_private.deal_registrations dr where dr.application_key=a.id
 ) refs left join portal_private.deals d on d.id=refs.k;
 if missing>0 or unsafe>0 then return decision; end if;
 return decision||jsonb_build_object('decision','DELETE','reason',decision->>'business_reason',
   'provenance_required',true,'provenance_contract','APPLICATION_REGISTRY_TOMBSTONE_V2');
end $$;

alter function portal_private.retire_client_application_v2(uuid) rename to retire_client_application_review_base_v2;
create function portal_private.retire_client_application_v2(p_application_key uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications; decision jsonb; source record; snapshot jsonb;
begin
 perform portal_private.application_operations_authority_v2();
 select * into a from portal_private.client_applications where id=p_application_key for update;
 if not found then return jsonb_build_object('deleted',false,'already_absent',true); end if;
 -- Serialize against concurrent Deal transitions and registrations before deciding retention.
 perform 1 from portal_private.deal_registrations where application_key=a.id for update;
 perform 1 from portal_private.deals where id=a.linked_deal_key or id in (
   select deal_key from portal_private.deal_registrations where application_key=a.id) for share;
 decision:=portal_private.application_retention_decision_v2(a.id);
 if decision->>'decision'<>'DELETE' then return decision||jsonb_build_object('deleted',false); end if;
 perform portal_private.ensure_application_registry_v2(a.id);
 for source in select d.id,to_jsonb(d) deal,to_jsonb(dr) registration from portal_private.deals d
   left join portal_private.deal_registrations dr on dr.deal_key=d.id and dr.application_key=a.id
   where d.id=a.linked_deal_key or dr.application_key=a.id loop
   snapshot:=jsonb_build_object('deal',source.deal,'registration',source.registration);
   insert into portal_private.client_application_deal_provenance_v2
    (application_key,deal_key,deal_snapshot,registration_snapshot,source_sha256)
    values(a.id,source.id,source.deal,source.registration,encode(extensions.digest(snapshot::text,'sha256'),'hex'));
 end loop;
 return portal_private.retire_client_application_review_base_v2(a.id);
end $$;

-- These constraint triggers execute in the action transaction, before commit/success.
-- Deferral allows existing multi-statement cancel/reject handlers to finish their audit.
-- Periodic reconciliation is a safety net, never the primary deletion mechanism.
create function portal_private.application_lifecycle_retirement_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare k uuid; decision jsonb;
begin
 if tg_table_name='client_applications' then k:=new.id;
 elsif tg_table_name='owner_application_workflow' then k:=new.application_key;
 else
   if new.entity_type is distinct from 'APPLICATION' or new.action is distinct from 'APPLICATION_RETIREMENT_CONFIRMED'
      or new.actor_role::text is distinct from 'ADMIN' or new.actor_user_id is null then return null; end if;
   select id into k from portal_private.client_applications where application_id=new.entity_id;
 end if;
 if k is null or exists(select 1 from portal_private.client_application_tombstones_v2 where application_key=k)
    or not exists(select 1 from portal_private.client_applications where id=k) then return null; end if;
 decision:=portal_private.application_retention_decision_v2(k);
 if decision->>'decision'='DELETE' then perform portal_private.retire_client_application_v2(k);
 elsif decision->>'decision'='BLOCKED' then raise exception 'APPLICATION_RETIREMENT_BLOCKED: %',decision->>'reason';
 end if;
 return null;
end $$;
create constraint trigger application_lifecycle_retire_v2 after insert or update on portal_private.client_applications
 deferrable initially deferred for each row execute function portal_private.application_lifecycle_retirement_v2();
create constraint trigger application_workflow_retire_v2 after insert or update on portal_private.owner_application_workflow
 deferrable initially deferred for each row execute function portal_private.application_lifecycle_retirement_v2();
create constraint trigger application_decision_retire_v2 after insert on portal_private.audit_events
 deferrable initially deferred for each row execute function portal_private.application_lifecycle_retirement_v2();

-- Common resolver keeps one number across the shared AI snapshot and permanent provenance.
-- Roles remain enforced by the existing authenticated gateway; no new public RPC is granted.
create function portal_private.application_common_snapshot_v2(p_application_id text)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare r portal_private.client_application_registry_v2; a jsonb; authority text; retired jsonb;
begin
 if not coalesce((select enabled from portal_private.client_application_policy_v2 where singleton),false)
  then raise exception 'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE'; end if;
 select * into r from portal_private.client_application_registry_v2 where application_id=p_application_id;
 if not found then raise exception 'CANONICAL_APPLICATION_NOT_FOUND'; end if;
 select identity_id into authority from portal_private.ai_service_identities where id=r.numbering_identity_key;
 if r.retired_at is null then a:=portal_private.application_business_row_v2(r.application_key);
 else
  select jsonb_build_object('application_id',t.application_id,'record_kind','APPLICATION_TOMBSTONE',
   'business_visible',false,'status','DELETED','reason',t.reason_code,'retired_at',t.deleted_at,
   'source_sha256',t.source_fingerprint,'client_key',r.client_key,'contract_key',r.contract_key,
   'deal_provenance',coalesce((select jsonb_agg(jsonb_build_object('deal_key',p.deal_key,
     'deal_id',p.deal_snapshot->>'deal_id','source_sha256',p.source_sha256))
     from portal_private.client_application_deal_provenance_v2 p where p.application_key=r.application_key),'[]'::jsonb))
   into a from portal_private.client_application_tombstones_v2 t where t.application_key=r.application_key;
  if a is null then raise exception 'APPLICATION_RETIREMENT_PROVENANCE_MISSING'; end if;
 end if;
 return a||jsonb_build_object('common_ai_contract','RONA_APPLICATION_COMMON_AI_V2',
  'canonical_application_id',r.application_id,'numbering_authority_role','OPERATIONS_DIRECTOR',
  'numbering_origin',r.numbering_origin,'numbering_identity_id',authority,
  'source_intake_id',r.primary_intake_id,'source_record_id',r.source_record_id);
end $$;

-- Preserve every non-APPLICATION branch of the existing shared canonical resolver.
alter function portal_private.canonical_target_snapshot(text,text) rename to canonical_target_snapshot_application_base_v2;
create function portal_private.canonical_target_snapshot(p_type text,p_id text)
returns jsonb language plpgsql stable set search_path='pg_catalog','portal_private' as $$
declare original jsonb; provenance jsonb;
begin
 if upper(btrim(p_type))='APPLICATION' then return portal_private.application_common_snapshot_v2(p_id); end if;
 original:=portal_private.canonical_target_snapshot_application_base_v2(p_type,p_id);
 if upper(btrim(p_type))='DEAL' then
  select jsonb_agg(jsonb_build_object('canonical_application_id',r.application_id,'retired_at',r.retired_at,
    'application_source_sha256',t.source_fingerprint,'provenance_sha256',p.source_sha256)) into provenance
   from portal_private.deals d
   join portal_private.deal_registrations dr on dr.deal_key=d.id
   join portal_private.client_application_registry_v2 r on r.application_key=dr.application_key and r.retired_at is not null
   join portal_private.client_application_tombstones_v2 t on t.application_key=r.application_key
   join portal_private.client_application_deal_provenance_v2 p on p.application_key=r.application_key and p.deal_key=d.id
   where d.deal_id=p_id;
  if provenance is not null then return original||jsonb_build_object('retired_application_provenance',provenance); end if;
 end if;
 return original;
end $$;

-- Update the actual common role-state entrypoint, retaining all unrelated role state.
alter function portal_private.ai_role_state_current_v2(portal_private.ai_business_role_enum,integer,integer)
 rename to ai_role_state_current_application_base_v2;
create function portal_private.ai_role_state_current_v2(
 p_role portal_private.ai_business_role_enum,p_task_limit integer default 10,p_coord_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare state jsonb; refs jsonb;
begin
 state:=portal_private.ai_role_state_current_application_base_v2(p_role,p_task_limit,p_coord_limit);
 -- Application identity is shared by roles; this is not a grant of mutation or finance authority.
 select coalesce(jsonb_agg(jsonb_build_object('application_id',r.application_id,
   'client_id',c.client_id,'contract_id',ct.contract_id,'numbering_origin',r.numbering_origin,
   'numbering_identity_id',si.identity_id,'resolver','canonical_target_snapshot/APPLICATION')
   order by r.application_id),'[]'::jsonb) into refs
 from (select * from portal_private.client_application_registry_v2 where retired_at is null order by registered_at desc,application_id limit 20) r
 join portal_private.clients c on c.id=r.client_key
 join portal_private.contracts ct on ct.id=r.contract_key
 left join portal_private.ai_service_identities si on si.id=r.numbering_identity_key
 where r.retired_at is null and exists(select 1 from portal_private.client_application_policy_v2 where singleton and enabled);
 return state||jsonb_build_object('application_common_identity',jsonb_build_object(
   'contract','RONA_APPLICATION_COMMON_AI_V2','authority_role','OPERATIONS_DIRECTOR','references',refs,
   'max_references',20,'resolver','canonical_target_snapshot/APPLICATION','scope','SHARED_APPLICATION_IDENTITY_ONLY'));
end $$;

revoke all on function portal_private.application_operations_authority_v2(),
 portal_private.guard_application_policy_insert_v2(),portal_private.application_retention_decision_v2(uuid),
 portal_private.retire_client_application_v2(uuid),portal_private.application_lifecycle_retirement_v2(),
 portal_private.application_common_snapshot_v2(text),portal_private.canonical_target_snapshot(text,text),
 portal_private.canonical_target_snapshot_application_base_v2(text,text),
 portal_private.ai_role_state_current_v2(portal_private.ai_business_role_enum,integer,integer),
 portal_private.ai_role_state_current_application_base_v2(portal_private.ai_business_role_enum,integer,integer),
 portal_private.server_client_submit_application_v12(uuid,uuid,text,text,uuid,numeric,portal_private.price_mode_enum,numeric,character,text,text,date,date,text,uuid,uuid),
 portal_private.server_client_submit_application_review_base_v2(uuid,uuid,text,text,uuid,numeric,portal_private.price_mode_enum,numeric,character,text,text,date,date,text,uuid,uuid),
 portal_private.submit_client_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid),
 portal_private.submit_client_application_bundle_review_base_v2(uuid,uuid,jsonb,uuid,uuid)
 from public,anon,authenticated,service_role;
