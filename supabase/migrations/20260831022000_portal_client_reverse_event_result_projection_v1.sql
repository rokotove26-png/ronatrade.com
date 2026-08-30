create or replace function public.portal_client_event_status_v2(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private','auth','public'
as $$
declare
  v_auth uuid;
  v_user uuid;
  v_event record;
  v_result record;
begin
  v_auth := auth.uid();
  if v_auth is null then return jsonb_build_object('found',false,'code','AUTH_REQUIRED'); end if;

  select u.id into v_user
  from portal_private.portal_users u
  where u.auth_user_id=v_auth
    and u.status='ACTIVE'::portal_private.portal_user_status_enum
    and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role='CLIENT'::portal_private.portal_role_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null)
  limit 1;
  if v_user is null then return jsonb_build_object('found',false,'code','CLIENT_ACCESS_DENIED'); end if;

  select e.event_id,e.event_type,e.processing_state,e.acknowledgement_state,e.authority_target_type,e.authority_target_id,e.created_at,e.updated_at,e.id
    into v_event
  from portal_private.portal_reverse_events e
  where e.event_id=p_event_id and e.actor_user_id=v_user
  limit 1;
  if not found then return jsonb_build_object('found',false,'code','EVENT_NOT_FOUND'); end if;

  select fc.record_id,fc.status,fc.payload,fc.created_at as conclusion_at,od.record_id as decision_record_id,od.created_at as decision_at
    into v_result
  from portal_private.staff_tasks t
  join portal_private.ai_coordination_records fc on fc.record_type='FUNCTIONAL_CONCLUSION' and fc.target_type='TASK' and fc.target_id=t.task_id and fc.qa_only=false
  join lateral (
    select d.record_id,d.created_at
    from portal_private.ai_coordination_records d
    where d.record_type='OPERATIONS_INTERNAL_DECISION'
      and d.parent_record_id=fc.record_id
      and d.functional_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
      and d.status='APPROVE_FOR_NEXT_STAGE'
      and d.qa_only=false
    order by d.version desc,d.created_at desc limit 1
  ) od on true
  where t.source_reverse_event_key=v_event.id
  order by fc.version desc,fc.created_at desc limit 1;

  return jsonb_build_object('found',true,'event',jsonb_build_object(
    'event_id',v_event.event_id,'event_type',v_event.event_type,'processing_state',v_event.processing_state,'acknowledgement_state',v_event.acknowledgement_state,
    'authority_target_type',v_event.authority_target_type,'authority_target_id',v_event.authority_target_id,'created_at',v_event.created_at,'updated_at',v_event.updated_at,
    'result',case when v_result.record_id is null then null else jsonb_build_object('status',v_result.status,'summary',v_result.payload->>'summary','recommendation',v_result.payload->>'recommendation','mandatory_conditions',coalesce(v_result.payload->'mandatory_conditions','[]'::jsonb),'conclusion_at',v_result.conclusion_at,'decision_at',v_result.decision_at,'result_version',1) end));
end;
$$;

create or replace function public.portal_client_recent_event_results_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private','auth','public'
as $$
declare v_auth uuid; v_user uuid; v_rows jsonb;
begin
  v_auth:=auth.uid(); if v_auth is null then return '[]'::jsonb; end if;
  select u.id into v_user from portal_private.portal_users u
  where u.auth_user_id=v_auth and u.status='ACTIVE'::portal_private.portal_user_status_enum and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role='CLIENT'::portal_private.portal_role_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null)
  limit 1;
  if v_user is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x.obj order by x.decision_at desc),'[]'::jsonb) into v_rows
  from (
    select distinct on (e.id) od.created_at as decision_at,
      jsonb_build_object('id','RESULT-'||e.event_id,'event_id',e.event_id,'type','PORTAL_EVENT_RESULT','topic',e.authority_domain,
        'title',case when e.authority_domain='PRICE_CALCULATION' then 'Расчет по вашему запросу готов' else 'Результат по вашему запросу готов' end,
        'message',fc.payload->>'summary','summary',fc.payload->>'summary','recommendation',fc.payload->>'recommendation','mandatory_conditions',coalesce(fc.payload->'mandatory_conditions','[]'::jsonb),
        'status',fc.status,'processing_state',e.processing_state,'acknowledgement_state',e.acknowledgement_state,'created_at',od.created_at,'updated_at',greatest(e.updated_at,od.created_at),'read',false) as obj
    from portal_private.portal_reverse_events e
    join portal_private.staff_tasks t on t.source_reverse_event_key=e.id
    join portal_private.ai_coordination_records fc on fc.record_type='FUNCTIONAL_CONCLUSION' and fc.target_type='TASK' and fc.target_id=t.task_id and fc.qa_only=false
    join portal_private.ai_coordination_records od on od.record_type='OPERATIONS_INTERNAL_DECISION' and od.parent_record_id=fc.record_id and od.functional_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum and od.status='APPROVE_FOR_NEXT_STAGE' and od.qa_only=false
    where e.actor_user_id=v_user and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by e.id,fc.version desc,od.version desc,od.created_at desc
  ) x;
  return coalesce(v_rows,'[]'::jsonb);
end;
$$;

revoke all on function public.portal_client_event_status_v2(text) from public,anon;
revoke all on function public.portal_client_recent_event_results_v1() from public,anon;
grant execute on function public.portal_client_event_status_v2(text) to authenticated;
grant execute on function public.portal_client_recent_event_results_v1() to authenticated;

comment on function public.portal_client_event_status_v2(text) is 'Client-safe reverse-event status with result only after explicit Operations APPROVE_FOR_NEXT_STAGE. Scope is bound to auth.uid() and the originating portal user.';
comment on function public.portal_client_recent_event_results_v1() is 'Client-safe persisted result notifications for authenticated originating Client user; only Operations-approved functional conclusions are projected.';