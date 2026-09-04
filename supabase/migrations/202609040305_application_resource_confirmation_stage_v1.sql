alter table portal_private.owner_application_workflow drop constraint if exists owner_application_workflow_business_status_check;
alter table portal_private.owner_application_workflow add constraint owner_application_workflow_business_status_check check (business_status = any (array['NEW'::text,'ACCEPTED'::text,'SUPPLIER_REVIEW'::text,'SUPPLIER_PENDING'::text,'COUNTER_OFFERED'::text,'CLIENT_COUNTER_ACCEPTED'::text,'REJECTED'::text,'SUPPLIER_APPROVED'::text,'DEAL'::text,'CANCELLED'::text]));

create or replace function portal_private.normalize_owner_application_resource_stage()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
begin
  if new.supplier_approved_at is null and new.business_status='SUPPLIER_REVIEW' then
    new.business_status:='SUPPLIER_PENDING';
  elsif new.supplier_approved_at is null and new.business_status='CLIENT_COUNTER_ACCEPTED' and new.client_counter_response='ACCEPTED' then
    new.business_status:='SUPPLIER_PENDING';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_normalize_owner_application_resource_stage on portal_private.owner_application_workflow;
create trigger trg_normalize_owner_application_resource_stage
before insert or update of business_status,client_counter_response,supplier_approved_at
on portal_private.owner_application_workflow
for each row execute function portal_private.normalize_owner_application_resource_stage();

update portal_private.owner_application_workflow
set business_status='SUPPLIER_PENDING',updated_at=now()
where business_status='SUPPLIER_REVIEW' and supplier_approved_at is null;

create or replace function public.owner_r1_confirm_application_resource(p_application_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  a record;
  v_prev text;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  select aa.id application_key,aa.application_id,aa.client_key,aa.contract_key,aa.status::text,
         aa.linked_deal_key,dd.deal_id,dd.business_status deal_status,
         w.business_status owner_status,w.supplier_approved_at
    into a
    from portal_private.client_applications aa
    left join portal_private.deals dd on dd.id=aa.linked_deal_key
    left join portal_private.owner_application_workflow w on w.application_key=aa.id
   where aa.application_id=p_application_id
   for update of aa
   limit 1;
  if a.application_key is null then raise exception using errcode='P0001',message='APPLICATION_NOT_FOUND'; end if;

  if a.supplier_approved_at is not null then
    return jsonb_build_object('applicationId',p_application_id,'state','RESOURCE_CONFIRMED','dealId',a.deal_id,'idempotent',true);
  end if;

  v_prev:=coalesce(a.owner_status,'NEW');

  if a.linked_deal_key is null then
    if a.status<>'ACCEPTED_AWAITING_DEAL_REGISTRATION' or v_prev not in ('SUPPLIER_PENDING','SUPPLIER_REVIEW','CLIENT_COUNTER_ACCEPTED') then
      raise exception using errcode='P0001',message='APPLICATION_NOT_READY_FOR_RESOURCE_CONFIRMATION';
    end if;
    insert into portal_private.owner_application_workflow(application_key,business_status,supplier_approved_by,supplier_approved_at,updated_at)
    values(a.application_key,'SUPPLIER_APPROVED',v_actor,now(),now())
    on conflict(application_key) do update
      set business_status='SUPPLIER_APPROVED',supplier_approved_by=excluded.supplier_approved_by,
          supplier_approved_at=excluded.supplier_approved_at,updated_at=now();
    perform portal_private.owner_r1_emit_event(v_actor,'APPLICATION_RESOURCE_CONFIRMED','APPLICATION',p_application_id,'RESOURCE_CONFIRMED',v_prev,'SUPPLIER_APPROVED','OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum,a.client_key,a.contract_key,null,a.application_key,null);
    return jsonb_build_object('applicationId',p_application_id,'state','RESOURCE_CONFIRMED','nextState','READY_FOR_DEAL','dealId',null);
  end if;

  update portal_private.deals
     set business_status='EXECUTING',updated_at=now()
   where id=a.linked_deal_key and upper(business_status) in ('SUPPLIER_PENDING','REGISTERED','APPROVED');
  update portal_private.owner_application_workflow
     set business_status='DEAL',supplier_approved_by=v_actor,supplier_approved_at=now(),finalized_at=now(),updated_at=now()
   where application_key=a.application_key;
  perform portal_private.owner_r1_emit_event(v_actor,'APPLICATION_RESOURCE_CONFIRMED','APPLICATION',p_application_id,'RESOURCE_CONFIRMED',v_prev,'DEAL','OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum,a.client_key,a.contract_key,a.linked_deal_key,a.application_key,a.deal_id);
  return jsonb_build_object('applicationId',p_application_id,'state','RESOURCE_CONFIRMED','dealId',a.deal_id);
end
$function$;

revoke all on function public.owner_r1_confirm_application_resource(text) from public;
grant execute on function public.owner_r1_confirm_application_resource(text) to authenticated,service_role;
comment on function public.owner_r1_confirm_application_resource(text) is 'Owner Admin: confirm resource for an accepted application. Pre-deal confirmation moves workflow to SUPPLIER_APPROVED; linked-deal confirmation preserves legacy execution transition.';
