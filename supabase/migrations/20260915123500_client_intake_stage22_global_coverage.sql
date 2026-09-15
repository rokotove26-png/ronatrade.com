-- P1 Client Intake / Stage 2.2 candidate.
-- Global production-family coverage, source-state convergence, authoritative application linkage,
-- logical-application projection, and historical workflow reuse.
-- Candidate only: this migration is not applied to production by this PR.

alter table portal_private.client_intake_v1
  add column if not exists application_key uuid references portal_private.client_applications(id) on delete restrict;

create index if not exists ix_client_intake_application_key_v1
  on portal_private.client_intake_v1(application_key)
  where application_key is not null;

-- One logical application can have both a durable application intake and one or more durable
-- application-detail event intakes. They may intentionally link to the same existing business task.
alter table portal_private.client_intake_task_links_v1
  drop constraint if exists client_intake_task_links_v1_staff_task_id_key;
create index if not exists ix_client_intake_task_links_staff_task_v1
  on portal_private.client_intake_task_links_v1(staff_task_id);

insert into portal_private.client_intake_routing_registry_v1
  (policy_key,source_kind,actionable_type,responsible_role,task_required,client_visible,admin_visible,acknowledgement_required,priority,effective_at)
values
  ('APPLICATION_DETAILS_V5','PORTAL_REVERSE_EVENT','APPLICATION_DETAILS_V5','OPERATIONS_DIRECTOR',true,true,true,true,130,'2026-09-15 00:00:00+00')
on conflict(policy_key) do nothing;

create or replace function portal_private.resolve_client_intake_application_key_v1(p_source_internal_key uuid)
returns uuid
language plpgsql
stable
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  r record;
  v_application_key uuid;
  v_payload_application_id text;
begin
  select e.authority_target_type,e.authority_target_id,e.client_key,e.contract_key,e.payload
    into r
    from portal_private.portal_reverse_events e
   where e.id=p_source_internal_key;
  if not found then return null; end if;
  if upper(coalesce(r.authority_target_type,''))<>'APPLICATION' then return null; end if;
  if nullif(btrim(coalesce(r.authority_target_id,'')),'') is null then return null; end if;
  if r.client_key is null or r.contract_key is null then return null; end if;

  v_payload_application_id:=btrim(coalesce(r.payload->>'application_id',''));
  if v_payload_application_id<>'' and v_payload_application_id<>r.authority_target_id then
    return null;
  end if;

  select a.id
    into v_application_key
    from portal_private.client_applications a
   where a.application_id=r.authority_target_id
     and a.client_key=r.client_key
     and a.contract_key=r.contract_key
   limit 1;
  return v_application_key;
end
$$;

create or replace function portal_private.client_intake_application_requires_task_v1(p_application_key uuid)
returns boolean
language plpgsql
stable
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  v_status text;
  v_linked_deal_key uuid;
begin
  if p_application_key is null then return true; end if;
  select a.status::text,a.linked_deal_key
    into v_status,v_linked_deal_key
    from portal_private.client_applications a
   where a.id=p_application_key;
  if not found then raise exception 'CLIENT_INTAKE_APPLICATION_LINK_MISSING'; end if;

  -- A linked deal or any state beyond the initial review contour is evidence that the existing
  -- application/staff workflow has already advanced. Do not create a second business task.
  if v_linked_deal_key is not null then return false; end if;
  return v_status in ('SUBMITTED','UNDER_REVIEW');
end
$$;

create or replace function portal_private.ensure_client_intake_from_reverse_event_v1(p_event_id text)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  r portal_private.portal_reverse_events;
  v_payload jsonb;
  v_fp text;
  v_intake uuid;
  v_application_key uuid;
  v_actionable_type text;
  v_application_deal_key uuid;
begin
  select * into r from portal_private.portal_reverse_events where event_id=p_event_id;
  if not found then raise exception 'CLIENT_INTAKE_REVERSE_EVENT_NOT_FOUND'; end if;
  if r.actor_role<>'CLIENT'::portal_private.portal_role_enum or r.event_type not like 'CLIENT_%' then return null; end if;
  if r.processing_state in ('REJECTED','FAILED','DEAD_LETTER')
     or lower(coalesce(r.payload->>'qa','false')) in ('true','1','yes')
     or lower(coalesce(r.payload->>'qa_only','false')) in ('true','1','yes')
     or r.authority_domain ilike 'QA%' then return null; end if;

  v_payload:=coalesce(r.payload,'{}'::jsonb);
  v_actionable_type:=portal_private.client_intake_actionable_type_v1('PORTAL_REVERSE_EVENT',r.event_type,v_payload);
  v_fp:=pg_catalog.encode(
    extensions.digest(
      pg_catalog.concat_ws('|','PORTAL_REVERSE_EVENT',r.event_id,r.event_type,coalesce(r.idempotency_key,''),v_payload::text),
      'sha256'
    ),
    'hex'
  );
  v_intake:=portal_private.ensure_client_intake_v1(
    'PORTAL_REVERSE_EVENT',r.event_id,r.id,r.event_type,r.idempotency_key,v_payload,r.created_at,
    r.client_key,r.contract_key,r.deal_key,v_fp
  );

  v_application_key:=portal_private.resolve_client_intake_application_key_v1(r.id);
  if v_application_key is not null then
    select a.linked_deal_key into v_application_deal_key
      from portal_private.client_applications a where a.id=v_application_key;
    update portal_private.client_intake_v1 i
       set application_key=v_application_key,
           deal_key=coalesce(i.deal_key,v_application_deal_key),
           updated_at=now()
     where i.intake_id=v_intake
       and (i.application_key is distinct from v_application_key
            or (i.deal_key is null and v_application_deal_key is not null));
  elsif v_actionable_type like 'APPLICATION_DETAILS_%' then
    -- Application detail messages are only actionable when the authoritative target resolves to
    -- the same Client + Contract application. Keep the durable intake visible, but fail closed.
    update portal_private.client_intake_v1 i
       set routing_state='DEAD_LETTER',routing_reason='APPLICATION_LINK_MISSING',updated_at=now()
     where i.intake_id=v_intake;
    update portal_private.client_intake_routing_outbox_v1 q
       set state='DEAD_LETTER',last_error_code='APPLICATION_LINK_MISSING',last_error_text=null,
           next_attempt_at=null,updated_at=now()
     where q.intake_id=v_intake and q.stage_key='RESPONSIBLE_ROLE_ROUTING';
    insert into portal_private.client_intake_audit_v1(intake_id,event_type,stage_key,details)
    select v_intake,'APPLICATION_LINK_FAILED','RESPONSIBLE_ROLE_ROUTING',
           pg_catalog.jsonb_build_object(
             'authority_target_type',r.authority_target_type,
             'authority_target_id',r.authority_target_id,
             'client_key',r.client_key,
             'contract_key',r.contract_key
           )
     where not exists(
       select 1 from portal_private.client_intake_audit_v1 a
        where a.intake_id=v_intake and a.event_type='APPLICATION_LINK_FAILED'
     );
  end if;
  return v_intake;
end
$$;

create or replace function portal_private.ensure_client_intake_from_application_v1(p_application_id text)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  a portal_private.client_applications;
  v_payload jsonb;
  v_fp text;
  v_intake uuid;
begin
  select * into a from portal_private.client_applications where application_id=p_application_id;
  if not found then raise exception 'CLIENT_INTAKE_APPLICATION_NOT_FOUND'; end if;
  v_payload:=pg_catalog.jsonb_build_object(
    'application_id',a.application_id,
    'price_mode',a.price_mode::text,
    'quantity_tonnes',a.quantity_tonnes,
    'product',a.product,
    'destination',a.destination,
    'source_publication_id',a.source_publication_id,
    'source_publication_item_id',a.source_publication_item_id
  );
  v_fp:=pg_catalog.encode(
    extensions.digest(
      pg_catalog.concat_ws('|','CLIENT_APPLICATION',a.application_id,a.price_mode::text,a.quantity_tonnes::text,coalesce(a.source_publication_item_id::text,'')),
      'sha256'
    ),
    'hex'
  );
  v_intake:=portal_private.ensure_client_intake_v1(
    'CLIENT_APPLICATION',a.application_id,a.id,'CLIENT_APPLICATION_SUBMIT',a.application_id,v_payload,
    coalesce(a.submitted_at,a.created_at),a.client_key,a.contract_key,a.linked_deal_key,v_fp
  );
  update portal_private.client_intake_v1 i
     set application_key=a.id,
         deal_key=coalesce(i.deal_key,a.linked_deal_key),
         updated_at=now()
   where i.intake_id=v_intake
     and (i.application_key is distinct from a.id
          or (i.deal_key is null and a.linked_deal_key is not null));
  return v_intake;
end
$$;

create or replace function portal_private.converge_client_intake_source_state_v1(p_intake_id uuid)
returns text
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  i portal_private.client_intake_v1;
  e portal_private.portal_reverse_events;
  v_requires_task boolean;
  v_task_linked boolean;
begin
  select * into i from portal_private.client_intake_v1 where intake_id=p_intake_id;
  if not found or i.source_kind<>'PORTAL_REVERSE_EVENT' then return null; end if;
  select * into e from portal_private.portal_reverse_events where id=i.source_internal_key for update;
  if not found then return null; end if;

  if e.processing_state in ('REJECTED','FAILED','DEAD_LETTER','ACKNOWLEDGED','APPLIED') then
    return e.processing_state;
  end if;

  v_requires_task:=i.task_required;
  if i.application_key is not null then
    v_requires_task:=i.task_required and portal_private.client_intake_application_requires_task_v1(i.application_key);
  end if;

  -- An application-detail event whose application already advanced does not need a new task.
  -- Converge directly onto the existing APPLIED/ACK semantics instead of inventing a lifecycle.
  if i.actionable_type like 'APPLICATION_DETAILS_%' and not v_requires_task then
    if e.processing_state in ('RECEIVED','VALIDATED','QUEUED','PROCESSING') then
      update portal_private.portal_reverse_events
         set processing_state='APPLIED',
             acknowledgement_state=case when acknowledgement_state='PENDING' then 'ACKNOWLEDGED' else acknowledgement_state end,
             updated_at=now()
       where id=e.id;
      return 'APPLIED';
    end if;
    return e.processing_state;
  end if;

  if v_requires_task then
    select exists(
      select 1
        from portal_private.client_intake_task_links_v1 l
       where l.intake_id=i.intake_id
         and l.stage_key='RESPONSIBLE_ROLE_ROUTING'
    ) into v_task_linked;
    if v_task_linked and e.processing_state in ('RECEIVED','VALIDATED') then
      update portal_private.portal_reverse_events
         set processing_state='QUEUED',updated_at=now()
       where id=e.id;
      return 'QUEUED';
    end if;
  elsif e.processing_state in ('RECEIVED','VALIDATED') then
    update portal_private.portal_reverse_events
       set processing_state='APPLIED',updated_at=now()
     where id=e.id;
    return 'APPLIED';
  end if;
  return e.processing_state;
end
$$;

create or replace function portal_private.process_client_intake_outbox_v1(p_limit integer default 100)
returns table(intake_id uuid,stage_key text,state text,staff_task_id uuid)
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  o record;
  i portal_private.client_intake_v1;
  p portal_private.client_intake_routing_registry_v1;
  t portal_private.staff_tasks;
  v_task_id text;
  v_task_identity text;
  v_requires_task boolean;
  v_source_state text;
begin
  for o in
    select q.*
      from portal_private.client_intake_routing_outbox_v1 q
     where q.state in ('PENDING','QUEUED','FAILED_RETRYABLE')
       and (q.next_attempt_at is null or q.next_attempt_at<=now())
     order by q.created_at,q.outbox_id
     for update of q skip locked
     limit greatest(1,least(coalesce(p_limit,100),1000))
  loop
    update portal_private.client_intake_routing_outbox_v1 q
       set state='PROCESSING',attempt_count=q.attempt_count+1,processing_started_at=now(),updated_at=now()
     where q.outbox_id=o.outbox_id;
    begin
      t:=null;
      select iv.* into i from portal_private.client_intake_v1 iv where iv.intake_id=o.intake_id for update;
      select pv.* into p from portal_private.client_intake_policy_v1(i.source_kind,i.actionable_type,now()) pv;
      if p.policy_key is null then raise exception 'ROUTING_POLICY_MISSING'; end if;

      v_requires_task:=p.task_required;
      if i.application_key is not null then
        v_requires_task:=p.task_required and portal_private.client_intake_application_requires_task_v1(i.application_key);
      end if;

      update portal_private.client_intake_v1 iv
         set routing_policy_key=p.policy_key,
             responsible_role=p.responsible_role,
             task_required=v_requires_task,
             acknowledgement_required=p.acknowledgement_required,
             client_visible=p.client_visible,
             admin_visible=p.admin_visible,
             routing_state='PROCESSING',
             routing_reason=null,
             updated_at=now()
       where iv.intake_id=i.intake_id;
      i.task_required:=v_requires_task;

      if v_requires_task then
        if i.application_key is not null then
          select st.* into t
            from portal_private.staff_tasks st
           where st.application_key=i.application_key
             and st.assigned_functional_role=p.responsible_role
             and coalesce(st.qa_only,false)=false
             and st.status::text in ('NEW','ACKNOWLEDGED','IN_PROGRESS','WAITING')
           order by st.created_at asc
           limit 1;
        end if;

        if t.id is null and i.source_kind='PORTAL_REVERSE_EVENT' then
          select st.* into t
            from portal_private.staff_tasks st
           where st.source_reverse_event_key=i.source_internal_key
           order by st.created_at asc
           limit 1;
        end if;

        if t.id is null then
          v_task_identity:=case
            when i.application_key is not null then 'APPLICATION:'||i.application_key::text
            else 'INTAKE:'||i.intake_id::text
          end;
          v_task_id:='TASK-CIT-'||upper(pg_catalog.substr(
            pg_catalog.md5(v_task_identity||':'||o.stage_key||':'||p.responsible_role::text),1,24
          ));
          insert into portal_private.staff_tasks(
            task_id,title,status,priority,authority_domain,assigned_functional_role,
            client_key,contract_key,application_key,deal_key,source_reverse_event_key,
            source_type,source_object_id,source_version,qa_only
          ) values(
            v_task_id,'Client Intake: '||i.actionable_type,'NEW','NORMAL','CLIENT_INTAKE',p.responsible_role,
            i.client_key,i.contract_key,i.application_key,i.deal_key,
            case when i.source_kind='PORTAL_REVERSE_EVENT' then i.source_internal_key end,
            'CLIENT_INTAKE',i.intake_id::text,'RONA_CLIENT_INTAKE_V1',false
          ) on conflict(task_id) do nothing;
          select st.* into t from portal_private.staff_tasks st where st.task_id=v_task_id;
        end if;
        if t.id is null then raise exception 'CLIENT_INTAKE_TASK_CREATE_FAILED'; end if;

        insert into portal_private.client_intake_task_links_v1(intake_id,stage_key,staff_task_id)
        values(i.intake_id,o.stage_key,t.id)
        on conflict on constraint client_intake_task_links_v1_pkey do update
          set staff_task_id=excluded.staff_task_id,linked_at=now();
      end if;

      update portal_private.client_intake_routing_outbox_v1 q
         set state='APPLIED',last_error_code=null,last_error_text=null,next_attempt_at=null,
             applied_at=now(),updated_at=now()
       where q.outbox_id=o.outbox_id;
      update portal_private.client_intake_v1 iv
         set routing_state='APPLIED',routing_reason=null,updated_at=now()
       where iv.intake_id=i.intake_id;

      v_source_state:=portal_private.converge_client_intake_source_state_v1(i.intake_id);
      insert into portal_private.client_intake_audit_v1(intake_id,event_type,stage_key,details)
      values(
        i.intake_id,'ROUTING_APPLIED',o.stage_key,
        pg_catalog.jsonb_build_object(
          'policy_key',p.policy_key,
          'responsible_role',p.responsible_role,
          'task_id',case when v_requires_task then t.task_id else null end,
          'application_key',i.application_key,
          'source_processing_state',v_source_state,
          'task_required',v_requires_task
        )
      );
    exception when others then
      update portal_private.client_intake_routing_outbox_v1 q
         set state=case when q.attempt_count>=q.max_attempts then 'DEAD_LETTER' else 'FAILED_RETRYABLE' end,
             last_error_code=case
               when sqlerrm like '%ROUTING_POLICY_MISSING%' then 'ROUTING_POLICY_MISSING'
               when sqlerrm like '%APPLICATION_LINK_MISSING%' then 'APPLICATION_LINK_MISSING'
               else 'ROUTING_WORKER_FAILURE'
             end,
             last_error_text=left(sqlerrm,500),
             next_attempt_at=case when q.attempt_count>=q.max_attempts then null else now()+interval '1 minute' end,
             updated_at=now()
       where q.outbox_id=o.outbox_id;
      update portal_private.client_intake_v1 iv
         set routing_state=q.state,routing_reason=q.last_error_code,updated_at=now()
        from portal_private.client_intake_routing_outbox_v1 q
       where q.outbox_id=o.outbox_id and iv.intake_id=q.intake_id;
    end;
  end loop;

  return query
  select q.intake_id,q.stage_key,q.state,l.staff_task_id
    from portal_private.client_intake_routing_outbox_v1 q
    left join portal_private.client_intake_task_links_v1 l
      on l.intake_id=q.intake_id and l.stage_key=q.stage_key
   order by q.created_at;
end
$$;

create or replace function portal_private.reconcile_client_intake_v1(
  p_limit integer default 500,
  p_stuck_interval interval default interval '5 minutes'
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  r record;
begin
  for r in
    select e.event_id
      from portal_private.portal_reverse_events e
     where e.actor_role='CLIENT'::portal_private.portal_role_enum
       and e.event_type like 'CLIENT_%'
       and e.processing_state not in ('REJECTED','FAILED','DEAD_LETTER')
     order by e.created_at
     limit greatest(1,least(coalesce(p_limit,500),5000))
  loop
    perform portal_private.ensure_client_intake_from_reverse_event_v1(r.event_id);
  end loop;

  for r in
    select a.application_id
      from portal_private.client_applications a
     where a.submitted_at is not null
     order by a.created_at
     limit greatest(1,least(coalesce(p_limit,500),5000))
  loop
    perform portal_private.ensure_client_intake_from_application_v1(r.application_id);
  end loop;

  insert into portal_private.client_intake_routing_outbox_v1(intake_id,stage_key,state,last_error_code,next_attempt_at)
  select i.intake_id,'RESPONSIBLE_ROLE_ROUTING',
         case when i.routing_policy_key is null then 'FAILED_RETRYABLE' else 'PENDING' end,
         case when i.routing_policy_key is null then 'ROUTING_POLICY_RECHECK' end,
         now()
    from portal_private.client_intake_v1 i
   where i.routing_state<>'DEAD_LETTER'
     and not exists(
       select 1 from portal_private.client_intake_routing_outbox_v1 q
        where q.intake_id=i.intake_id and q.stage_key='RESPONSIBLE_ROLE_ROUTING'
     )
  on conflict(intake_id,stage_key) do nothing;

  update portal_private.client_intake_routing_outbox_v1 q
     set state='FAILED_RETRYABLE',last_error_code='STUCK_PROCESSING_RECOVERED',next_attempt_at=now(),updated_at=now()
   where q.state='PROCESSING'
     and coalesce(q.processing_started_at,q.updated_at)<now()-p_stuck_interval;
  update portal_private.client_intake_v1 i
     set routing_state='FAILED_RETRYABLE',routing_reason='STUCK_PROCESSING_RECOVERED',updated_at=now()
    from portal_private.client_intake_routing_outbox_v1 q
   where q.intake_id=i.intake_id
     and q.state='FAILED_RETRYABLE'
     and q.last_error_code='STUCK_PROCESSING_RECOVERED';

  update portal_private.client_intake_v1 i
     set client_visible=true,admin_visible=true,updated_at=now()
   where (not i.client_visible or not i.admin_visible)
     and i.routing_state<>'DEAD_LETTER';

  update portal_private.client_intake_routing_outbox_v1 q
     set state='FAILED_RETRYABLE',last_error_code='REQUIRED_TASK_MISSING',next_attempt_at=now(),updated_at=now()
    from portal_private.client_intake_v1 i
   where q.intake_id=i.intake_id
     and q.stage_key='RESPONSIBLE_ROLE_ROUTING'
     and q.state='APPLIED'
     and i.task_required
     and not exists(
       select 1 from portal_private.client_intake_task_links_v1 l
        where l.intake_id=i.intake_id and l.stage_key=q.stage_key
     );
  update portal_private.client_intake_routing_outbox_v1
     set next_attempt_at=now(),updated_at=now()
   where state='FAILED_RETRYABLE' and (next_attempt_at is null or next_attempt_at>now());

  perform portal_private.process_client_intake_outbox_v1(p_limit);

  -- Source-state self-healing is independent of whether the intake outbox had work left.
  for r in
    select i.intake_id
      from portal_private.client_intake_v1 i
     where i.source_kind='PORTAL_REVERSE_EVENT'
     order by i.created_at
     limit greatest(1,least(coalesce(p_limit,500),5000))
  loop
    perform portal_private.converge_client_intake_source_state_v1(r.intake_id);
  end loop;

  return (
    select pg_catalog.jsonb_build_object(
      'actionable_client_intake_total',count(*),
      'unrouted_client_intake_count',count(*) filter(where routing_state<>'APPLIED'),
      'client_invisible_intake_count',count(*) filter(where not client_visible),
      'admin_invisible_intake_count',count(*) filter(where not admin_visible),
      'dual_invisible_actionable_intake_count',count(*) filter(where not client_visible and not admin_visible),
      'stuck_intake_count',(
        select count(*) from portal_private.client_intake_routing_outbox_v1
         where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-p_stuck_interval
      ),
      'oldest_stuck_intake_age',(
        select max(now()-coalesce(processing_started_at,updated_at)) from portal_private.client_intake_routing_outbox_v1
         where state='PROCESSING' and coalesce(processing_started_at,updated_at)<now()-p_stuck_interval
      )
    )
    from portal_private.client_intake_v1
  );
end
$$;

-- Projection of application-shaped intake is grouped by the authoritative existing application.
-- The durable intake records are preserved as linked identities instead of being rendered as
-- additional logical applications.
create or replace function portal_private.client_intake_application_projection_for_lk_v1(
  p_audience text,
  p_client_id text default null,
  p_contract_id text default null
) returns table(
  application_key uuid,
  application_id text,
  product text,
  quantity_tonnes numeric,
  destination text,
  price_mode text,
  application_status text,
  submitted_at timestamptz,
  updated_at timestamptz,
  linked_intakes jsonb
)
language sql
stable
security definer
set search_path='pg_catalog','portal_private'
as $$
  select a.id,
         a.application_id,
         a.product,
         a.quantity_tonnes,
         a.destination,
         a.price_mode::text,
         a.status::text,
         a.submitted_at,
         a.updated_at,
         pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'intake_id',i.intake_id,
             'durable_id',i.durable_id,
             'source_kind',i.source_kind,
             'source_id',i.source_record_id,
             'actionable_type',i.actionable_type,
             'status',i.routing_state,
             'routing_reason',i.routing_reason,
             'responsible_role',i.responsible_role::text,
             'submitted_at',i.source_submitted_at
           )
           order by case when i.source_kind='CLIENT_APPLICATION' then 0 else 1 end,
                    i.source_submitted_at,
                    i.created_at
         ) as linked_intakes
    from portal_private.client_applications a
    join portal_private.client_intake_v1 i on i.application_key=a.id
    join portal_private.clients cl on cl.id=a.client_key
    join portal_private.contracts ct on ct.id=a.contract_key
   where case upper(coalesce(p_audience,''))
           when 'CLIENT' then i.client_visible
           when 'ADMIN' then i.admin_visible
           else false
         end
     and (p_client_id is null or cl.client_id=p_client_id)
     and (p_contract_id is null or ct.contract_id=p_contract_id)
   group by a.id,a.application_id,a.product,a.quantity_tonnes,a.destination,a.price_mode,
            a.status,a.submitted_at,a.updated_at
   order by a.submitted_at desc nulls last,a.created_at desc
$$;

revoke all on function portal_private.client_intake_application_projection_for_lk_v1(text,text,text)
  from public,anon,authenticated;
