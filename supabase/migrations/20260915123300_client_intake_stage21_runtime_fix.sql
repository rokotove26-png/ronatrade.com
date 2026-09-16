-- Stage 2.1 PostgreSQL 17 runtime correction for the outbox executor.
-- RETURNS TABLE output names are PL/pgSQL variables, so source columns are qualified and
-- conflict targets use named constraints rather than output-variable-like column names.
create or replace function portal_private.process_client_intake_outbox_v1(p_limit integer default 100)
returns table(intake_id uuid,stage_key text,state text,staff_task_id uuid)
language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare
  o record;
  i portal_private.client_intake_v1;
  p portal_private.client_intake_routing_registry_v1;
  t portal_private.staff_tasks;
  v_task_id text;
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
      select iv.* into i from portal_private.client_intake_v1 iv where iv.intake_id=o.intake_id for update;
      select pv.* into p from portal_private.client_intake_policy_v1(i.source_kind,i.actionable_type,now()) pv;
      if p.policy_key is null then raise exception 'ROUTING_POLICY_MISSING'; end if;

      update portal_private.client_intake_v1 iv
        set routing_policy_key=p.policy_key,responsible_role=p.responsible_role,task_required=p.task_required,
            acknowledgement_required=p.acknowledgement_required,client_visible=p.client_visible,admin_visible=p.admin_visible,
            routing_state='PROCESSING',routing_reason=null,updated_at=now()
        where iv.intake_id=i.intake_id;

      if p.task_required then
        select st.* into t
        from portal_private.staff_tasks st
        where (i.source_kind='PORTAL_REVERSE_EVENT' and st.source_reverse_event_key=i.source_internal_key)
           or (i.source_kind='CLIENT_APPLICATION' and st.application_key=i.source_internal_key)
        order by st.created_at asc
        limit 1;
        if not found then
          v_task_id:='TASK-CIT-'||upper(pg_catalog.substr(pg_catalog.md5(i.intake_id::text||':'||o.stage_key),1,24));
          insert into portal_private.staff_tasks(
            task_id,title,status,priority,authority_domain,assigned_functional_role,client_key,contract_key,
            application_key,deal_key,source_reverse_event_key,source_type,source_object_id,source_version,qa_only
          ) values(
            v_task_id,'Client Intake: '||i.actionable_type,'NEW','NORMAL','CLIENT_INTAKE',p.responsible_role,
            i.client_key,i.contract_key,case when i.source_kind='CLIENT_APPLICATION' then i.source_internal_key end,i.deal_key,
            case when i.source_kind='PORTAL_REVERSE_EVENT' then i.source_internal_key end,'CLIENT_INTAKE',i.intake_id::text,'RONA_CLIENT_INTAKE_V1',false
          ) on conflict(task_id) do nothing;
          select st.* into t from portal_private.staff_tasks st where st.task_id=v_task_id;
        end if;
        insert into portal_private.client_intake_task_links_v1(intake_id,stage_key,staff_task_id)
        values(i.intake_id,o.stage_key,t.id)
        on conflict on constraint client_intake_task_links_v1_pkey do nothing;
      end if;

      update portal_private.client_intake_routing_outbox_v1 q
        set state='APPLIED',last_error_code=null,last_error_text=null,next_attempt_at=null,applied_at=now(),updated_at=now()
        where q.outbox_id=o.outbox_id;
      update portal_private.client_intake_v1 iv
        set routing_state='APPLIED',routing_reason=null,updated_at=now()
        where iv.intake_id=i.intake_id;
      insert into portal_private.client_intake_audit_v1(intake_id,event_type,stage_key,details)
      values(i.intake_id,'ROUTING_APPLIED',o.stage_key,pg_catalog.jsonb_build_object(
        'policy_key',p.policy_key,'responsible_role',p.responsible_role,'task_id',t.task_id));
    exception when others then
      update portal_private.client_intake_routing_outbox_v1 q
      set state=case when q.attempt_count>=q.max_attempts then 'DEAD_LETTER' else 'FAILED_RETRYABLE' end,
          last_error_code=case when sqlerrm like '%ROUTING_POLICY_MISSING%' then 'ROUTING_POLICY_MISSING' else 'ROUTING_WORKER_FAILURE' end,
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
end $$;
