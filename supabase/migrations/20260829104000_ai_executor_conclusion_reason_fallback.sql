-- The strict model schema requires a non-empty reason for every action, while summary and
-- recommendation are nullable. If the model chooses FUNCTIONAL_CONCLUSION and omits one of
-- those optional presentation fields, reuse its own reason text instead of dead-lettering a
-- semantically valid conclusion. No business fact is synthesized by the backend.
do $migration$
declare
  v_def text;
  v_old_check text := $old$if btrim(coalesce(p_action->>'summary',''))='' or btrim(coalesce(p_action->>'recommendation',''))='' then raise exception 'AI_EXECUTOR_CONCLUSION_TEXT_REQUIRED'; end if;$old$;
  v_new_check text := $new$if btrim(coalesce(nullif(p_action->>'summary',''),p_action->>'reason',''))='' or btrim(coalesce(nullif(p_action->>'recommendation',''),p_action->>'reason',''))='' then raise exception 'AI_EXECUTOR_CONCLUSION_TEXT_REQUIRED'; end if;$new$;
  v_old_payload text := $old$'summary',left(p_action->>'summary',4000),'confirmed',$old$;
  v_new_payload text := $new$'summary',left(coalesce(nullif(btrim(p_action->>'summary'),''),p_action->>'reason'),4000),'confirmed',$new$;
  v_old_recommendation text := $old$'recommendation',left(p_action->>'recommendation',4000),'source_refs'$old$;
  v_new_recommendation text := $new$'recommendation',left(coalesce(nullif(btrim(p_action->>'recommendation'),''),p_action->>'reason'),4000),'source_refs'$new$;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and n.nspname='public' and p.proname='rona_ai_executor_commit_action'
    and pg_get_function_identity_arguments(p.oid)='p_queue_id uuid, p_worker_id text, p_action jsonb, p_response_id text, p_model text, p_request_hash text, p_output_hash text, p_usage jsonb';
  if v_def is null then raise exception 'rona_ai_executor_commit_action overload not found'; end if;
  if position(v_old_check in v_def)>0 then v_def:=replace(v_def,v_old_check,v_new_check); end if;
  if position(v_old_payload in v_def)>0 then v_def:=replace(v_def,v_old_payload,v_new_payload); end if;
  if position(v_old_recommendation in v_def)>0 then v_def:=replace(v_def,v_old_recommendation,v_new_recommendation); end if;
  if position(v_new_check in v_def)=0 or position(v_new_payload in v_def)=0 or position(v_new_recommendation in v_def)=0 then
    raise exception 'AI executor conclusion fallback patch did not converge';
  end if;
  execute v_def;
end
$migration$;

update portal_private.ai_runtime_queue
set state='DELIVERED',attempts=0,available_at=now(),lease_until=null,claimed_by=null,
    last_error_code=null,last_error_text=null,updated_at=now(),
    payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('conclusion_reason_fallback_retry',true,'conclusion_reason_fallback_retry_at',now())
where target_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
  and state='DEAD_LETTER'
  and coalesce((payload->>'role_alias_normalized')::boolean,false)=true
  and last_error_text='AI_EXECUTOR_CONCLUSION_TEXT_REQUIRED';

insert into portal_private.ai_coordination_audit_events(
  functional_role,identity_id,client_id,server_slug,tool_name,target_type,target_id,
  correlation_id,mcp_request_id,result,qa_only,metadata
) values(
  'SYSTEM_ADMIN','AI-SYSTEM-ADMIN',null,'rona-system-admin',
  'ai_executor_conclusion_reason_fallback','SYSTEM','AI_MODEL_EXECUTOR',
  gen_random_uuid(),gen_random_uuid(),'SUCCESS',false,
  jsonb_build_object('fallback_source','MODEL_REASON_ONLY','synthesized_business_facts',false,'requeued_repaired_rows',true)
);
