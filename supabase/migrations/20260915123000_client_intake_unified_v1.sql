-- P1 Client Intake V1 candidate. DO NOT apply outside reviewed release procedure.
-- Stage 2.1 release-blocker correction: PostgreSQL 17 executable, production enums,
-- automatic routing, self-healing reconciliation, and LK projection contracts.

create table if not exists portal_private.client_intake_routing_registry_v1 (
  policy_key text primary key,
  source_kind text not null check (source_kind in ('CLIENT_APPLICATION','PORTAL_REVERSE_EVENT')),
  actionable_type text not null,
  responsible_role portal_private.staff_functional_role_enum not null,
  task_required boolean not null default true,
  client_visible boolean not null default true,
  admin_visible boolean not null default true,
  acknowledgement_required boolean not null default true,
  priority integer not null default 100,
  effective_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(source_kind,actionable_type,effective_at)
);
insert into portal_private.client_intake_routing_registry_v1
  (policy_key,source_kind,actionable_type,responsible_role,task_required,client_visible,admin_visible,acknowledgement_required,priority,effective_at)
values
  ('CLIENT_APPLICATION_PUBLISHED_PRICE_V1','CLIENT_APPLICATION','PUBLISHED_PRICE_APPLICATION','OPERATIONS_DIRECTOR',true,true,true,true,100,'2026-09-15 00:00:00+00'),
  ('CLIENT_APPLICATION_PROPOSED_PRICE_V1','CLIENT_APPLICATION','CLIENT_PROPOSED_PRICE_APPLICATION','OPERATIONS_DIRECTOR',true,true,true,true,100,'2026-09-15 00:00:00+00'),
  ('DELIVERED_PRICE_CALCULATION_REQUEST_V1','PORTAL_REVERSE_EVENT','DELIVERED_PRICE_CALCULATION_REQUEST_V1','OPERATIONS_DIRECTOR',true,true,true,true,120,'2026-09-15 00:00:00+00'),
  ('COMMERCIAL_TERMS_REQUEST_V1','PORTAL_REVERSE_EVENT','COMMERCIAL_TERMS_REQUEST_V1','OPERATIONS_DIRECTOR',true,true,true,true,110,'2026-09-15 00:00:00+00'),
  ('CLIENT_MESSAGE_SUBMIT_V1','PORTAL_REVERSE_EVENT','CLIENT_MESSAGE_SUBMIT','OPERATIONS_DIRECTOR',true,true,true,true,50,'2026-09-15 00:00:00+00'),
  ('CLIENT_CLAIM_SUBMIT_V1','PORTAL_REVERSE_EVENT','CLIENT_CLAIM_SUBMIT','LEGAL',true,true,true,true,100,'2026-09-15 00:00:00+00'),
  ('CLIENT_PAYMENT_PROOF_SUBMIT_V1','PORTAL_REVERSE_EVENT','CLIENT_PAYMENT_PROOF_SUBMIT','ACCOUNTING',true,true,true,true,100,'2026-09-15 00:00:00+00'),
  ('CLIENT_DOCUMENT_ACK_V1','PORTAL_REVERSE_EVENT','CLIENT_DOCUMENT_ACK','LEGAL',true,true,true,true,90,'2026-09-15 00:00:00+00')
on conflict(policy_key) do nothing;

create table if not exists portal_private.client_intake_v1 (
  intake_id uuid primary key default pg_catalog.gen_random_uuid(), durable_id uuid not null unique,
  source_kind text not null check (source_kind in ('CLIENT_APPLICATION','PORTAL_REVERSE_EVENT')), source_record_id text not null,
  source_internal_key uuid, source_event_type text not null, actionable_type text not null, source_idempotency_key text,
  source_fingerprint text not null, source_payload jsonb not null default '{}'::jsonb, source_submitted_at timestamptz not null,
  client_key uuid, contract_key uuid, deal_key uuid, client_visible boolean not null, admin_visible boolean not null,
  routing_policy_key text references portal_private.client_intake_routing_registry_v1(policy_key),
  responsible_role portal_private.staff_functional_role_enum, task_required boolean not null default false,
  acknowledgement_required boolean not null default false,
  routing_state text not null check (routing_state in ('PENDING','QUEUED','PROCESSING','APPLIED','FAILED_RETRYABLE','DEAD_LETTER')),
  routing_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(source_kind,source_record_id)
);
create unique index if not exists uq_client_intake_source_idempotency_v1 on portal_private.client_intake_v1(source_kind,source_idempotency_key) where source_idempotency_key is not null;
create table if not exists portal_private.client_intake_routing_outbox_v1 (
  outbox_id uuid primary key default pg_catalog.gen_random_uuid(), intake_id uuid not null references portal_private.client_intake_v1(intake_id) on delete restrict,
  stage_key text not null, state text not null check (state in ('PENDING','QUEUED','PROCESSING','APPLIED','FAILED_RETRYABLE','DEAD_LETTER')),
  attempt_count integer not null default 0, max_attempts integer not null default 5 check (max_attempts>0), last_error_code text,last_error_text text,
  next_attempt_at timestamptz,processing_started_at timestamptz,applied_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(intake_id,stage_key)
);
create table if not exists portal_private.client_intake_task_links_v1 (
  intake_id uuid not null references portal_private.client_intake_v1(intake_id) on delete restrict,stage_key text not null,
  staff_task_id uuid not null references portal_private.staff_tasks(id) on delete restrict,linked_at timestamptz not null default now(),primary key(intake_id,stage_key),unique(staff_task_id)
);
create table if not exists portal_private.client_intake_corrections_v1 (
  correction_id uuid primary key default pg_catalog.gen_random_uuid(),intake_id uuid not null references portal_private.client_intake_v1(intake_id) on delete restrict,
  field_path text not null,source_value jsonb not null,corrected_value jsonb not null,correction_authority text not null,correction_reason text not null,
  corrected_at timestamptz not null default now(),source_record text not null,created_at timestamptz not null default now()
);
create index if not exists ix_client_intake_corrections_current_v1 on portal_private.client_intake_corrections_v1(intake_id,field_path,corrected_at desc,correction_id desc);
create table if not exists portal_private.client_intake_audit_v1 (
  audit_id uuid primary key default pg_catalog.gen_random_uuid(),intake_id uuid references portal_private.client_intake_v1(intake_id) on delete restrict,
  event_type text not null,stage_key text,details jsonb not null default '{}'::jsonb,occurred_at timestamptz not null default now()
);

create or replace function portal_private.guard_client_intake_correction_append_only_v1() returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $$ begin raise exception 'CLIENT_INTAKE_CORRECTION_APPEND_ONLY'; end $$;
drop trigger if exists guard_client_intake_correction_append_only_v1 on portal_private.client_intake_corrections_v1;
create trigger guard_client_intake_correction_append_only_v1 before update or delete on portal_private.client_intake_corrections_v1 for each row execute function portal_private.guard_client_intake_correction_append_only_v1();

create or replace function portal_private.client_intake_actionable_type_v1(p_source_kind text,p_source_event_type text,p_source_payload jsonb)
returns text language sql immutable set search_path='pg_catalog','portal_private' as $$
  select case
    when p_source_kind='CLIENT_APPLICATION' and upper(coalesce(p_source_payload->>'price_mode',''))='ACCEPT_PUBLISHED_PRICE' then 'PUBLISHED_PRICE_APPLICATION'
    when p_source_kind='CLIENT_APPLICATION' and upper(coalesce(p_source_payload->>'price_mode',''))='CLIENT_PROPOSED_PRICE' then 'CLIENT_PROPOSED_PRICE_APPLICATION'
    when p_source_kind='CLIENT_APPLICATION' then 'UNSUPPORTED_PRICE_MODE'
    when p_source_kind='PORTAL_REVERSE_EVENT' and nullif(upper(trim(coalesce(p_source_payload->>'message_type',''))),'') is not null then upper(trim(p_source_payload->>'message_type'))
    else upper(trim(coalesce(p_source_event_type,'UNKNOWN_CLIENT_ACTIONABLE'))) end
$$;
create or replace function portal_private.client_intake_policy_v1(p_source_kind text,p_actionable_type text,p_as_of timestamptz default now())
returns portal_private.client_intake_routing_registry_v1 language sql stable set search_path='pg_catalog','portal_private' as $$
  select p.* from portal_private.client_intake_routing_registry_v1 p where p.source_kind=p_source_kind and p.actionable_type=p_actionable_type and p.effective_at<=p_as_of and (p.disabled_at is null or p.disabled_at>p_as_of) order by p.priority desc,p.effective_at desc,p.policy_key desc limit 1
$$;
create or replace function portal_private.client_intake_effective_payload_v1(p_intake_id uuid)
returns jsonb language plpgsql stable set search_path='pg_catalog','portal_private' as $$
declare v jsonb;c record;
begin
  select source_payload into v from portal_private.client_intake_v1 where intake_id=p_intake_id;
  if v is null then return null; end if;
  for c in select field_path,corrected_value from portal_private.client_intake_corrections_v1 where intake_id=p_intake_id order by corrected_at,correction_id loop
    if c.field_path like 'payload.%' then v:=pg_catalog.jsonb_set(v,pg_catalog.string_to_array(pg_catalog.substr(c.field_path,9),'.'),c.corrected_value,true);
    else v:=pg_catalog.jsonb_set(v,pg_catalog.string_to_array(c.field_path,'.'),c.corrected_value,true); end if;
  end loop;
  return v;
end $$;

create or replace function portal_private.ensure_client_intake_v1(
  p_source_kind text,p_source_record_id text,p_source_internal_key uuid,p_source_event_type text,p_source_idempotency_key text,p_source_payload jsonb,p_source_submitted_at timestamptz,
  p_client_key uuid,p_contract_key uuid,p_deal_key uuid,p_source_fingerprint text
) returns uuid language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare v_type text;v_policy portal_private.client_intake_routing_registry_v1;v_intake uuid;v_existing portal_private.client_intake_v1;v_state text;
begin
  if coalesce(trim(p_source_record_id),'')='' or coalesce(trim(p_source_kind),'')='' then raise exception 'CLIENT_INTAKE_SOURCE_ID_REQUIRED'; end if;
  select * into v_existing from portal_private.client_intake_v1 where source_kind=p_source_kind and source_record_id=p_source_record_id;
  if found then if v_existing.source_fingerprint<>p_source_fingerprint then raise exception 'CLIENT_INTAKE_SOURCE_IMMUTABLE_CONFLICT'; end if; return v_existing.intake_id; end if;
  if nullif(trim(coalesce(p_source_idempotency_key,'')),'') is not null then
    select * into v_existing from portal_private.client_intake_v1 where source_kind=p_source_kind and source_idempotency_key=p_source_idempotency_key;
    if found then if v_existing.source_fingerprint<>p_source_fingerprint then raise exception 'CLIENT_INTAKE_IDEMPOTENCY_CONFLICT'; end if; return v_existing.intake_id; end if;
  end if;
  v_type:=portal_private.client_intake_actionable_type_v1(p_source_kind,p_source_event_type,coalesce(p_source_payload,'{}'::jsonb));
  select * into v_policy from portal_private.client_intake_policy_v1(p_source_kind,v_type,now());
  v_state:=case when v_policy.policy_key is null then 'DEAD_LETTER' else 'PENDING' end;
  insert into portal_private.client_intake_v1(durable_id,source_kind,source_record_id,source_internal_key,source_event_type,actionable_type,source_idempotency_key,source_fingerprint,source_payload,source_submitted_at,client_key,contract_key,deal_key,client_visible,admin_visible,routing_policy_key,responsible_role,task_required,acknowledgement_required,routing_state,routing_reason)
  values(pg_catalog.gen_random_uuid(),p_source_kind,p_source_record_id,p_source_internal_key,upper(p_source_event_type),v_type,nullif(trim(p_source_idempotency_key),''),p_source_fingerprint,coalesce(p_source_payload,'{}'::jsonb),coalesce(p_source_submitted_at,now()),p_client_key,p_contract_key,p_deal_key,coalesce(v_policy.client_visible,true),coalesce(v_policy.admin_visible,true),v_policy.policy_key,v_policy.responsible_role,coalesce(v_policy.task_required,false),coalesce(v_policy.acknowledgement_required,false),v_state,case when v_policy.policy_key is null then 'ROUTING_POLICY_MISSING' end)
  returning intake_id into v_intake;
  insert into portal_private.client_intake_routing_outbox_v1(intake_id,stage_key,state,last_error_code) values(v_intake,'RESPONSIBLE_ROLE_ROUTING',v_state,case when v_policy.policy_key is null then 'ROUTING_POLICY_MISSING' end) on conflict(intake_id,stage_key) do nothing;
  insert into portal_private.client_intake_audit_v1(intake_id,event_type,stage_key,details) values(v_intake,'INTAKE_CREATED','RESPONSIBLE_ROLE_ROUTING',pg_catalog.jsonb_build_object('source_kind',p_source_kind,'source_record_id',p_source_record_id,'actionable_type',v_type,'policy_key',v_policy.policy_key));
  return v_intake;
end $$;

create or replace function portal_private.ensure_client_intake_from_reverse_event_v1(p_event_id text)
returns uuid language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare r portal_private.portal_reverse_events;v_payload jsonb;v_fp text;
begin
  select * into r from portal_private.portal_reverse_events where event_id=p_event_id;if not found then raise exception 'CLIENT_INTAKE_REVERSE_EVENT_NOT_FOUND';end if;
  if r.actor_role<>'CLIENT'::portal_private.portal_role_enum or r.event_type not like 'CLIENT_%' then return null;end if;
  if r.processing_state in ('REJECTED','FAILED','DEAD_LETTER') or lower(coalesce(r.payload->>'qa','false')) in ('true','1','yes') or lower(coalesce(r.payload->>'qa_only','false')) in ('true','1','yes') or r.authority_domain ilike 'QA%' then return null;end if;
  v_payload:=coalesce(r.payload,'{}'::jsonb);
  v_fp:=pg_catalog.encode(extensions.digest(pg_catalog.concat_ws('|','PORTAL_REVERSE_EVENT',r.event_id,r.event_type,coalesce(r.idempotency_key,''),v_payload::text),'sha256'),'hex');
  return portal_private.ensure_client_intake_v1('PORTAL_REVERSE_EVENT',r.event_id,r.id,r.event_type,r.idempotency_key,v_payload,r.created_at,r.client_key,r.contract_key,r.deal_key,v_fp);
end $$;
create or replace function portal_private.ensure_client_intake_from_application_v1(p_application_id text)
returns uuid language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications;v_payload jsonb;v_fp text;
begin
  select * into a from portal_private.client_applications where application_id=p_application_id;if not found then raise exception 'CLIENT_INTAKE_APPLICATION_NOT_FOUND';end if;
  v_payload:=pg_catalog.jsonb_build_object('application_id',a.application_id,'price_mode',a.price_mode::text,'quantity_tonnes',a.quantity_tonnes,'product',a.product,'destination',a.destination,'source_publication_id',a.source_publication_id,'source_publication_item_id',a.source_publication_item_id);
  v_fp:=pg_catalog.encode(extensions.digest(pg_catalog.concat_ws('|','CLIENT_APPLICATION',a.application_id,a.price_mode::text,a.quantity_tonnes::text,coalesce(a.source_publication_item_id::text,'')),'sha256'),'hex');
  return portal_private.ensure_client_intake_v1('CLIENT_APPLICATION',a.application_id,a.id,'CLIENT_APPLICATION_SUBMIT',a.application_id,v_payload,coalesce(a.submitted_at,a.created_at),a.client_key,a.contract_key,a.linked_deal_key,v_fp);
end $$;

create or replace function portal_private.process_client_intake_outbox_v1(p_limit integer default 100)
returns table(intake_id uuid,stage_key text,state text,staff_task_id uuid) language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare o record;i portal_private.client_intake_v1;p portal_private.client_intake_routing_registry_v1;t portal_private.staff_tasks;v_task_id text;
begin
  for o in select * from portal_private.client_intake_routing_outbox_v1 where state in ('PENDING','QUEUED','FAILED_RETRYABLE') and (next_attempt_at is null or next_attempt_at<=now()) order by created_at,outbox_id for update skip locked limit greatest(1,least(coalesce(p_limit,100),1000)) loop
    update portal_private.client_intake_routing_outbox_v1 set state='PROCESSING',attempt_count=attempt_count+1,processing_started_at=now(),updated_at=now() where outbox_id=o.outbox_id;
    begin
      select * into i from portal_private.client_intake_v1 where intake_id=o.intake_id for update;
      select * into p from portal_private.client_intake_policy_v1(i.source_kind,i.actionable_type,now());if p.policy_key is null then raise exception 'ROUTING_POLICY_MISSING';end if;
      update portal_private.client_intake_v1 set routing_policy_key=p.policy_key,responsible_role=p.responsible_role,task_required=p.task_required,acknowledgement_required=p.acknowledgement_required,client_visible=p.client_visible,admin_visible=p.admin_visible,routing_state='PROCESSING',routing_reason=null,updated_at=now() where intake_id=i.intake_id;
      if p.task_required then
        select st.* into t from portal_private.staff_tasks st where (i.source_kind='PORTAL_REVERSE_EVENT' and st.source_reverse_event_key=i.source_internal_key) or (i.source_kind='CLIENT_APPLICATION' and st.application_key=i.source_internal_key) order by st.created_at asc limit 1;
        if not found then
          v_task_id:='TASK-CIT-'||upper(pg_catalog.substr(pg_catalog.md5(i.intake_id::text||':'||o.stage_key),1,24));
          insert into portal_private.staff_tasks(task_id,title,status,priority,authority_domain,assigned_functional_role,client_key,contract_key,application_key,deal_key,source_reverse_event_key,source_type,source_object_id,source_version,qa_only)
          values(v_task_id,'Client Intake: '||i.actionable_type,'NEW','NORMAL','CLIENT_INTAKE',p.responsible_role,i.client_key,i.contract_key,case when i.source_kind='CLIENT_APPLICATION' then i.source_internal_key end,i.deal_key,case when i.source_kind='PORTAL_REVERSE_EVENT' then i.source_internal_key end,'CLIENT_INTAKE',i.intake_id::text,'RONA_CLIENT_INTAKE_V1',false) on conflict(task_id) do nothing;
          select * into t from portal_private.staff_tasks where task_id=v_task_id;
        end if;
        insert into portal_private.client_intake_task_links_v1(intake_id,stage_key,staff_task_id) values(i.intake_id,o.stage_key,t.id) on conflict(intake_id,stage_key) do nothing;
      end if;
      update portal_private.client_intake_routing_outbox_v1 set state='APPLIED',last_error_code=null,last_error_text=null,next_attempt_at=null,applied_at=now(),updated_at=now() where outbox_id=o.outbox_id;
      update portal_private.client_intake_v1 set routing_state='APPLIED',routing_reason=null,updated_at=now() where intake_id=i.intake_id;
      insert into portal_private.client_intake_audit_v1(intake_id,event_type,stage_key,details) values(i.intake_id,'ROUTING_APPLIED',o.stage_key,pg_catalog.jsonb_build_object('policy_key',p.policy_key,'responsible_role',p.responsible_role,'task_id',t.task_id));
    exception when others then
      update portal_private.client_intake_routing_outbox_v1 set state=case when attempt_count>=max_attempts then 'DEAD_LETTER' else 'FAILED_RETRYABLE' end,last_error_code=case when sqlerrm like '%ROUTING_POLICY_MISSING%' then 'ROUTING_POLICY_MISSING' else 'ROUTING_WORKER_FAILURE' end,last_error_text=left(sqlerrm,500),next_attempt_at=case when attempt_count>=max_attempts then null else now()+interval '1 minute' end,updated_at=now() where outbox_id=o.outbox_id;
      update portal_private.client_intake_v1 i2 set routing_state=q.state,routing_reason=q.last_error_code,updated_at=now() from portal_private.client_intake_routing_outbox_v1 q where q.outbox_id=o.outbox_id and i2.intake_id=q.intake_id;
    end;
  end loop;
  return query select q.intake_id,q.stage_key,q.state,l.staff_task_id from portal_private.client_intake_routing_outbox_v1 q left join portal_private.client_intake_task_links_v1 l using(intake_id,stage_key) order by q.created_at;
end $$;

create or replace function portal_private.client_intake_outbox_auto_consumer_v1() returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$ begin if new.state in ('PENDING','QUEUED','FAILED_RETRYABLE') then perform portal_private.process_client_intake_outbox_v1(1);end if;return new;end $$;
drop trigger if exists client_intake_outbox_auto_consumer_v1 on portal_private.client_intake_routing_outbox_v1;
create trigger client_intake_outbox_auto_consumer_v1 after insert on portal_private.client_intake_routing_outbox_v1 for each row execute function portal_private.client_intake_outbox_auto_consumer_v1();
create or replace function portal_private.client_intake_reverse_event_trigger_v1() returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $$ begin if new.actor_role='CLIENT'::portal_private.portal_role_enum and new.event_type like 'CLIENT_%' then perform portal_private.ensure_client_intake_from_reverse_event_v1(new.event_id);end if;return new;end $$;
drop trigger if exists client_intake_reverse_event_v1 on portal_private.portal_reverse_events;
create trigger client_intake_reverse_event_v1 after insert on portal_private.portal_reverse_events for each row execute function portal_private.client_intake_reverse_event_trigger_v1();
create or replace function portal_private.client_intake_application_trigger_v1() returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $$ begin perform portal_private.ensure_client_intake_from_application_v1(new.application_id);return new;end $$;
drop trigger if exists client_intake_application_v1 on portal_private.client_applications;
create trigger client_intake_application_v1 after insert on portal_private.client_applications for each row execute function portal_private.client_intake_application_trigger_v1();

create or replace function portal_private.enqueue_reverse_event_staff_task() returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $$
declare tid text;role portal_private.staff_functional_role_enum;
begin
  if new.processing_state in ('REJECTED','FAILED','DEAD_LETTER') or lower(coalesce(new.payload->>'qa','false')) in ('true','1','yes') or lower(coalesce(new.payload->>'qa_only','false')) in ('true','1','yes') or new.authority_domain ilike 'QA%' then return new;end if;
  if new.actor_role='CLIENT'::portal_private.portal_role_enum and new.event_type like 'CLIENT_%' then perform portal_private.ensure_client_intake_from_reverse_event_v1(new.event_id);return new;end if;
  role:=portal_private.staff_role_for_reverse_event(new.event_type);tid:='TASK-EVT-'||replace(new.event_id,'PORTAL-EVT-','');
  insert into portal_private.staff_tasks(task_id,title,status,priority,authority_domain,assigned_functional_role,client_key,contract_key,deal_key,source_reverse_event_key,source_type,source_object_id,source_version,qa_only,created_by)
  values(tid,'Событие портала: '||new.event_type,'NEW','NORMAL',new.authority_domain,role,new.client_key,new.contract_key,new.deal_key,new.id,'PORTAL_REVERSE_EVENT',new.event_id,new.source_version,false,new.actor_user_id) on conflict(source_reverse_event_key) do nothing;
  update portal_private.portal_reverse_events set processing_state='QUEUED',updated_at=now() where id=new.id and processing_state in ('RECEIVED','VALIDATED');return new;
end $$;

create or replace function portal_private.reconcile_client_intake_v1(p_limit integer default 500,p_stuck_interval interval default interval '5 minutes') returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare r record;
begin
  for r in select event_id from portal_private.portal_reverse_events where actor_role='CLIENT'::portal_private.portal_role_enum and event_type like 'CLIENT_%' and processing_state not in ('REJECTED','FAILED','DEAD_LETTER') order by created_at limit greatest(1,least(coalesce(p_limit,500),5000)) loop perform portal_private.ensure_client_intake_from_reverse_event_v1(r.event_id);end loop;
  for r in select application_id from portal_private.client_applications where submitted_at is not null order by created_at limit greatest(1,least(coalesce(p_limit,500),5000)) loop perform portal_private.ensure_client_intake_from_application_v1(r.application_id);end loop;
  insert into portal_private.client_intake_routing_outbox_v1(intake_id,stage_key,state,last_error_code,next_attempt_at)
  select i.intake_id,'RESPONSIBLE_ROLE_ROUTING',case when i.routing_policy_key is null then 'FAILED_RETRYABLE' else 'PENDING' end,case when i.routing_policy_key is null then 'ROUTING_POLICY_RECHECK' end,now() from portal_private.client_intake_v1 i
  where not exists(select 1 from portal_private.client_intake_routing_outbox_v1 q where q.intake_id=i.intake_id and q.stage_key='RESPONSIBLE_ROLE_ROUTING') on conflict(intake_id,stage_key) do nothing;
  update portal_private.client_intake_routing_outbox_v1 q set state='FAILED_RETRYABLE',last_error_code='STUCK_PROCESSING_RECOVERED',next_attempt_at=now(),updated_at=now() where q.state='PROCESSING' and coalesce(q.processing_started_at,q.updated_at)<now()-p_stuck_interval;
  update portal_private.client_intake_v1 i set routing_state='FAILED_RETRYABLE',routing_reason='STUCK_PROCESSING_RECOVERED',updated_at=now() from portal_private.client_intake_routing_outbox_v1 q where q.intake_id=i.intake_id and q.state='FAILED_RETRYABLE' and q.last_error_code='STUCK_PROCESSING_RECOVERED';
  update portal_private.client_intake_v1 set client_visible=true,admin_visible=true,updated_at=now() where not client_visible or not admin_visible;
  update portal_private.client_intake_routing_outbox_v1 q set state='FAILED_RETRYABLE',last_error_code='REQUIRED_TASK_MISSING',next_attempt_at=now(),updated_at=now() from portal_private.client_intake_v1 i where q.intake_id=i.intake_id and q.stage_key='RESPONSIBLE_ROLE_ROUTING' and q.state='APPLIED' and i.task_required and not exists(select 1 from portal_private.client_intake_task_links_v1 l where l.intake_id=i.intake_id and l.stage_key=q.stage_key);
  update portal_private.client_intake_routing_outbox_v1 set next_attempt_at=now(),updated_at=now() where state='FAILED_RETRYABLE' and (next_attempt_at is null or next_attempt_at>now());
  perform portal_private.process_client_intake_outbox_v1(p_limit);
  return (select pg_catalog.jsonb_build_object('actionable_client_intake_total',count(*),'unrouted_client_intake_count',count(*) filter(where routing_state<>'APPLIED'),'client_invisible_intake_count',count(*) filter(where not client_visible),'admin_invisible_intake_count',count(*) filter(where not admin_visible),'dual_invisible_actionable_intake_count',count(*) filter(where not client_visible and not admin_visible),'stuck_intake_count',(select count(*) from portal_private.client_intake_routing_outbox_v1 where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-p_stuck_interval),'oldest_stuck_intake_age',(select max(now()-coalesce(processing_started_at,updated_at)) from portal_private.client_intake_routing_outbox_v1 where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-p_stuck_interval)) from portal_private.client_intake_v1);
end $$;
create or replace function portal_private.client_intake_reconciliation_tick_v1() returns jsonb language sql security definer set search_path='pg_catalog','portal_private' as $$ select portal_private.reconcile_client_intake_v1(500,interval '5 minutes') $$;

create or replace view portal_private.client_intake_client_projection_v1 as select i.intake_id,i.durable_id,i.source_kind,i.source_record_id as source_id,i.actionable_type,i.routing_state as status,i.routing_reason,i.responsible_role,i.source_submitted_at as submitted_at,portal_private.client_intake_effective_payload_v1(i.intake_id) as effective_payload,i.client_key,i.contract_key,i.deal_key,i.created_at,i.updated_at from portal_private.client_intake_v1 i where i.client_visible=true;
create or replace view portal_private.client_intake_admin_projection_v1 as select i.intake_id,i.durable_id,i.source_kind,i.source_record_id as source_id,i.actionable_type,i.routing_state as status,i.routing_reason,i.responsible_role,i.task_required,i.acknowledgement_required,i.source_submitted_at as submitted_at,portal_private.client_intake_effective_payload_v1(i.intake_id) as effective_payload,i.client_key,i.contract_key,i.deal_key,i.created_at,i.updated_at from portal_private.client_intake_v1 i where i.admin_visible=true;
create or replace function portal_private.client_intake_projection_for_lk_v1(p_audience text,p_client_id text default null,p_contract_id text default null)
returns table(intake_id uuid,durable_id uuid,source_kind text,source_id text,actionable_type text,status text,routing_reason text,responsible_role text,submitted_at timestamptz,effective_payload jsonb,client_id text,contract_id text,deal_id text)
language sql stable security definer set search_path='pg_catalog','portal_private' as $$
  select i.intake_id,i.durable_id,i.source_kind,i.source_record_id,i.actionable_type,i.routing_state,i.routing_reason,i.responsible_role::text,i.source_submitted_at,portal_private.client_intake_effective_payload_v1(i.intake_id),cl.client_id,ct.contract_id,d.deal_id
  from portal_private.client_intake_v1 i left join portal_private.clients cl on cl.id=i.client_key left join portal_private.contracts ct on ct.id=i.contract_key left join portal_private.deals d on d.id=i.deal_key
  where case upper(coalesce(p_audience,'')) when 'CLIENT' then i.client_visible when 'ADMIN' then i.admin_visible else false end and (p_client_id is null or cl.client_id=p_client_id) and (p_contract_id is null or ct.contract_id=p_contract_id)
  order by i.source_submitted_at desc,i.created_at desc
$$;
create or replace function portal_private.client_intake_submit_contract_v1(p_source_kind text,p_source_id text)
returns table(intake_id uuid,durable_id uuid,source_id text,submitted_at timestamptz,status text) language sql stable security definer set search_path='pg_catalog','portal_private' as $$ select i.intake_id,i.durable_id,i.source_record_id,i.source_submitted_at,i.routing_state from portal_private.client_intake_v1 i where i.source_kind=p_source_kind and i.source_record_id=p_source_id limit 1 $$;
create or replace view portal_private.client_intake_metrics_v1 as
select count(*)::bigint as actionable_client_intake_total,count(*) filter(where routing_state<>'APPLIED')::bigint as unrouted_client_intake_count,count(*) filter(where not client_visible)::bigint as client_invisible_intake_count,count(*) filter(where not admin_visible)::bigint as admin_invisible_intake_count,count(*) filter(where not client_visible and not admin_visible)::bigint as dual_invisible_actionable_intake_count,(select count(*) from portal_private.client_intake_routing_outbox_v1 where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-interval '5 minutes')::bigint as stuck_intake_count,(select max(now()-coalesce(processing_started_at,updated_at)) from portal_private.client_intake_routing_outbox_v1 where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-interval '5 minutes') as oldest_stuck_intake_age from portal_private.client_intake_v1;

do $client_intake_cron$
begin
  if exists(select 1 from pg_catalog.pg_namespace where nspname='cron') and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='cron' and p.proname='schedule') then
    perform cron.schedule('rona-client-intake-reconcile-v1','*/2 * * * *','select portal_private.client_intake_reconciliation_tick_v1();');
  end if;
end
$client_intake_cron$;

revoke all on portal_private.client_intake_v1,portal_private.client_intake_routing_registry_v1,portal_private.client_intake_routing_outbox_v1,portal_private.client_intake_task_links_v1,portal_private.client_intake_corrections_v1,portal_private.client_intake_audit_v1 from public,anon,authenticated;
revoke all on portal_private.client_intake_client_projection_v1,portal_private.client_intake_admin_projection_v1,portal_private.client_intake_metrics_v1 from public,anon,authenticated;
revoke all on function portal_private.client_intake_projection_for_lk_v1(text,text,text) from public,anon,authenticated;
revoke all on function portal_private.client_intake_submit_contract_v1(text,text) from public,anon,authenticated;
