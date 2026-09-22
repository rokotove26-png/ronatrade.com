-- ADMIN ACCESS — permanent user deletion must preserve immutable business/audit history.
--
-- Incident:
-- Admin -> Клиенты и агенты -> Удалить пользователя returned AUTH delete failure.
-- The portal user's live auth link was correctly cleared before Supabase Auth deletion,
-- but audit-preserved portal_reverse_events still referenced auth.users through a
-- RESTRICT foreign key. That made the Auth hard-delete impossible whenever the user
-- had historical reverse events.
--
-- Contract:
-- * reverse-event actor_auth_user_id remains immutable, NOT NULL historical evidence;
-- * identity is verified against the live Auth + Portal binding at INSERT time;
-- * historical evidence intentionally does not keep a live FK to auth.users;
-- * failed hard-delete users remain fail-closed but visible to Admin as retryable
--   deletionPending rows until Auth deletion is completed.

begin;

create or replace function portal_private.validate_reverse_event_actor_auth_identity_v1()
returns trigger
language plpgsql
set search_path to 'pg_catalog','portal_private','auth'
as $fn$
begin
  if not exists (
    select 1
    from portal_private.portal_users pu
    join auth.users au on au.id=new.actor_auth_user_id
    where pu.id=new.actor_user_id
      and pu.auth_user_id=new.actor_auth_user_id
      and pu.status='ACTIVE'::portal_private.portal_user_status_enum
      and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  ) then
    raise exception using errcode='23514', message='REVERSE_EVENT_ACTOR_AUTH_IDENTITY_INVALID';
  end if;
  return new;
end
$fn$;

revoke all on function portal_private.validate_reverse_event_actor_auth_identity_v1()
  from public,anon,authenticated,service_role;

drop trigger if exists ab_reverse_event_actor_auth_identity_v1
  on portal_private.portal_reverse_events;

create trigger ab_reverse_event_actor_auth_identity_v1
before insert on portal_private.portal_reverse_events
for each row execute function portal_private.validate_reverse_event_actor_auth_identity_v1();

alter table portal_private.portal_reverse_events
  drop constraint if exists portal_reverse_events_actor_auth_user_id_fkey;

comment on column portal_private.portal_reverse_events.actor_auth_user_id is
'Immutable historical Auth subject snapshot. Validated against auth.users and portal_users on INSERT; intentionally not a live FK so permanent Auth account deletion cannot rewrite or delete audit-preserved reverse events.';

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

  with candidate_users as (
    select
      u.*,
      exists(
        select 1
        from portal_private.audit_events f
        where f.entity_type='PORTAL_USER'
          and f.entity_id=u.id::text
          and f.action='PORTAL_USER_DELETE_AUTH_FAILED_BY_ADMIN'
          and not exists(
            select 1
            from portal_private.audit_events s
            where s.entity_type='PORTAL_USER'
              and s.entity_id=u.id::text
              and s.action='PORTAL_USER_DELETED_BY_ADMIN'
              and s.event_at>f.event_at
          )
      ) as deletion_pending
    from portal_private.portal_users u
    where left(coalesce(u.source_system,''),3)<>'QA_'
      and left(lower(coalesce(u.login_name,'')),3)<>'qa_'
      and left(lower(coalesce(u.login_name,'')),4)<>'g81_'
      and not exists(
        select 1
        from portal_private.portal_user_roles r
        where r.user_id=u.id
          and r.role::text='ADMIN'
          and r.status::text='ACTIVE'
          and r.revoked_at is null
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,
    'name',u.display_name,
    'login',u.login_name,
    'status',u.status::text,
    'lifecycleState',u.lifecycle_state::text,
    'deletionPending',u.deletion_pending,
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
  from candidate_users u
  where u.deletion_pending
     or exists(
       select 1
       from portal_private.portal_user_roles r
       where r.user_id=u.id
         and r.role::text in ('CLIENT','AGENT')
         and r.status::text='ACTIVE'
         and r.revoked_at is null
     );

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
      and not exists(
        select 1
        from portal_private.portal_user_roles ar
        where ar.user_id=eu.id
          and ar.role::text='ADMIN'
          and ar.status::text='ACTIVE'
          and ar.revoked_at is null
      )
      and (
        exists(
          select 1
          from portal_private.portal_user_roles r
          where r.user_id=eu.id
            and r.role::text in ('CLIENT','AGENT')
            and r.status::text='ACTIVE'
            and r.revoked_at is null
        )
        or exists(
          select 1
          from portal_private.audit_events f
          where f.entity_type='PORTAL_USER'
            and f.entity_id=eu.id::text
            and f.action='PORTAL_USER_DELETE_AUTH_FAILED_BY_ADMIN'
            and not exists(
              select 1
              from portal_private.audit_events s
              where s.entity_type='PORTAL_USER'
                and s.entity_id=eu.id::text
                and s.action='PORTAL_USER_DELETED_BY_ADMIN'
                and s.event_at>f.event_at
            )
        )
      )
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

do $qa$
declare
  v_fk_count integer;
  v_trigger_count integer;
  v_nullable text;
begin
  select count(*)::int into v_fk_count
  from pg_constraint
  where contype='f'
    and conrelid='portal_private.portal_reverse_events'::regclass
    and confrelid='auth.users'::regclass;

  if v_fk_count<>0 then
    raise exception 'ADMIN_USER_DELETE_AUTH_HISTORY_QA_FAILED reverse_event_auth_fk_count=%',v_fk_count;
  end if;

  select count(*)::int into v_trigger_count
  from pg_trigger tg
  join pg_class c on c.oid=tg.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='portal_private'
    and c.relname='portal_reverse_events'
    and tg.tgname='ab_reverse_event_actor_auth_identity_v1'
    and not tg.tgisinternal;

  if v_trigger_count<>1 then
    raise exception 'ADMIN_USER_DELETE_AUTH_HISTORY_QA_FAILED validation_trigger_count=%',v_trigger_count;
  end if;

  select is_nullable into v_nullable
  from information_schema.columns
  where table_schema='portal_private'
    and table_name='portal_reverse_events'
    and column_name='actor_auth_user_id';

  if v_nullable is distinct from 'NO' then
    raise exception 'ADMIN_USER_DELETE_AUTH_HISTORY_QA_FAILED actor_auth_user_id_nullable=%',v_nullable;
  end if;
end
$qa$;

commit;
