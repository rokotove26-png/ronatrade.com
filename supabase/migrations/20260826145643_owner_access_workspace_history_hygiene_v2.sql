create or replace function public.owner_access_workspace_bootstrap(p_limit integer default 300)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_users jsonb;
  v_events jsonb;
  v_limit integer := greatest(20, least(coalesce(p_limit,300), 1000));
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,
    'name',u.display_name,
    'login',u.login_name,
    'status',u.status::text,
    'lifecycleState',u.lifecycle_state::text,
    'lastAuthVerifiedAt',u.last_auth_verified_at,
    'roles',coalesce((select jsonb_agg(r.role::text order by r.role::text) from portal_private.portal_user_roles r where r.user_id=u.id and r.status::text='ACTIVE' and r.revoked_at is null),'[]'::jsonb),
    'bindings',
      coalesce((select jsonb_agg(jsonb_build_object(
        'kind','CLIENT_CONTRACT','bindingId',b.id,'status',b.status::text,'company',cl.legal_name,'clientId',cl.client_id,'contractId',ct.contract_id,
        'representationRole',case when coalesce(b.reason,'') ~* '^Admin Portal: (Уполномоченный представитель|Директор|Бухгалтер|Логистика)$' then regexp_replace(b.reason,'^Admin Portal: ','','i') else null end,
        'rights',coalesce(nullif(b.deal_scope_mode,''),'ALL_CONTRACT_DEALS'),'reason',b.reason,'createdAt',b.created_at,'updatedAt',b.updated_at,'revokedAt',b.revoked_at
      ) order by b.created_at) from portal_private.client_user_bindings b join portal_private.clients cl on cl.id=b.client_key join portal_private.contracts ct on ct.id=b.contract_key where b.user_id=u.id),'[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object(
        'kind','CLIENT_PENDING','bindingId',p.id,'status',p.status::text,'company',cl.legal_name,'clientId',cl.client_id,'contractId',ct.contract_id,
        'representationRole',p.representation_role,'rights','FAIL_CLOSED_UNTIL_SIGNED_CONTRACT','reason',p.reason,'createdAt',p.created_at,'updatedAt',p.updated_at,'revokedAt',p.revoked_at
      ) order by p.created_at) from portal_private.client_user_pending_company_bindings p join portal_private.clients cl on cl.id=p.client_key left join portal_private.contracts ct on ct.id=p.requested_contract_key where p.user_id=u.id),'[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object(
        'kind','AGENT','bindingId',b.id,'status',b.status::text,'company',ale.legal_name,'clientId',ale.agent_legal_entity_id,'contractId',ap.agent_person_id,
        'representationRole','Агент','rights','AGENT_FIXED_SCOPE','reason',b.reason,'createdAt',b.created_at,'updatedAt',b.updated_at,'revokedAt',b.revoked_at
      ) order by b.created_at) from portal_private.agent_user_bindings b join portal_private.agent_persons ap on ap.id=b.agent_person_key join portal_private.agent_legal_entities ale on ale.id=b.agent_legal_entity_key where b.user_id=u.id),'[]'::jsonb)
  ) order by lower(coalesce(u.login_name,u.display_name,''))),'[]'::jsonb)
  into v_users
  from portal_private.portal_users u
  where left(coalesce(u.source_system,''),3)<>'QA_'
    and left(lower(coalesce(u.login_name,'')),3)<>'qa_'
    and left(lower(coalesce(u.login_name,'')),4)<>'g81_'
    and exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role::text in ('CLIENT','AGENT') and r.status::text='ACTIVE' and r.revoked_at is null)
    and not exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role::text='ADMIN' and r.status::text='ACTIVE' and r.revoked_at is null);

  select coalesce(jsonb_agg(jsonb_build_object(
    'eventId',x.event_id,'eventAt',x.event_at,'action',x.action,'entityType',x.entity_type,'entityId',x.entity_id,
    'actorRole',x.actor_role,'actorName',x.actor_name,'result',x.result,'severity',x.severity,'metadata',x.metadata
  ) order by x.event_at desc),'[]'::jsonb)
  into v_events
  from (
    select ae.event_id,ae.event_at,ae.action,ae.entity_type,ae.entity_id,ae.actor_role,au.display_name as actor_name,ae.result::text as result,ae.severity::text as severity,ae.metadata
    from portal_private.audit_events ae
    join portal_private.portal_users eu on eu.id::text=ae.entity_id
    left join portal_private.portal_users au on au.id=ae.actor_user_id
    where ae.entity_type='PORTAL_USER'
      and left(coalesce(eu.source_system,''),3)<>'QA_'
      and left(lower(coalesce(eu.login_name,'')),3)<>'qa_'
      and left(lower(coalesce(eu.login_name,'')),4)<>'g81_'
      and exists(select 1 from portal_private.portal_user_roles r where r.user_id=eu.id and r.role::text in ('CLIENT','AGENT') and r.status::text='ACTIVE' and r.revoked_at is null)
      and not exists(select 1 from portal_private.portal_user_roles r where r.user_id=eu.id and r.role::text='ADMIN' and r.status::text='ACTIVE' and r.revoked_at is null)
      and (ae.action like '%PORTAL_USER%' or ae.action like '%CONTRACT_ACCESS%' or ae.action like '%ACCESS_%')
    order by ae.event_at desc
    limit v_limit
  ) x;

  return jsonb_build_object('generatedAt',now(),'actor',v_actor,'users',v_users,'events',v_events,'rightsModel',jsonb_build_object(
    'clientRoles',jsonb_build_array('Уполномоченный представитель','Директор','Бухгалтер','Логистика'),
    'clientScope','ALL_CONTRACT_DEALS','agentScope','AGENT_FIXED_SCOPE','pendingScope','FAIL_CLOSED_UNTIL_SIGNED_CONTRACT'
  ));
end
$function$;
