begin;

create table if not exists portal_private.admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  actor_admin_portal_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  actor_admin_auth_user_id uuid not null,
  actor_admin_session_id uuid not null,
  effective_portal_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  effective_role portal_private.portal_role_enum not null,
  target_client_key uuid references portal_private.clients(id) on delete restrict,
  target_agent_person_key uuid references portal_private.agent_persons(id) on delete restrict,
  return_view text not null,
  correlation_id uuid not null,
  status text not null default 'ACTIVE',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  end_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_impersonation_role_check check (effective_role in ('CLIENT'::portal_private.portal_role_enum,'AGENT'::portal_private.portal_role_enum)),
  constraint admin_impersonation_target_check check (
    (effective_role='CLIENT'::portal_private.portal_role_enum and target_client_key is not null and target_agent_person_key is null)
    or
    (effective_role='AGENT'::portal_private.portal_role_enum and target_client_key is null and target_agent_person_key is not null)
  ),
  constraint admin_impersonation_return_view_check check (return_view in ('companies','agents')),
  constraint admin_impersonation_status_check check (status in ('ACTIVE','ENDED','REVOKED','EXPIRED')),
  constraint admin_impersonation_expiry_check check (expires_at > started_at)
);

create unique index if not exists admin_impersonation_one_active_per_admin_session
  on portal_private.admin_impersonation_sessions(actor_admin_session_id)
  where status='ACTIVE' and ended_at is null;

create index if not exists admin_impersonation_effective_user_idx
  on portal_private.admin_impersonation_sessions(effective_portal_user_id,status,expires_at);

create table if not exists portal_private.admin_impersonation_events (
  id uuid primary key default gen_random_uuid(),
  impersonation_session_id uuid not null references portal_private.admin_impersonation_sessions(id) on delete restrict,
  actor_admin_portal_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  actor_admin_auth_user_id uuid not null,
  actor_admin_session_id uuid not null,
  effective_portal_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  effective_role portal_private.portal_role_enum not null,
  target_client_key uuid references portal_private.clients(id) on delete restrict,
  target_agent_person_key uuid references portal_private.agent_persons(id) on delete restrict,
  request_id uuid not null,
  correlation_id uuid not null,
  method text not null,
  route text not null,
  action text not null,
  result text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_impersonation_events_session_idx
  on portal_private.admin_impersonation_events(impersonation_session_id,created_at);

create or replace function portal_private.reject_impersonation_event_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog','portal_private'
as $$
begin
  raise exception 'ADMIN_IMPERSONATION_EVENT_IMMUTABLE';
end;
$$;

drop trigger if exists admin_impersonation_events_immutable on portal_private.admin_impersonation_events;
create trigger admin_impersonation_events_immutable
before update or delete on portal_private.admin_impersonation_events
for each row execute function portal_private.reject_impersonation_event_mutation();

create table if not exists portal_private.admin_entity_retirement_operations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_key uuid not null,
  entity_public_id text not null,
  actor_admin_portal_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  actor_admin_auth_user_id uuid not null,
  actor_admin_session_id uuid not null,
  status text not null default 'PREFLIGHT',
  nonce_hash text not null,
  impact_hash text not null,
  preview jsonb not null,
  expires_at timestamptz not null,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint admin_entity_retirement_entity_check check (entity_type in ('COMPANY','AGENT')),
  constraint admin_entity_retirement_status_check check (status in ('PREFLIGHT','RETIRING','AUTH_CLEANUP_PENDING','VERIFYING','COMPLETED','FAILED_RETRYABLE'))
);

create index if not exists admin_entity_retirement_lookup_idx
  on portal_private.admin_entity_retirement_operations(entity_type,entity_key,created_at desc);

create table if not exists portal_private.admin_auth_cleanup_outbox (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references portal_private.admin_entity_retirement_operations(id) on delete restrict,
  portal_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  auth_user_id uuid not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint admin_auth_cleanup_status_check check (status in ('PENDING','COMPLETED','FAILED_RETRYABLE')),
  unique(operation_id,auth_user_id)
);

revoke all on portal_private.admin_impersonation_sessions from anon, authenticated;
revoke all on portal_private.admin_impersonation_events from anon, authenticated;
revoke all on portal_private.admin_entity_retirement_operations from anon, authenticated;
revoke all on portal_private.admin_auth_cleanup_outbox from anon, authenticated;

create or replace function portal_private.server_admin_impersonated_client_submit_application_v12(
  p_impersonation_session_id uuid,
  p_actor_admin_portal_user_id uuid,
  p_actor_admin_auth_user_id uuid,
  p_actor_admin_session_id uuid,
  p_effective_portal_user_id uuid,
  p_client_id text,
  p_contract_id text,
  p_publication_item_id uuid,
  p_quantity_tonnes numeric,
  p_price_mode portal_private.price_mode_enum,
  p_proposed_price numeric,
  p_proposed_currency character,
  p_destination_country text,
  p_destination_station text,
  p_delivery_period_from date,
  p_delivery_period_to date,
  p_idempotency_key text,
  p_request_id uuid,
  p_correlation_id uuid
)
returns table(application_id text,status text)
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  r record;
  app_id text;
  app_key uuid;
  existing portal_private.client_applications;
  receipt portal_private.client_application_submit_receipts_v2;
  fingerprint text;
begin
  perform portal_private.application_operations_authority_v2();
  perform set_config('rona.application_atomic_bundle','on',true);

  if p_quantity_tonnes is null or p_quantity_tonnes<=0 then raise exception 'QUANTITY_INVALID'; end if;
  if btrim(coalesce(p_destination_country,''))='' or btrim(coalesce(p_destination_station,''))='' then raise exception 'DESTINATION_REQUIRED'; end if;
  if p_delivery_period_to is not null and p_delivery_period_from is not null and p_delivery_period_to<p_delivery_period_from then raise exception 'DELIVERY_PERIOD_INVALID'; end if;
  if btrim(coalesce(p_idempotency_key,''))='' or length(p_idempotency_key)>160 then raise exception 'IDEMPOTENCY_REQUIRED'; end if;

  select pu.id portal_user_id,cl.id client_key,ct.id contract_key,pi.id publication_item_key,
         pi.product,pi.price,pi.currency,pi.payment_terms,pi.delivery_period_from,pi.delivery_period_to
    into r
  from portal_private.admin_impersonation_sessions ais
  join portal_private.portal_users pu on pu.id=ais.effective_portal_user_id
  join portal_private.clients cl on cl.id=ais.target_client_key and cl.client_id=p_client_id
  join portal_private.contracts ct on ct.contract_id=p_contract_id and ct.client_key=cl.id
  join portal_private.publication_items pi on pi.id=p_publication_item_id
  join portal_private.publications pub on pub.id=pi.publication_key
  where ais.id=p_impersonation_session_id
    and ais.actor_admin_portal_user_id=p_actor_admin_portal_user_id
    and ais.actor_admin_auth_user_id=p_actor_admin_auth_user_id
    and ais.actor_admin_session_id=p_actor_admin_session_id
    and ais.effective_portal_user_id=p_effective_portal_user_id
    and ais.effective_role='CLIENT'::portal_private.portal_role_enum
    and ais.status='ACTIVE'
    and ais.ended_at is null
    and ais.expires_at>now()
    and pu.status='ACTIVE'::portal_private.portal_user_status_enum
    and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and pu.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and portal_private.client_user_has_contract_access(p_effective_portal_user_id,ct.id,now())
    and pub.status::text='PUBLISHED'
    and pub.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
    and pi.item_type::text='PRICE'
    and pi.distribution_allowed
    and pi.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
    and ((pub.audience<>'SELECTED_CLIENTS' and pi.audience<>'SELECTED_CLIENTS') or exists(
      select 1 from portal_private.publication_client_targets pct
      where pct.publication_key=pub.id and pct.client_key=cl.id
        and (pct.target_scope='PUBLICATION' or (pct.target_scope='ITEM' and pct.publication_item_key=pi.id))
    ))
    and (pi.valid_from is null or pi.valid_from<=now())
    and (pi.valid_to is null or pi.valid_to>=now());

  if not found then raise exception 'CLIENT_PRICE_CONTEXT_DENIED'; end if;

  if p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then
    if p_proposed_price is not null or p_proposed_currency is not null then raise exception 'PUBLISHED_PRICE_OVERPOST'; end if;
  elsif p_price_mode::text='CLIENT_PROPOSED_PRICE' then
    if p_proposed_price is null or p_proposed_price<=0 or p_proposed_currency is null or btrim(p_proposed_currency::text)!~'^[A-Z]{3}$'
      then raise exception 'PROPOSED_PRICE_REQUIRED'; end if;
  else
    raise exception 'PRICE_MODE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('APPLICATION_SUBMIT:'||r.client_key::text||':'||r.contract_key::text||':'||p_idempotency_key,0));
  fingerprint:=encode(extensions.digest(jsonb_build_object(
    'publication_item_id',p_publication_item_id,'quantity',p_quantity_tonnes,
    'price_mode',p_price_mode::text,'proposed_price',p_proposed_price,'proposed_currency',p_proposed_currency,
    'country',btrim(p_destination_country),'station',btrim(p_destination_station),
    'period_from',p_delivery_period_from,'period_to',p_delivery_period_to
  )::text,'sha256'),'hex');

  select * into receipt
  from portal_private.client_application_submit_receipts_v2 sr
  where sr.client_key=r.client_key and sr.contract_key=r.contract_key and sr.idempotency_key=p_idempotency_key;

  if found then
    if receipt.request_fingerprint<>fingerprint then raise exception 'APPLICATION_IDEMPOTENCY_PAYLOAD_CONFLICT'; end if;
    select * into existing from portal_private.client_applications a where a.application_id=receipt.application_id;
    if not found then raise exception 'APPLICATION_RETIRED_NO_RESUBMISSION'; end if;
    return query select existing.application_id,existing.status::text;
    return;
  end if;

  select * into existing
  from portal_private.client_applications a
  where a.client_key=r.client_key and a.contract_key=r.contract_key
    and a.source_submission_state='V1_2_IDEMPOTENCY:'||p_idempotency_key;

  if found then
    if existing.source_publication_item_id is distinct from p_publication_item_id
      or existing.quantity_tonnes is distinct from p_quantity_tonnes
      or existing.price_mode is distinct from p_price_mode
      or existing.destination is distinct from btrim(p_destination_country)||' / '||btrim(p_destination_station)
    then raise exception 'LEGACY_APPLICATION_RECEIPT_CONFLICT'; end if;
    return query select existing.application_id,existing.status::text;
    return;
  end if;

  if exists(
    select 1 from portal_private.client_application_tombstones_v2 t
    where t.application_snapshot->>'source_submission_state'='V1_2_IDEMPOTENCY:'||p_idempotency_key
      and t.application_snapshot->>'client_key'=r.client_key::text
      and t.application_snapshot->>'contract_key'=r.contract_key::text
  ) then raise exception 'APPLICATION_RETIRED_NO_RESUBMISSION'; end if;

  app_id:=portal_private.next_application_business_id(r.client_key);

  insert into portal_private.client_applications(
    application_id,client_key,contract_key,source_publication_id,source_publication_item_id,product,quantity_tonnes,
    delivery_period_from,delivery_period_to,delivery_basis,destination,delivery_method,payment_terms,price_mode,
    proposed_price,proposed_currency,status,submitted_at,source_system,source_version,source_timestamp,
    authority_state,lifecycle_state,source_price_mode,source_submission_state
  )
  select app_id,r.client_key,r.contract_key,pi.publication_key,r.publication_item_key,r.product,p_quantity_tonnes,
         p_delivery_period_from,p_delivery_period_to,pi.basis,
         btrim(p_destination_country)||' / '||btrim(p_destination_station),
         'TO_BE_CONFIRMED',coalesce(r.payment_terms,'TO_VERIFY'),p_price_mode,p_proposed_price,p_proposed_currency,
         'SUBMITTED',now(),'CLIENT_PORTAL','APPLICATION_BUSINESS_V2',now(),'SOURCE_RECEIVED','ACTIVE',
         case when p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then 'PUBLISHED_PRICE' else 'CLIENT_PROPOSED_PRICE' end,
         'V1_2_IDEMPOTENCY:'||p_idempotency_key
  from portal_private.publication_items pi
  where pi.id=r.publication_item_key
  returning id into app_key;

  insert into portal_private.application_lines(
    application_key,line_no,publication_item_key,product,quantity_tonnes,price_mode,published_price,
    proposed_price,currency,source_mode
  ) values(
    app_key,1,r.publication_item_key,r.product,p_quantity_tonnes,p_price_mode,r.price,p_proposed_price,
    case when p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then r.currency else p_proposed_currency end,
    case when p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then 'PUBLISHED_PRICE' else 'CLIENT_PROPOSED_PRICE' end
  );

  insert into portal_private.client_application_submit_receipts_v2(
    client_key,contract_key,idempotency_key,request_fingerprint,application_id
  ) values(r.client_key,r.contract_key,p_idempotency_key,fingerprint,app_id);

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata
  ) values(
    p_actor_admin_portal_user_id,'ADMIN','APPLICATION_SUBMIT_V12_IMPERSONATED','APPLICATION',app_id,p_request_id,p_correlation_id,
    jsonb_build_object(
      'client_id',p_client_id,
      'contract_id',p_contract_id,
      'price_mode',p_price_mode::text,
      'data_contract','APPLICATION_BUSINESS_V2',
      'request_fingerprint',fingerprint,
      'impersonation_session_id',p_impersonation_session_id,
      'effective_portal_user_id',p_effective_portal_user_id,
      'effective_role','CLIENT'
    )
  );

  return query select app_id,'SUBMITTED'::text;
end;
$$;

revoke all on function portal_private.server_admin_impersonated_client_submit_application_v12(
  uuid,uuid,uuid,uuid,uuid,text,text,uuid,numeric,portal_private.price_mode_enum,numeric,character,text,text,date,date,text,uuid,uuid
) from public,anon,authenticated;

create or replace function portal_private.server_admin_impersonated_submit_reverse_event(
  p_impersonation_session_id uuid,
  p_actor_admin_portal_user_id uuid,
  p_actor_admin_auth_user_id uuid,
  p_actor_admin_session_id uuid,
  p_effective_portal_user_id uuid,
  p_event_type text,
  p_authority_domain text,
  p_target_type text,
  p_target_id text,
  p_client_id text,
  p_contract_id text,
  p_deal_id text,
  p_payload jsonb,
  p_idempotency_key text,
  p_request_id uuid default null,
  p_correlation_id uuid default null
)
returns table(
  event_key uuid,
  event_id text,
  processing_state text,
  acknowledgement_state text,
  created_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private','auth'
as $
declare
  v_role portal_private.portal_role_enum;
  v_target_client uuid;
  v_target_agent uuid;
  v_client uuid;
  v_contract uuid;
  v_deal uuid;
  v_allowed boolean:=false;
  v_existing portal_private.portal_reverse_events%rowtype;
  v_event_id text;
  v_imp_correlation uuid;
begin
  if coalesce(btrim(p_event_type),'')=''
     or coalesce(btrim(p_authority_domain),'')=''
     or coalesce(btrim(p_target_type),'')=''
     or coalesce(btrim(p_idempotency_key),'')='' then
    raise exception 'reverse event required fields missing';
  end if;

  if p_event_type not in (
    'CLIENT_APPLICATION_SUBMIT','CLIENT_CLAIM_SUBMIT','CLIENT_PAYMENT_PROOF_SUBMIT',
    'CLIENT_MESSAGE_SUBMIT','CLIENT_DOCUMENT_ACK','AGENT_MESSAGE_SUBMIT','AGENT_NOTE_SUBMIT'
  ) then
    raise exception 'unsupported impersonated reverse event type';
  end if;

  select ais.effective_role,ais.target_client_key,ais.target_agent_person_key,ais.correlation_id
    into v_role,v_target_client,v_target_agent,v_imp_correlation
  from portal_private.admin_impersonation_sessions ais
  join portal_private.portal_users effective on effective.id=ais.effective_portal_user_id
  join portal_private.portal_user_roles er
    on er.user_id=effective.id
   and er.role=ais.effective_role
   and er.status='ACTIVE'::portal_private.binding_status_enum
   and er.revoked_at is null
  where ais.id=p_impersonation_session_id
    and ais.actor_admin_portal_user_id=p_actor_admin_portal_user_id
    and ais.actor_admin_auth_user_id=p_actor_admin_auth_user_id
    and ais.actor_admin_session_id=p_actor_admin_session_id
    and ais.effective_portal_user_id=p_effective_portal_user_id
    and ais.status='ACTIVE'
    and ais.ended_at is null
    and ais.expires_at>now()
    and effective.status='ACTIVE'::portal_private.portal_user_status_enum
    and effective.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and effective.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  limit 1;

  if v_role is null then raise exception 'impersonation session denied'; end if;

  if p_client_id is not null then
    select id into v_client from portal_private.clients where client_id=p_client_id;
    if v_client is null then raise exception 'client target not found'; end if;
  end if;
  if p_contract_id is not null then
    select id,client_key into v_contract,v_client
    from portal_private.contracts where contract_id=p_contract_id;
    if v_contract is null then raise exception 'contract target not found'; end if;
  end if;
  if p_deal_id is not null then
    select id,client_key,contract_key into v_deal,v_client,v_contract
    from portal_private.deals where deal_id=p_deal_id;
    if v_deal is null then raise exception 'deal target not found'; end if;
  end if;

  if v_role='CLIENT'::portal_private.portal_role_enum and p_event_type like 'CLIENT_%' then
    if v_target_client is null or v_client is distinct from v_target_client then
      raise exception 'impersonated client context denied';
    end if;
    if v_deal is not null then
      v_allowed:=portal_private.client_user_has_deal_access(p_effective_portal_user_id,v_deal,now());
    elsif v_contract is not null then
      v_allowed:=portal_private.client_user_has_contract_access(p_effective_portal_user_id,v_contract,now());
    end if;
  elsif v_role='AGENT'::portal_private.portal_role_enum and p_event_type like 'AGENT_%' then
    if v_target_agent is null or not exists(
      select 1
      from portal_private.agent_user_bindings b
      where b.user_id=p_effective_portal_user_id
        and b.agent_person_key=v_target_agent
        and b.status='ACTIVE'::portal_private.binding_status_enum
        and b.revoked_at is null
        and b.valid_from<=now()
        and (b.valid_to is null or b.valid_to>now())
        and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    ) then
      raise exception 'impersonated agent context denied';
    end if;
    if v_deal is not null then
      v_allowed:=portal_private.agent_user_has_deal_view_access(p_effective_portal_user_id,v_deal,now());
    elsif v_client is not null then
      v_allowed:=portal_private.agent_user_has_client_access(p_effective_portal_user_id,v_client,now());
    end if;
  end if;

  if not v_allowed then raise exception 'reverse event scope denied'; end if;

  select * into v_existing
  from portal_private.portal_reverse_events e
  where e.actor_user_id=p_effective_portal_user_id
    and e.idempotency_key=p_idempotency_key;

  if found then
    if v_existing.event_type is distinct from p_event_type
       or v_existing.authority_domain is distinct from p_authority_domain
       or v_existing.authority_target_type is distinct from p_target_type
       or v_existing.authority_target_id is distinct from p_target_id
       or v_existing.client_key is distinct from v_client
       or v_existing.contract_key is distinct from v_contract
       or v_existing.deal_key is distinct from v_deal
       or v_existing.payload is distinct from coalesce(p_payload,'{}'::jsonb) then
      raise exception 'idempotency key reused for different event';
    end if;
    return query
      select v_existing.id,v_existing.event_id,v_existing.processing_state,
             v_existing.acknowledgement_state,v_existing.created_at,true;
    return;
  end if;

  v_event_id:='PORTAL-EVT-'||replace(gen_random_uuid()::text,'-','');
  insert into portal_private.portal_reverse_events(
    event_id,idempotency_key,actor_user_id,actor_auth_user_id,actor_role,
    client_key,contract_key,deal_key,event_type,authority_domain,
    authority_target_type,authority_target_id,payload,processing_state,
    acknowledgement_state,request_id,correlation_id,source_version,
    source_timestamp,authority_state,lifecycle_state
  ) values(
    v_event_id,p_idempotency_key,p_effective_portal_user_id,p_actor_admin_auth_user_id,v_role,
    v_client,v_contract,v_deal,p_event_type,p_authority_domain,
    p_target_type,p_target_id,coalesce(p_payload,'{}'::jsonb),'RECEIVED',
    'PENDING',p_request_id,coalesce(p_correlation_id,v_imp_correlation),
    'ADMIN_IMPERSONATION_V1',now(),'SOURCE_RECEIVED','ACTIVE'
  )
  returning id,portal_reverse_events.event_id,portal_reverse_events.processing_state,
            portal_reverse_events.acknowledgement_state,portal_reverse_events.created_at
  into event_key,event_id,processing_state,acknowledgement_state,created_at;

  insert into portal_private.portal_reverse_event_attempts(
    event_key,attempt_number,processing_state,result,metadata
  ) values(
    event_key,1,'RECEIVED','STARTED',
    jsonb_build_object(
      'event_type',p_event_type,
      'actor_role',v_role::text,
      'impersonation_session_id',p_impersonation_session_id,
      'actor_admin_portal_user_id',p_actor_admin_portal_user_id,
      'effective_portal_user_id',p_effective_portal_user_id
    )
  );

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata
  ) values(
    p_actor_admin_portal_user_id,'ADMIN','REVERSE_EVENT_SUBMIT_IMPERSONATED','PORTAL_REVERSE_EVENT',v_event_id,
    coalesce(p_request_id,gen_random_uuid()),coalesce(p_correlation_id,v_imp_correlation),
    jsonb_build_object(
      'impersonation_session_id',p_impersonation_session_id,
      'effective_portal_user_id',p_effective_portal_user_id,
      'effective_role',v_role::text,
      'target_client_key',v_target_client,
      'target_agent_person_key',v_target_agent,
      'event_type',p_event_type
    )
  );

  reused:=false;
  return next;
end;
$;

revoke all on function portal_private.server_admin_impersonated_submit_reverse_event(
  uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,text,uuid,uuid
) from public,anon,authenticated;


comment on table portal_private.admin_impersonation_sessions is
  'Server-only Admin impersonation sessions. Real Admin actor identity is preserved separately from effective Client/Agent subject.';

comment on table portal_private.admin_impersonation_events is
  'Append-only immutable provenance for every request performed through an Admin impersonation session.';

comment on table portal_private.admin_entity_retirement_operations is
  'Fail-closed orchestration state for Company/Agent retirement from the active contour. Historical business entities are not deleted.';

commit;
