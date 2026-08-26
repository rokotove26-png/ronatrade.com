do $$
declare
  v_count integer := 0;
begin
  insert into portal_private.ai_runtime_runs(
    queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,started_at,finished_at
  )
  select
    q.id,q.target_role,'1.6.1','DISPATCH','PROCESSED','PRE_EXECUTOR_LEGACY_QUEUE_SETTLED',
    jsonb_build_array(q.source_type||':'||q.source_id),
    jsonb_build_object(
      'source_type',q.source_type,
      'source_id',q.source_id,
      'historical_sla_breach',q.sla_breached_at is not null,
      'execute_after',c.execute_after,
      'authoritative_source_unchanged',true,
      'settlement_class','TECHNICAL_BACKLOG_RECONCILIATION'
    ),
    now(),now()
  from portal_private.ai_runtime_queue q
  cross join portal_private.ai_model_executor_control c
  where c.singleton=true
    and q.state='DELIVERED'
    and q.qa_only=false
    and q.created_at < c.execute_after
    and q.source_type in ('COORDINATION','STAFF_TASK');

  update portal_private.ai_runtime_queue q
     set state='PROCESSED',
         processed_at=coalesce(q.processed_at,now()),
         lease_until=null,
         claimed_by=null,
         last_error_code=null,
         last_error_text=null,
         updated_at=now()
    from portal_private.ai_model_executor_control c
   where c.singleton=true
     and q.state='DELIVERED'
     and q.qa_only=false
     and q.created_at < c.execute_after
     and q.source_type in ('COORDINATION','STAFF_TASK');
  get diagnostics v_count = row_count;

  insert into portal_private.audit_events(actor_role,action,entity_type,entity_id,metadata,severity,result)
  values ('SYSTEM_ADMIN','AI_RUNTIME_PRE_EXECUTOR_BACKLOG_SETTLEMENT','AI_RUNTIME','PRE_EXECUTOR_DELIVERED_20260827',
    jsonb_build_object('settled_count',v_count,'source_types',jsonb_build_array('COORDINATION','STAFF_TASK'),'authoritative_coordination_changed',false,'authoritative_staff_tasks_changed',false,'historical_sla_timestamps_preserved',true,'worker_version','1.6.1'),
    'WARNING','SUCCESS');
end $$;
