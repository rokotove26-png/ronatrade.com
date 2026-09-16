-- PR548 review R2/R3/R7/R8. Schema-only candidate; it grants NO production approval.
-- An independent System Admin must supply the actual approved review and exact release SHA
-- before activation. A service identity row alone is not a delegation to issue business IDs.
create table portal_private.client_application_numbering_delegations_v2 (
 delegation_id uuid primary key default gen_random_uuid(),
 operations_identity_key uuid not null references portal_private.ai_service_identities(id),
 executor_role name not null check(executor_role='rona_application_executor_v2'),
 executor_entrypoint text not null check(executor_entrypoint='portal_private.operations_issue_application_number_v2(uuid)'),
 approval_source_type text not null check(approval_source_type='SYSTEM_ADMIN_INDEPENDENT_REVIEW'),
 approval_source_ref text not null check(length(btrim(approval_source_ref))>0),
 approved_release_sha text not null check(approved_release_sha ~ '^[0-9a-f]{40}$'),
 approved_at timestamptz not null,
 valid_until timestamptz,
 recorded_by name not null default session_user,
 recorded_at timestamptz not null default clock_timestamp(),
 check(valid_until is null or valid_until>approved_at)
);
alter table portal_private.client_application_policy_v2 add column numbering_delegation_id uuid
 references portal_private.client_application_numbering_delegations_v2(delegation_id) on delete restrict;
alter table portal_private.client_application_number_reservations_v2 add column delegation_id uuid
 references portal_private.client_application_numbering_delegations_v2(delegation_id) on delete restrict;
alter table portal_private.client_application_number_reservations_v2 add column executor_role name;
alter table portal_private.client_application_numbering_delegations_v2 enable row level security;
revoke all on portal_private.client_application_numbering_delegations_v2 from public,anon,authenticated,service_role;
create trigger application_numbering_delegation_immutable_v2 before update or delete
 on portal_private.client_application_numbering_delegations_v2 for each row
 execute function portal_private.guard_application_append_only_v2();

-- Snapshot the genuine pre-installation identity set once. Backdated created_at is not a permit.
create table portal_private.client_application_legacy_inventory_v2 (
 application_key uuid primary key, application_id text not null unique,
 client_key uuid not null, contract_key uuid not null,
 source_snapshot jsonb not null, source_sha256 text not null,
 captured_at timestamptz not null default clock_timestamp()
);
alter table portal_private.client_application_legacy_inventory_v2 enable row level security;
revoke all on portal_private.client_application_legacy_inventory_v2 from public,anon,authenticated,service_role;
do $$ begin
 lock table portal_private.client_applications in share row exclusive mode;
 insert into portal_private.client_application_legacy_inventory_v2
  (application_key,application_id,client_key,contract_key,source_snapshot,source_sha256)
  select a.id,a.application_id,a.client_key,a.contract_key,to_jsonb(a),
  encode(extensions.digest(to_jsonb(a)::text,'sha256'),'hex') from portal_private.client_applications a;
 create trigger application_legacy_inventory_sealed_v2 before insert or update or delete
  on portal_private.client_application_legacy_inventory_v2 for each row
  execute function portal_private.guard_application_append_only_v2();
end $$;

do $$ begin
 if not exists(select 1 from pg_roles where rolname='rona_application_executor_v2') then
  create role rona_application_executor_v2 nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
 elsif exists(select 1 from pg_roles where rolname='rona_application_executor_v2'
  and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
  raise exception 'APPLICATION_EXECUTOR_ROLE_UNSAFE';
 end if;
 -- PostgreSQL 17 CREATEROLE does not imply SET ROLE for a newly created owner.
 -- Grant only the trusted migration principal SET (not INHERIT), never API roles.
 execute format('grant rona_application_executor_v2 to %I with inherit false, set true',current_user);
end $$;
grant usage,create on schema portal_private to rona_application_executor_v2;

alter function portal_private.application_operations_authority_v2() rename to application_operations_authority_policy_base_v2;
create function portal_private.application_operations_authority_v2()
returns uuid language plpgsql volatile security definer set search_path='pg_catalog','portal_private' as $$
declare identity_key uuid; d portal_private.client_application_numbering_delegations_v2;
begin
 -- The base takes SHARE locks on policy and the actual Operations identity. Changing
 -- the pointer, disabling the policy or revoking that identity waits for the transaction.
 identity_key:=portal_private.application_operations_authority_policy_base_v2();
 select nd.* into d from portal_private.client_application_numbering_delegations_v2 nd
  join portal_private.client_application_policy_v2 p on p.numbering_delegation_id=nd.delegation_id
  where p.singleton and p.enabled and nd.operations_identity_key=identity_key
   and nd.approved_at<=now() and (nd.valid_until is null or nd.valid_until>now());
 if not found then raise exception 'APPLICATION_NUMBERING_DELEGATION_NOT_APPROVED'; end if;
 if not exists(select 1 from pg_proc pr join pg_namespace ns on ns.oid=pr.pronamespace
  where ns.nspname='portal_private' and pr.proname='operations_issue_application_number_v2'
   and pr.prosecdef and pg_get_userbyid(pr.proowner)=d.executor_role) then
  raise exception 'APPLICATION_NUMBERING_EXECUTOR_NOT_BOUND';
 end if;
 return identity_key;
end $$;

-- The only grantee of the internal allocator is the non-login delegated executor.
-- Application API callers continue to use session-checked atomic entrypoints, not this function.
alter function portal_private.next_application_business_id(uuid) rename to reserve_application_number_internal_v2;
revoke all on function portal_private.reserve_application_number_internal_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function portal_private.reserve_application_number_internal_v2(uuid),
 portal_private.application_operations_authority_v2() to rona_application_executor_v2;
grant select on portal_private.client_application_policy_v2 to rona_application_executor_v2;
create policy application_executor_policy_read_v2 on portal_private.client_application_policy_v2
 for select to rona_application_executor_v2 using(singleton);
create function portal_private.operations_issue_application_number_v2(p_client_key uuid)
returns text language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare delegation_key uuid; previous text; number text;
begin
 if current_user<>'rona_application_executor_v2' then raise exception 'APPLICATION_EXECUTOR_ROLE_REQUIRED'; end if;
 perform portal_private.application_operations_authority_v2();
 select numbering_delegation_id into delegation_key from portal_private.client_application_policy_v2 where singleton;
 previous:=current_setting('rona.application_numbering_delegation',true);
 -- This is a flow marker, not a permission check: SQL grants and the reviewed
 -- immutable delegation are the authority boundary; clients cannot call the allocator.
 perform set_config('rona.application_numbering_delegation',delegation_key::text,true);
 number:=portal_private.reserve_application_number_internal_v2(p_client_key);
 perform set_config('rona.application_numbering_delegation',coalesce(previous,''),true);
 return number;
end $$;
alter function portal_private.operations_issue_application_number_v2(uuid) owner to rona_application_executor_v2;
revoke create on schema portal_private from rona_application_executor_v2;
revoke all on function portal_private.operations_issue_application_number_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function portal_private.operations_issue_application_number_v2(uuid) to postgres;
create function portal_private.next_application_business_id(p_client_key uuid)
returns text language sql security definer set search_path='pg_catalog','portal_private' as $$
 select portal_private.operations_issue_application_number_v2(p_client_key)
$$;

create function portal_private.guard_application_number_issuance_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare identity_key uuid; delegation_key uuid;
begin
 identity_key:=portal_private.application_operations_authority_v2();
 select numbering_delegation_id into delegation_key from portal_private.client_application_policy_v2 where singleton;
 if new.operations_identity_key<>identity_key or
  current_setting('rona.application_numbering_delegation',true) is distinct from delegation_key::text then
  raise exception 'APPLICATION_NUMBER_DELEGATED_EXECUTOR_REQUIRED'; end if;
 new.delegation_id:=delegation_key;new.executor_role:='rona_application_executor_v2';
 return new;
end $$;
create trigger application_number_issuer_v2 before insert on portal_private.client_application_number_reservations_v2
 for each row execute function portal_private.guard_application_number_issuance_v2();

create function portal_private.guard_application_registry_admission_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 if new.numbering_origin='AUTHORITATIVE_LEGACY' then
  if new.numbering_identity_key is not null or not exists(
   select 1 from portal_private.client_application_legacy_inventory_v2 l
   where (l.application_key,l.application_id,l.client_key,l.contract_key)=
    (new.application_key,new.application_id,new.client_key,new.contract_key)) then
   raise exception 'APPLICATION_LEGACY_BACKFILL_NOT_AUTHORIZED'; end if;
 else
  if not exists(select 1 from portal_private.client_application_number_reservations_v2 r
   join portal_private.client_application_numbering_delegations_v2 d on d.delegation_id=r.delegation_id
   where r.application_id=new.application_id and r.issued_to_application_key=new.application_key
    and r.client_key=new.client_key and r.operations_identity_key=new.numbering_identity_key
    and r.executor_role=d.executor_role and d.operations_identity_key=new.numbering_identity_key) then
   raise exception 'APPLICATION_REGISTRY_ISSUANCE_PROOF_MISSING'; end if;
 end if;
 return new;
end $$;
create trigger application_registry_admission_v2 before insert on portal_private.client_application_registry_v2
 for each row execute function portal_private.guard_application_registry_admission_v2();

create function portal_private.guard_application_disposition_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 if tg_op='DELETE' then raise exception 'APPLICATION_SOURCE_DISPOSITION_PERMANENT'; end if;
 if new is not distinct from old then return new; end if;
 if new.intake_id<>old.intake_id or new.recorded_at<>old.recorded_at
  or old.disposition in ('DELETED','TERMINAL_REQUEST') or new.disposition<>'DELETED'
  or not exists(select 1 from portal_private.client_application_tombstones_v2 t
   where t.application_key=new.application_key and t.reason_code=new.reason_code
    and (old.application_key=t.application_key or t.primary_intake_id=old.intake_id
     or exists(select 1 from portal_private.client_intake_v1 i
       where i.intake_id=old.intake_id and i.application_key=t.application_key))) then
  raise exception 'APPLICATION_SOURCE_DISPOSITION_IMMUTABLE'; end if;
 return new;
end $$;
create trigger application_source_disposition_guard_v2 before update or delete
 on portal_private.client_application_source_disposition_v2 for each row
 execute function portal_private.guard_application_disposition_v2();
create trigger application_submit_receipt_immutable_v2 before update or delete
 on portal_private.client_application_submit_receipts_v2 for each row
 execute function portal_private.guard_application_append_only_v2();
create trigger application_bundle_receipt_immutable_v2 before update or delete
 on portal_private.client_application_bundle_receipts_v2 for each row
 execute function portal_private.guard_application_append_only_v2();

-- Check the persisted canonical relation, not just a string shaped like an ID.
create function portal_private.validate_application_submit_receipt_v2(p_receipt jsonb)
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 perform portal_private.application_operations_authority_v2();
 if p_receipt->>'business_contract' is distinct from 'RONA_APPLICATION_BUSINESS_V2'
  or p_receipt->'bundle_complete' is distinct from 'true'::jsonb or not exists(
   select 1 from portal_private.client_applications a
   join portal_private.client_application_registry_v2 r on r.application_key=a.id and r.retired_at is null
   join portal_private.client_intake_v1 i on i.intake_id=r.primary_intake_id and i.application_key=a.id
   where a.application_id=p_receipt->>'application_id'
    and i.intake_id::text=p_receipt->>'intake_id' and i.durable_id::text=p_receipt->>'durable_id'
    and i.source_record_id=p_receipt->>'source_id'
    and i.routing_state='APPLIED' and i.client_visible and i.admin_visible
    and portal_private.application_retention_decision_v2(a.id)->>'decision'='KEEP'
    and exists(select 1 from portal_private.client_intake_task_links_v1 l
      join portal_private.staff_tasks t on t.id=l.staff_task_id
      where l.intake_id=i.intake_id and t.assigned_functional_role::text='OPERATIONS_DIRECTOR'
       and t.qa_only=false)) then raise exception 'APPLICATION_CANONICAL_SUCCESS_NOT_COMMITTED'; end if;
 return p_receipt;
end $$;
alter function portal_private.submit_client_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid)
 rename to submit_client_application_bundle_authority_base_v2;
create function portal_private.submit_client_application_bundle_v2(p_auth_user uuid,p_session_id uuid,p_body jsonb,p_request_id uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 perform portal_private.application_operations_authority_v2();
 return portal_private.validate_application_submit_receipt_v2(portal_private.submit_client_application_bundle_authority_base_v2(
  p_auth_user,p_session_id,p_body,p_request_id,p_correlation_id));
end $$;
alter function portal_private.submit_delivered_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid)
 rename to submit_delivered_application_bundle_authority_base_v2;
create function portal_private.submit_delivered_application_bundle_v2(p_auth_user uuid,p_session_id uuid,p_body jsonb,p_request_id uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
begin
 perform portal_private.application_operations_authority_v2();
 return portal_private.validate_application_submit_receipt_v2(portal_private.submit_delivered_application_bundle_authority_base_v2(
  p_auth_user,p_session_id,p_body,p_request_id,p_correlation_id));
end $$;

-- Record the real delegation, without claiming the AI signed a request from the browser.
alter function portal_private.application_common_snapshot_v2(text) rename to application_common_snapshot_authority_base_v2;
create function portal_private.application_common_snapshot_v2(p_application_id text)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare result jsonb; evidence jsonb;
begin
 result:=portal_private.application_common_snapshot_authority_base_v2(p_application_id);
 select jsonb_build_object('mode','REVIEWED_INTERNAL_DELEGATION','executor_role',r.executor_role,
  'delegation_id',d.delegation_id,'approval_source_ref',d.approval_source_ref,
  'approved_release_sha',d.approved_release_sha,'operations_identity_key',d.operations_identity_key)
 into evidence from portal_private.client_application_number_reservations_v2 r
 join portal_private.client_application_numbering_delegations_v2 d on d.delegation_id=r.delegation_id
 where r.application_id=p_application_id;
 return result||jsonb_build_object('numbering_execution',evidence);
end $$;

revoke all on function portal_private.application_operations_authority_v2(),
 portal_private.application_operations_authority_policy_base_v2(),portal_private.next_application_business_id(uuid),
 portal_private.guard_application_number_issuance_v2(),portal_private.guard_application_registry_admission_v2(),
 portal_private.guard_application_disposition_v2(),portal_private.validate_application_submit_receipt_v2(jsonb),
 portal_private.submit_client_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid),
 portal_private.submit_client_application_bundle_authority_base_v2(uuid,uuid,jsonb,uuid,uuid),
 portal_private.submit_delivered_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid),
 portal_private.submit_delivered_application_bundle_authority_base_v2(uuid,uuid,jsonb,uuid,uuid),
 portal_private.application_common_snapshot_v2(text),portal_private.application_common_snapshot_authority_base_v2(text)
 from public,anon,authenticated,service_role;

-- A manually enabled flag must not publish a supposedly activated collection when
-- the independent delegation is absent. This guard is scoped to Applications only.
alter function portal_private.application_business_projection_v2(text,text,text)
 rename to application_business_projection_authority_base_v2;
create function portal_private.application_business_projection_v2(p_audience text,p_client_id text default null,p_contract_id text default null)
returns jsonb language plpgsql volatile security definer set search_path='pg_catalog','portal_private' as $$
begin
 perform portal_private.application_operations_authority_v2();
 return portal_private.application_business_projection_authority_base_v2(p_audience,p_client_id,p_contract_id);
end $$;
revoke all on function portal_private.application_business_projection_v2(text,text,text),
 portal_private.application_business_projection_authority_base_v2(text,text,text)
 from public,anon,authenticated,service_role;

-- UPDATE OF observes the SQL SET-list, not columns changed by a BEFORE trigger.
-- Status acceptance may set price_mode inside guard_application_agreement_v2;
-- persist the agreed line for that real transition too, once only.
drop trigger a_application_agreed_line_v2 on portal_private.client_applications;
create trigger a_application_agreed_line_v2 after update
 on portal_private.client_applications for each row
 when (old.price_mode is distinct from new.price_mode)
 execute function portal_private.application_agreed_line_v2();
