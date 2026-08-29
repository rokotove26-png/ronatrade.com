-- Functional conclusion commit reached a PL/pgSQL ambiguity because the local variable
-- record_type had the same name as the coordination table column. Qualify the history query.
do $migration$
declare
  v_def text;
  v_old text := $old$from portal_private.ai_coordination_records
    where record_type='FUNCTIONAL_CONCLUSION' and functional_role=q.target_role and target_type=entity_type and target_id=entity_id
    order by version desc limit 1;$old$;
  v_new text := $new$from portal_private.ai_coordination_records acr
    where acr.record_type='FUNCTIONAL_CONCLUSION' and acr.functional_role=q.target_role and acr.target_type=entity_type and acr.target_id=entity_id
    order by acr.version desc limit 1;$new$;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and n.nspname='public' and p.proname='rona_ai_executor_commit_action'
    and pg_get_function_identity_arguments(p.oid)='p_queue_id uuid, p_worker_id text, p_action jsonb, p_response_id text, p_model text, p_request_hash text, p_output_hash text, p_usage jsonb';
  if v_def is null then raise exception 'rona_ai_executor_commit_action overload not found'; end if;
  if position(v_old in v_def)>0 then v_def:=replace(v_def,v_old,v_new); end if;
  if position(v_new in v_def)=0 then raise exception 'AI executor conclusion history alias patch did not converge'; end if;
  execute v_def;
end
$migration$;

update portal_private.ai_runtime_queue
set state='DELIVERED',attempts=0,available_at=now(),lease_until=null,claimed_by=null,
    last_error_code=null,last_error_text=null,updated_at=now(),
    payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('conclusion_history_alias_retry',true,'conclusion_history_alias_retry_at',now())
where target_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
  and state='DEAD_LETTER'
  and coalesce((payload->>'role_alias_normalized')::boolean,false)=true
  and last_error_text ilike '%record_type%ambiguous%';
