begin;

create or replace function portal_private.radio_stage2a_operational_directory_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
with qa_users as (
  select id,status::text as status,lifecycle_state::text as lifecycle_state
  from portal_private.portal_users
  where source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'
),
client_rows as (
  select client_id,legal_name
  from portal_private.clients
  where lifecycle_state::text='ACTIVE'
    and authority_state::text in ('CONFIRMED','VERIFIED')
  order by client_id
),
agent_rows as (
  select agent_person_id,coalesce(display_alias,full_name,agent_person_id) as agent_name
  from portal_private.agent_persons
  where lifecycle_state::text='ACTIVE'
    and authority_state::text in ('SOURCE_RECEIVED','VERIFIED','CONFIRMED')
  order by agent_person_id
),
qa_events as (
  select authority_domain
  from portal_private.portal_reverse_events
  where actor_user_id in (select id from qa_users)
    and lifecycle_state::text='ACTIVE'
    and authority_target_type::text='MESSAGE'
)
select jsonb_build_object(
  'clients',coalesce((select jsonb_agg(jsonb_build_object('client_id',client_id,'legal_name',coalesce(legal_name,'')) order by client_id) from client_rows),'[]'::jsonb),
  'agents',coalesce((select jsonb_agg(jsonb_build_object('agent_person_id',agent_person_id,'agent_name',agent_name) order by agent_person_id) from agent_rows),'[]'::jsonb),
  'qa',jsonb_build_object(
    'active_users',(select count(*) from qa_users where status='ACTIVE' and lifecycle_state='ACTIVE'),
    'active_client_bindings',(select count(*) from portal_private.client_user_bindings where source_system='QA_GITHUB_OIDC_RADIO_STAGE2A' and status::text='ACTIVE'),
    'active_agent_bindings',(select count(*) from portal_private.agent_user_bindings where source_system='QA_GITHUB_OIDC_RADIO_STAGE2A' and status::text='ACTIVE'),
    'visible_client_messages',(select count(*) from qa_events where authority_domain::text='CLIENT_COMMUNICATION'),
    'visible_agent_messages',(select count(*) from qa_events where authority_domain::text='AGENT_COMMUNICATION')
  )
);
$function$;

revoke all on function portal_private.radio_stage2a_operational_directory_v1() from public;
revoke all on function portal_private.radio_stage2a_operational_directory_v1() from anon;
revoke all on function portal_private.radio_stage2a_operational_directory_v1() from authenticated;
grant execute on function portal_private.radio_stage2a_operational_directory_v1() to service_role;

create or replace function portal_private.radio_stage2a_provision_identity_v1(
  p_portal_id uuid,
  p_auth_user_id uuid,
  p_identity_selector uuid,
  p_run_id text,
  p_login text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_source constant text := 'QA_GITHUB_OIDC_RADIO_STAGE2A';
  v_selector text := p_identity_selector::text;
  v_source_version text;
  v_role portal_private.portal_role_enum;
  v_ts timestamptz := now();
  v_old_user_ids uuid[] := '{}'::uuid[];
  v_old_auth_ids uuid[] := '{}'::uuid[];
  v_agent_person_id text;
  v_agent_legal_id text;
  v_agent_person_key uuid;
  v_agent_legal_key uuid;
  v_specs jsonb;
  v_spec jsonb;
  v_client_key uuid;
  v_contract_key uuid;
begin
  if p_portal_id is null or p_auth_user_id is null or p_identity_selector is null then
    raise exception 'RADIO_STAGE2A_IDENTITY_ARGUMENTS_REQUIRED';
  end if;
  if coalesce(btrim(p_run_id),'') !~ '^[0-9]{5,20}$' then
    raise exception 'RADIO_STAGE2A_RUN_ID_INVALID';
  end if;
  if coalesce(btrim(p_login),'')='' then
    raise exception 'RADIO_STAGE2A_LOGIN_REQUIRED';
  end if;

  if v_selector='a2a0b91e-4c2a-4d3e-8f11-2a2a00000001' then
    v_role := 'ADMIN'::portal_private.portal_role_enum;
  elsif v_selector in (
    'a2a0b91e-4c2a-4d3e-8f11-2a2a00000005',
    'a2a0b91e-4c2a-4d3e-8f11-2a2a00000006'
  ) then
    v_role := 'AGENT'::portal_private.portal_role_enum;
  elsif v_selector in (
    'a2a0b91e-4c2a-4d3e-8f11-2a2a00000002',
    'a2a0b91e-4c2a-4d3e-8f11-2a2a00000003',
    'a2a0b91e-4c2a-4d3e-8f11-2a2a00000004'
  ) then
    v_role := 'CLIENT'::portal_private.portal_role_enum;
  else
    raise exception 'RADIO_STAGE2A_IDENTITY_SELECTOR_DENIED';
  end if;

  v_source_version := 'RUN_'||p_run_id||'_SRC_'||v_selector;

  select
    coalesce(array_agg(pu.id),'{}'::uuid[]),
    coalesce(array_agg(pu.auth_user_id) filter (where pu.auth_user_id is not null),'{}'::uuid[])
  into v_old_user_ids,v_old_auth_ids
  from portal_private.portal_users pu
  where pu.source_system=v_source
    and pu.status='ACTIVE'::portal_private.portal_user_status_enum
    and (
      pu.source_version like v_source_version||'%'
      or (
        pu.source_version like '%_SRC_'||v_selector
        and pu.created_at < v_ts-interval '30 minutes'
      )
    );

  if cardinality(v_old_user_ids)>0 then
    update portal_private.client_user_deal_grants
       set status='REVOKED'::portal_private.binding_status_enum,
           revoked_at=v_ts,
           reason='Radio Stage2A transactional same-run selector cleanup',
           updated_at=v_ts
     where user_id=any(v_old_user_ids)
       and status='ACTIVE'::portal_private.binding_status_enum;

    update portal_private.client_user_bindings
       set status='REVOKED'::portal_private.binding_status_enum,
           revoked_at=v_ts,
           reason='Radio Stage2A transactional same-run selector cleanup',
           updated_at=v_ts
     where user_id=any(v_old_user_ids)
       and status='ACTIVE'::portal_private.binding_status_enum;

    update portal_private.agent_user_bindings
       set status='REVOKED'::portal_private.binding_status_enum,
           valid_to=v_ts,
           revoked_at=v_ts,
           reason='Radio Stage2A transactional same-run selector cleanup',
           updated_at=v_ts
     where user_id=any(v_old_user_ids)
       and status='ACTIVE'::portal_private.binding_status_enum;

    update portal_private.portal_user_roles
       set status='REVOKED'::portal_private.binding_status_enum,
           revoked_at=v_ts,
           reason='Radio Stage2A transactional same-run selector cleanup',
           updated_at=v_ts
     where user_id=any(v_old_user_ids)
       and status='ACTIVE'::portal_private.binding_status_enum;

    update portal_private.staff_user_roles
       set status='REVOKED'::portal_private.binding_status_enum,
           revoked_at=v_ts,
           reason='Radio Stage2A transactional same-run selector cleanup',
           updated_at=v_ts
     where user_id=any(v_old_user_ids)
       and status='ACTIVE'::portal_private.binding_status_enum;

    update portal_private.portal_users
       set status='REVOKED'::portal_private.portal_user_status_enum,
           lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
           revoked_at=v_ts,
           suspended_at=null,
           auth_user_id=null,
           updated_at=v_ts
     where id=any(v_old_user_ids)
       and source_system=v_source
       and status='ACTIVE'::portal_private.portal_user_status_enum;
  end if;

  insert into portal_private.portal_users(
    id,auth_user_id,login_name,display_name,status,
    source_system,source_version,source_timestamp,
    authority_state,lifecycle_state,auth_linked_at,activated_at,
    last_auth_verified_at,must_change_password,password_changed_at
  ) values(
    p_portal_id,p_auth_user_id,p_login,'RONA Radio Stage2A QA · '||v_role::text,
    'ACTIVE'::portal_private.portal_user_status_enum,
    v_source,v_source_version,v_ts,
    'CONFIRMED'::portal_private.authority_state_enum,
    'ACTIVE'::portal_private.lifecycle_state_enum,
    v_ts,v_ts,v_ts,false,v_ts
  );

  insert into portal_private.portal_user_roles(
    user_id,role,status,granted_by,reason,granted_at,created_at,updated_at
  ) values(
    p_portal_id,v_role,'ACTIVE'::portal_private.binding_status_enum,null,
    'Temporary Radio Stage2A GitHub OIDC QA',v_ts,v_ts,v_ts
  );

  if v_role='ADMIN'::portal_private.portal_role_enum then
    insert into portal_private.staff_user_roles(
      user_id,functional_role,status,granted_at,granted_by,reason,qa_only,created_at,updated_at
    ) values(
      p_portal_id,'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum,
      'ACTIVE'::portal_private.binding_status_enum,v_ts,null,
      'Temporary Radio Stage2A GitHub OIDC QA',true,v_ts,v_ts
    );
  elsif v_role='AGENT'::portal_private.portal_role_enum then
    if v_selector='a2a0b91e-4c2a-4d3e-8f11-2a2a00000005' then
      v_agent_person_id:='AGP-2026-001';
      v_agent_legal_id:='S-005';
    else
      v_agent_person_id:='AGP-2026-002';
      v_agent_legal_id:='S-010';
    end if;

    select ap.id into v_agent_person_key
    from portal_private.agent_persons ap
    where ap.agent_person_id=v_agent_person_id
      and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ap.authority_state in (
        'SOURCE_RECEIVED'::portal_private.authority_state_enum,
        'VERIFIED'::portal_private.authority_state_enum,
        'CONFIRMED'::portal_private.authority_state_enum
      )
    limit 1;
    if v_agent_person_key is null then raise exception 'RADIO_STAGE2A_AGENT_IDENTITY_MISSING'; end if;

    select ale.id into v_agent_legal_key
    from portal_private.agent_legal_entities ale
    where ale.agent_legal_entity_id=v_agent_legal_id
    limit 1;
    if v_agent_legal_key is null then raise exception 'RADIO_STAGE2A_AGENT_LEGAL_ENTITY_MISSING'; end if;

    insert into portal_private.agent_user_bindings(
      id,user_id,agent_person_key,agent_legal_entity_key,status,
      valid_from,valid_to,granted_by,granted_at,revoked_at,revoked_by,
      reason,created_at,updated_at,source_system,source_version,
      source_timestamp,import_batch_id,authority_state,lifecycle_state
    ) values(
      pg_catalog.gen_random_uuid(),p_portal_id,v_agent_person_key,v_agent_legal_key,
      'ACTIVE'::portal_private.binding_status_enum,
      v_ts,null,null,v_ts,null,null,
      'Temporary Radio Stage2A GitHub OIDC QA agent binding',v_ts,v_ts,
      v_source,v_source_version,v_ts,null,
      'CONFIRMED'::portal_private.authority_state_enum,
      'ACTIVE'::portal_private.lifecycle_state_enum
    );
  else
    if v_selector='a2a0b91e-4c2a-4d3e-8f11-2a2a00000002' then
      v_specs:='[["RONA-C002","RONA-C002-CTR-2026-001"],["RONA-C005","RONA-C005-CTR-2026-001"]]'::jsonb;
    elsif v_selector='a2a0b91e-4c2a-4d3e-8f11-2a2a00000004' then
      v_specs:='[["RONA-C005","RONA-C005-CTR-2026-001"]]'::jsonb;
    else
      v_specs:='[["RONA-C002","RONA-C002-CTR-2026-001"]]'::jsonb;
    end if;

    for v_spec in select value from pg_catalog.jsonb_array_elements(v_specs)
    loop
      v_client_key:=null;
      v_contract_key:=null;

      select cl.id into v_client_key
      from portal_private.clients cl
      where cl.client_id=(v_spec->>0)
        and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      limit 1;
      if v_client_key is null then raise exception 'RADIO_STAGE2A_CLIENT_CONTEXT_MISSING'; end if;

      select ct.id into v_contract_key
      from portal_private.contracts ct
      where ct.contract_id=(v_spec->>1)
        and ct.client_key=v_client_key
        and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      limit 1;
      if v_contract_key is null then raise exception 'RADIO_STAGE2A_CONTRACT_CONTEXT_MISSING'; end if;

      insert into portal_private.client_user_bindings(
        id,user_id,client_key,contract_key,status,valid_from,valid_to,
        granted_by,granted_at,revoked_at,revoked_by,reason,created_at,updated_at,
        source_system,source_version,source_timestamp,import_batch_id,
        authority_state,lifecycle_state,deal_scope_mode
      ) values(
        pg_catalog.gen_random_uuid(),p_portal_id,v_client_key,v_contract_key,
        'ACTIVE'::portal_private.binding_status_enum,
        v_ts,null,null,v_ts,null,null,
        'Temporary Radio Stage2A GitHub OIDC QA binding',v_ts,v_ts,
        v_source,v_source_version,v_ts,null,
        'CONFIRMED'::portal_private.authority_state_enum,
        'ACTIVE'::portal_private.lifecycle_state_enum,
        'ALL_CONTRACT_DEALS'
      );
    end loop;
  end if;

  return pg_catalog.jsonb_build_object(
    'portal_id',p_portal_id::text,
    'role',v_role::text,
    'retired_auth_user_ids',to_jsonb(v_old_auth_ids)
  );
end
$function$;

revoke all on function portal_private.radio_stage2a_provision_identity_v1(uuid,uuid,uuid,text,text) from public;
revoke all on function portal_private.radio_stage2a_provision_identity_v1(uuid,uuid,uuid,text,text) from anon;
revoke all on function portal_private.radio_stage2a_provision_identity_v1(uuid,uuid,uuid,text,text) from authenticated;
grant execute on function portal_private.radio_stage2a_provision_identity_v1(uuid,uuid,uuid,text,text) to service_role;

comment on function portal_private.radio_stage2a_operational_directory_v1() is
  'QA-only Stage 2A operational directory snapshot. No business mutation. EXECUTE restricted to service_role.';

comment on function portal_private.radio_stage2a_provision_identity_v1(uuid,uuid,uuid,text,text) is
  'QA-only Stage 2A transactional identity provisioning. Mutates only QA portal identities/bindings and never real business identities. EXECUTE restricted to service_role.';

commit;
