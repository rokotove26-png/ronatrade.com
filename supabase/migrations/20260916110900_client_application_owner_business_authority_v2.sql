-- PR548 SYSTEM_ADMIN re-review 5699785446.
-- Explicit Owner/Admin business-action boundary. Operations Director remains AI-only
-- numbering/routing/identity authority and cannot originate commercial/resource decisions.
-- Candidate only: no policy activation, recovery, deletion or business mutation is executed here.

create table portal_private.client_application_owner_actions_v2 (
  action_id uuid primary key default gen_random_uuid(),
  application_key uuid not null references portal_private.client_application_registry_v2(application_key) on delete restrict,
  application_id text not null,
  action_code text not null check(action_code in ('ACCEPT','REJECT','COUNTER_OFFER','RESOURCE_APPROVED','RESOURCE_DENIED','DEAL_HANDOFF')),
  actor_portal_user_id uuid not null references portal_private.portal_users(id),
  actor_auth_user_id uuid not null,
  actor_role text not null default 'ADMIN' check(actor_role='ADMIN'),
  session_id uuid not null,
  source_system text not null default 'OWNER_ADMIN_PORTAL' check(source_system='OWNER_ADMIN_PORTAL'),
  source_path text not null,
  decision_payload jsonb not null default '{}'::jsonb,
  request_id uuid not null default gen_random_uuid(),
  correlation_id uuid,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(application_key,action_id)
);
alter table portal_private.client_application_owner_actions_v2 enable row level security;
revoke all on portal_private.client_application_owner_actions_v2 from public,anon,authenticated,service_role;
create trigger application_owner_actions_immutable_v2 before update or delete
 on portal_private.client_application_owner_actions_v2 for each row
 execute function portal_private.guard_application_append_only_v2();

create or replace function portal_private.application_owner_admin_actor_v2()
returns table(portal_user_id uuid,auth_user_id uuid,session_id uuid)
language plpgsql stable security definer
set search_path='pg_catalog','public','portal_private','auth' as $$
declare v_auth uuid; v_session uuid; n integer;
begin
 v_auth:=auth.uid();
 begin v_session:=nullif(auth.jwt()->>'session_id','')::uuid; exception when others then v_session:=null; end;
 if v_auth is null or v_session is null then raise exception 'APPLICATION_OWNER_ADMIN_REQUIRED'; end if;
 select count(*),(array_agg(a.portal_user_id))[1] into n,portal_user_id
 from portal_private.resolve_portal_auth(v_auth,v_session) a
 join auth.sessions s on s.id=v_session and s.user_id=v_auth
 where a.session_allowed and 'ADMIN'=any(a.roles) and (s.not_after is null or s.not_after>now());
 if n<>1 or portal_user_id is null then raise exception 'APPLICATION_OWNER_ADMIN_REQUIRED'; end if;
 auth_user_id:=v_auth;session_id:=v_session;return next;
end $$;
revoke all on function portal_private.application_owner_admin_actor_v2() from public,anon,authenticated,service_role;

-- An Owner action token exists only inside the authenticated business-action transaction.
-- Workflow changes by the client counter-response path remain valid, but AI/Operations cannot
-- write Owner decision fields or resource/commercial state directly.
create or replace function portal_private.guard_owner_application_workflow_boundary_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare token uuid; evidence portal_private.client_application_owner_actions_v2; client_response boolean;
begin
 if tg_op='INSERT' then
  if new.business_status='NEW' and new.counter_price is null and new.counter_currency is null
   and coalesce(new.counter_offer_used,false)=false and new.client_counter_response is null
   and new.admin_decided_by is null and new.admin_decided_at is null
   and new.supplier_approved_by is null and new.supplier_approved_at is null and new.finalized_at is null then
   return new;
  end if;
 else
  client_response:=old.business_status='COUNTER_OFFERED'
   and ((new.business_status='CLIENT_COUNTER_ACCEPTED' and new.client_counter_response='ACCEPTED')
     or (new.business_status='NEW' and new.client_counter_response='DECLINED'))
   and new.counter_price is not distinct from old.counter_price
   and new.counter_currency is not distinct from old.counter_currency
   and new.counter_offer_used is not distinct from old.counter_offer_used
   and new.admin_decided_by is not distinct from old.admin_decided_by
   and new.admin_decided_at is not distinct from old.admin_decided_at
   and new.supplier_approved_by is not distinct from old.supplier_approved_by
   and new.supplier_approved_at is not distinct from old.supplier_approved_at
   and new.finalized_at is not distinct from old.finalized_at;
  if client_response then return new; end if;
  if new is not distinct from old then return new; end if;
 end if;
 begin token:=nullif(current_setting('rona.application_owner_action',true),'')::uuid; exception when others then token:=null; end;
 if token is null then raise exception 'APPLICATION_OWNER_ADMIN_ACTION_REQUIRED'; end if;
 select * into evidence from portal_private.client_application_owner_actions_v2 x
  where x.action_id=token and x.application_key=new.application_key;
 if not found then raise exception 'APPLICATION_OWNER_ADMIN_ACTION_REQUIRED'; end if;
 if new.admin_decided_by is not null and new.admin_decided_by is distinct from evidence.actor_portal_user_id
  then raise exception 'APPLICATION_OWNER_ADMIN_PROVENANCE_MISMATCH'; end if;
 if new.supplier_approved_by is not null and new.supplier_approved_by is distinct from evidence.actor_portal_user_id
  then raise exception 'APPLICATION_OWNER_ADMIN_PROVENANCE_MISMATCH'; end if;
 return new;
end $$;
drop trigger if exists a_application_owner_workflow_boundary_v2 on portal_private.owner_application_workflow;
create trigger a_application_owner_workflow_boundary_v2 before insert or update
 on portal_private.owner_application_workflow for each row
 execute function portal_private.guard_owner_application_workflow_boundary_v2();
revoke all on function portal_private.guard_owner_application_workflow_boundary_v2() from public,anon,authenticated,service_role;

create or replace function portal_private.guard_owner_application_status_boundary_v2()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare token uuid;
begin
 if new.status is not distinct from old.status and new.decision_by is not distinct from old.decision_by
  and new.decision_reason is not distinct from old.decision_reason then return new; end if;
 -- Owner/Admin-only commercial decisions. Client acceptance of an already recorded
 -- Owner counter-offer is the only accepted-status transition that does not require a
 -- contemporaneous Owner action token.
 if new.status::text='DEAL_REGISTERED' and new.status is distinct from old.status then
  if not exists(select 1 from portal_private.client_application_owner_actions_v2 x
    where x.application_key=new.id and x.action_code='DEAL_HANDOFF') then
   raise exception 'APPLICATION_OWNER_DEAL_HANDOFF_REQUIRED';
  end if;
  return new;
 end if;
 if new.status::text='ACCEPTED_AWAITING_DEAL_REGISTRATION' and new.status is distinct from old.status
    and coalesce(new.decision_reason,'') like 'CLIENT_ACCEPTED_ADMIN_COUNTER%' then return new; end if;
 if not (new.status::text in ('REJECTED','CANCELLED','ACCEPTED_AWAITING_DEAL_REGISTRATION')
   or (new.decision_by is not null and new.decision_by is distinct from old.decision_by)
   or coalesce(new.decision_reason,'') ~ '^(ADMIN_|OWNER_|SUPPLIER_)') then return new; end if;
 begin token:=nullif(current_setting('rona.application_owner_action',true),'')::uuid; exception when others then token:=null; end;
 if token is null or not exists(select 1 from portal_private.client_application_owner_actions_v2 x
   where x.action_id=token and x.application_key=new.id and (new.decision_by is null or x.actor_portal_user_id=new.decision_by))
  then raise exception 'APPLICATION_OWNER_ADMIN_ACTION_REQUIRED'; end if;
 return new;
end $$;
drop trigger if exists a_application_owner_status_boundary_v2 on portal_private.client_applications;
create trigger a_application_owner_status_boundary_v2 before update of status,decision_by,decision_reason
 on portal_private.client_applications for each row
 execute function portal_private.guard_owner_application_status_boundary_v2();
revoke all on function portal_private.guard_owner_application_status_boundary_v2() from public,anon,authenticated,service_role;

create or replace function public.owner_r1_application_business_action_v2(
 p_application_id text,p_action text,p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path='pg_catalog','public','portal_private','auth' as $$
declare actor record; a record; w record; normalized text; action_id uuid:=gen_random_uuid();
 token_before text; reason text; price numeric; currency text; payload jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
 select * into actor from portal_private.application_owner_admin_actor_v2();
 normalized:=upper(replace(btrim(coalesce(p_action,'')),'-','_'));
 if normalized='SUPPLIER_APPROVED' then normalized:='RESOURCE_APPROVED'; end if;
 if normalized='CANCEL' then normalized:='RESOURCE_DENIED'; end if;
 if normalized not in ('ACCEPT','REJECT','COUNTER_OFFER','RESOURCE_APPROVED','RESOURCE_DENIED','DEAL_HANDOFF')
  then raise exception 'APPLICATION_OWNER_ACTION_INVALID'; end if;
 select aa.id,aa.application_id,aa.status::text,aa.linked_deal_key,d.deal_id,d.business_status deal_status,d.lifecycle_state::text deal_lifecycle
 into a from portal_private.client_applications aa left join portal_private.deals d on d.id=aa.linked_deal_key
 where aa.application_id=p_application_id for update of aa limit 1;
 if a.id is null then raise exception 'APPLICATION_NOT_FOUND'; end if;
 perform portal_private.ensure_application_registry_v2(a.id);
 select * into w from portal_private.owner_application_workflow where application_key=a.id for update;
 if normalized='ACCEPT' and coalesce(w.business_status,'')='SUPPLIER_APPROVED' and a.linked_deal_key is null then normalized:='DEAL_HANDOFF'; end if;
 if normalized='DEAL_HANDOFF' and (coalesce(w.business_status,'')<>'SUPPLIER_APPROVED' or a.linked_deal_key is not null) then
  raise exception 'APPLICATION_DEAL_HANDOFF_RESOURCE_APPROVAL_REQUIRED';
 end if;
 insert into portal_private.client_application_owner_actions_v2(action_id,application_key,application_id,action_code,
  actor_portal_user_id,actor_auth_user_id,session_id,source_path,decision_payload)
 values(action_id,a.id,a.application_id,normalized,actor.portal_user_id,actor.auth_user_id,actor.session_id,
  '/admin/applications/'||a.application_id||'/'||lower(replace(normalized,'_','-')),payload);
 token_before:=current_setting('rona.application_owner_action',true);
 perform set_config('rona.application_owner_action',action_id::text,true);

 if normalized='ACCEPT' then
  if a.status<>'DEAL_REGISTERED' then
   update portal_private.client_applications set status='ACCEPTED_AWAITING_DEAL_REGISTRATION',decision_at=now(),
    decision_by=actor.portal_user_id,decision_reason='ADMIN_ACCEPTED',updated_at=now() where id=a.id;
  end if;
  insert into portal_private.owner_application_workflow(application_key,business_status,admin_decided_by,admin_decided_at,updated_at)
   values(a.id,'SUPPLIER_REVIEW',actor.portal_user_id,now(),now())
   on conflict(application_key) do update set business_status='SUPPLIER_REVIEW',admin_decided_by=excluded.admin_decided_by,
    admin_decided_at=excluded.admin_decided_at,updated_at=now();
 elsif normalized='DEAL_HANDOFF' then
  update portal_private.client_applications set status='ACCEPTED_AWAITING_DEAL_REGISTRATION',decision_at=now(),
   decision_by=actor.portal_user_id,decision_reason='OWNER_DEAL_HANDOFF_AUTHORIZED',updated_at=now() where id=a.id;
  -- The existing technical Operations bridge may register the Deal after this Owner authorization.
  if exists(select 1 from portal_private.client_applications x where x.id=a.id and x.linked_deal_key is not null) then
   update portal_private.owner_application_workflow set business_status='DEAL',finalized_at=coalesce(finalized_at,now()),updated_at=now()
    where application_key=a.id;
  end if;
 elsif normalized='REJECT' then
  if a.status='DEAL_REGISTERED' then raise exception 'REGISTERED_APPLICATION_CANNOT_BE_REJECTED'; end if;
  reason:=left(coalesce(nullif(btrim(payload->>'reason'),''),'ADMIN_REJECTED'),500);
  update portal_private.client_applications set status='REJECTED',decision_at=now(),decision_by=actor.portal_user_id,
   decision_reason=reason,updated_at=now() where id=a.id;
  insert into portal_private.owner_application_workflow(application_key,business_status,admin_decided_by,admin_decided_at,updated_at)
   values(a.id,'REJECTED',actor.portal_user_id,now(),now())
   on conflict(application_key) do update set business_status='REJECTED',admin_decided_by=excluded.admin_decided_by,
    admin_decided_at=excluded.admin_decided_at,updated_at=now();
 elsif normalized='RESOURCE_DENIED' then
  if a.status='DEAL_REGISTERED' and coalesce(a.deal_lifecycle,'')<>'CLOSED' then raise exception 'ACTIVE_DEAL_RESOURCE_DENIAL_FORBIDDEN'; end if;
  reason:=left(coalesce(nullif(btrim(payload->>'reason'),''),'SUPPLIER_RESOURCE_DENIED'),500);
  update portal_private.client_applications set status='CANCELLED',decision_at=now(),decision_by=actor.portal_user_id,
   decision_reason=reason,updated_at=now() where id=a.id;
  insert into portal_private.owner_application_workflow(application_key,business_status,admin_decided_by,admin_decided_at,updated_at)
   values(a.id,'REJECTED',actor.portal_user_id,now(),now())
   on conflict(application_key) do update set business_status='REJECTED',admin_decided_by=excluded.admin_decided_by,
    admin_decided_at=excluded.admin_decided_at,updated_at=now();
 elsif normalized='COUNTER_OFFER' then
  begin price:=(payload->>'price')::numeric; exception when others then price:=null; end;
  currency:=upper(btrim(coalesce(payload->>'currency','')));
  if price is null or price<=0 then raise exception 'INVALID_PRICE'; end if;
  if currency !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if a.status<>'DEAL_REGISTERED' then update portal_private.client_applications set status='UNDER_REVIEW',updated_at=now() where id=a.id; end if;
  insert into portal_private.owner_application_workflow(application_key,business_status,counter_price,counter_currency,counter_offer_used,
   client_counter_response,admin_decided_by,admin_decided_at,updated_at)
  values(a.id,'COUNTER_OFFERED',price,currency,true,null,actor.portal_user_id,now(),now())
  on conflict(application_key) do update set business_status='COUNTER_OFFERED',counter_price=excluded.counter_price,
   counter_currency=excluded.counter_currency,counter_offer_used=true,client_counter_response=null,
   admin_decided_by=excluded.admin_decided_by,admin_decided_at=excluded.admin_decided_at,updated_at=now();
 elsif normalized='RESOURCE_APPROVED' then
  if a.linked_deal_key is null then
   insert into portal_private.owner_application_workflow(application_key,business_status,supplier_approved_by,supplier_approved_at,updated_at)
    values(a.id,'SUPPLIER_APPROVED',actor.portal_user_id,now(),now())
    on conflict(application_key) do update set business_status='SUPPLIER_APPROVED',supplier_approved_by=excluded.supplier_approved_by,
     supplier_approved_at=excluded.supplier_approved_at,updated_at=now();
  else
   update portal_private.deals set business_status='EXECUTING',updated_at=now() where id=a.linked_deal_key
    and upper(business_status) in ('SUPPLIER_PENDING','REGISTERED','APPROVED');
   update portal_private.owner_application_workflow set business_status='DEAL',supplier_approved_by=actor.portal_user_id,
    supplier_approved_at=coalesce(supplier_approved_at,now()),finalized_at=coalesce(finalized_at,now()),updated_at=now()
    where application_key=a.id;
  end if;
 end if;

 insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
 values(actor.portal_user_id,'ADMIN','OWNER_APPLICATION_'||normalized,'APPLICATION',a.application_id,gen_random_uuid(),null,
  jsonb_build_object('owner_action_id',action_id,'authority_contract','OWNER_ADMIN_APPLICATION_BUSINESS_V2','payload',payload));
 perform set_config('rona.application_owner_action',coalesce(token_before,''),true);
 return jsonb_build_object('applicationId',a.application_id,'action',normalized,'ownerActionId',action_id,
  'authority','OWNER_ADMIN','actorPortalUserId',actor.portal_user_id);
end $$;
revoke all on function public.owner_r1_application_business_action_v2(text,text,jsonb) from public,anon,service_role;
grant execute on function public.owner_r1_application_business_action_v2(text,text,jsonb) to authenticated;

-- Keep the legacy resource RPC as a compatibility alias but bind it to the same Owner/Admin action contract.
create or replace function public.owner_r1_confirm_application_resource(p_application_id text)
returns jsonb language sql security definer set search_path='pg_catalog','public','portal_private','auth' as $$
 select public.owner_r1_application_business_action_v2(p_application_id,'RESOURCE_APPROVED','{}'::jsonb)
$$;
revoke all on function public.owner_r1_confirm_application_resource(text) from public,anon,service_role;
grant execute on function public.owner_r1_confirm_application_resource(text) to authenticated;

-- A rejected/cancelled row is not deletion authority by itself. The lifecycle executor may
-- physically retire it only when an immutable Owner/Admin decision proves the business cause.
alter function portal_private.application_retention_decision_v2(uuid) rename to application_retention_decision_owner_base_v2;
create function portal_private.application_retention_decision_v2(p_application_key uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare decision jsonb;
begin
 decision:=portal_private.application_retention_decision_owner_base_v2(p_application_key);
 if decision->>'decision' in ('DELETE','BLOCKED') and coalesce(decision->>'business_reason',decision->>'reason')
  in ('REJECTED_BY_BUSINESS_PROCESS','CANCELLED_BY_BUSINESS_PROCESS') then
  if not exists(select 1 from portal_private.client_application_owner_actions_v2 x
    where x.application_key=p_application_key and x.action_code in ('REJECT','RESOURCE_DENIED')) then
   return decision||jsonb_build_object('decision','BLOCKED','reason','OWNER_ADMIN_DECISION_PROVENANCE_REQUIRED');
  end if;
 end if;
 return decision;
end $$;

revoke all on function portal_private.application_retention_decision_owner_base_v2(uuid),
 portal_private.application_retention_decision_v2(uuid) from public,anon,authenticated,service_role;
