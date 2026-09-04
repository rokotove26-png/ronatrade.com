do $$
declare v_owner uuid;
begin
  select pu.id into v_owner
  from portal_private.portal_users pu
  join portal_private.staff_user_roles sur on sur.user_id=pu.id
  where pu.login_name='rokotove'
    and pu.status='ACTIVE'::portal_private.portal_user_status_enum
    and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and sur.functional_role='SYSTEM_ADMIN'::portal_private.staff_functional_role_enum
    and sur.status='ACTIVE'::portal_private.binding_status_enum
    and sur.revoked_at is null
  limit 1;
  if v_owner is null then raise exception 'ACTIVE_OWNER_ADMIN_REQUIRED'; end if;
  insert into portal_private.staff_user_roles(user_id,functional_role,status,granted_at,granted_by,reason,qa_only)
  values(v_owner,'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum,'ACTIVE'::portal_private.binding_status_enum,now(),v_owner,'Owner-authorized operational deal registration bridge',false)
  on conflict(user_id,functional_role) do update set status='ACTIVE'::portal_private.binding_status_enum,granted_at=coalesce(portal_private.staff_user_roles.granted_at,now()),granted_by=v_owner,revoked_at=null,revoked_by=null,reason='Owner-authorized operational deal registration bridge',qa_only=false,updated_at=now();
end $$;

create or replace function portal_private.register_deal_on_approved_application_resend_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare v_actor uuid; v_deal_id text;
begin
  if new.status <> 'ACCEPTED_AWAITING_DEAL_REGISTRATION'::portal_private.application_status_enum or new.linked_deal_key is not null then return new; end if;
  if not exists(select 1 from portal_private.owner_application_workflow w where w.application_key=new.id and w.business_status='SUPPLIER_APPROVED' and w.supplier_approved_at is not null) then return new; end if;
  v_actor:=new.decision_by;
  if v_actor is null or not exists(select 1 from portal_private.staff_user_roles s where s.user_id=v_actor and s.functional_role='OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum and s.status='ACTIVE'::portal_private.binding_status_enum and s.revoked_at is null) then raise exception 'OPERATIONS_DEAL_REGISTRATION_ACTOR_REQUIRED'; end if;
  select r.deal_id into v_deal_id from portal_private.server_executive_register_deal_v12(v_actor,'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum,new.application_id,gen_random_uuid(),null) r limit 1;
  return new;
end $$;

drop trigger if exists trg_register_deal_on_approved_application_resend_v1 on portal_private.client_applications;
create trigger trg_register_deal_on_approved_application_resend_v1
after update of status,decision_by on portal_private.client_applications
for each row execute function portal_private.register_deal_on_approved_application_resend_v1();

create or replace function portal_private.finalize_approved_workflow_after_deal_registration_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare v_deal_key uuid;
begin
  if old.business_status='SUPPLIER_APPROVED' and old.supplier_approved_at is not null and new.business_status in ('SUPPLIER_REVIEW','SUPPLIER_PENDING') then
    select a.linked_deal_key into v_deal_key from portal_private.client_applications a where a.id=new.application_key and a.status='DEAL_REGISTERED'::portal_private.application_status_enum;
    if v_deal_key is not null then
      update portal_private.deals set business_status='EXECUTING',updated_at=now() where id=v_deal_key and upper(business_status) in ('REGISTERED','SUPPLIER_PENDING','APPROVED');
      new.business_status:='DEAL';
      new.finalized_at:=coalesce(new.finalized_at,now());
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_finalize_approved_workflow_after_deal_registration_v1 on portal_private.owner_application_workflow;
create trigger trg_finalize_approved_workflow_after_deal_registration_v1
before update of business_status on portal_private.owner_application_workflow
for each row execute function portal_private.finalize_approved_workflow_after_deal_registration_v1();
