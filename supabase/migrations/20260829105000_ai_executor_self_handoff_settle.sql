-- A model may echo the source request's legacy role alias as a HANDOFF_REQUEST target.
-- After canonical role normalization this becomes a self-handoff. It has no valid downstream
-- effect and must be settled as NO_ACTION rather than dead-lettered or recursively re-enqueued.
do $migration$
declare
  v_def text;
  v_old text := $old$if out_target=q.target_role then raise exception 'AI_EXECUTOR_SELF_HANDOFF_DENIED'; end if;$old$;
  v_new text := $new$if out_target=q.target_role then
      update portal_private.ai_runtime_queue
      set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now()
      where id=q.id;
      insert into portal_private.ai_model_executor_runs(queue_id,target_role,worker_id,worker_version,provider,model_id,status,action_type,response_id,request_hash,output_hash,usage,metadata,finished_at)
      values(q.id,q.target_role,p_worker_id,c.worker_version,c.provider,p_model,'NO_ACTION','SELF_HANDOFF_SUPPRESSED',p_response_id,p_request_hash,p_output_hash,coalesce(p_usage,'{}'::jsonb),jsonb_build_object('reason',left(coalesce(p_action->>'reason','SELF_HANDOFF_SUPPRESSED'),1000),'requested_target_role',p_action->>'target_role','canonical_target_role',out_target::text),now());
      return jsonb_build_object('ok',true,'queue_id',q.id,'action','NO_ACTION','state','PROCESSED','reason','SELF_HANDOFF_SUPPRESSED');
    end if;$new$;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and n.nspname='public' and p.proname='rona_ai_executor_commit_action'
    and pg_get_function_identity_arguments(p.oid)='p_queue_id uuid, p_worker_id text, p_action jsonb, p_response_id text, p_model text, p_request_hash text, p_output_hash text, p_usage jsonb';
  if v_def is null then raise exception 'rona_ai_executor_commit_action overload not found'; end if;
  if position(v_old in v_def)>0 then v_def:=replace(v_def,v_old,v_new); end if;
  if position(v_new in v_def)=0 then raise exception 'AI executor self handoff settlement patch did not converge'; end if;
  execute v_def;
end
$migration$;

update portal_private.ai_runtime_queue
set state='DELIVERED',attempts=0,available_at=now(),lease_until=null,claimed_by=null,
    last_error_code=null,last_error_text=null,updated_at=now(),
    payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('self_handoff_settlement_retry',true,'self_handoff_settlement_retry_at',now())
where target_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
  and state='DEAD_LETTER'
  and coalesce((payload->>'role_alias_normalized')::boolean,false)=true
  and last_error_text='AI_EXECUTOR_SELF_HANDOFF_DENIED';
