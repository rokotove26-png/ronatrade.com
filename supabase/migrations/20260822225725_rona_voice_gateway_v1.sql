begin;

create table if not exists portal_private.voice_gateway_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  inbound_enabled boolean not null default false,
  outbound_enabled boolean not null default false,
  provider text not null default 'UNCONFIGURED',
  provider_state text not null default 'BLOCKED' check (provider_state in ('BLOCKED','CONFIGURED','TESTING','READY','ERROR')),
  openai_realtime_state text not null default 'BLOCKED' check (openai_realtime_state in ('BLOCKED','CONFIGURED','TESTING','READY','ERROR')),
  model_execution_state text not null default 'BLOCKED' check (model_execution_state in ('BLOCKED','TESTING','READY','ERROR')),
  activation_gate text not null default 'FOUNDATION' check (activation_gate in ('FOUNDATION','INBOUND_TEST','OUTBOUND_TEST','PRODUCTION_READY')),
  identity_policy text not null default 'AUTHORITATIVE_MAPPING_REQUIRED' check (identity_policy='AUTHORITATIVE_MAPPING_REQUIRED'),
  recording_policy text not null default 'DISABLED' check (recording_policy in ('DISABLED','CONSENT_REQUIRED','ENABLED_BY_POLICY')),
  transcript_policy text not null default 'METADATA_ONLY' check (transcript_policy in ('METADATA_ONLY','TRANSCRIPT_ALLOWED')),
  human_failover_state text not null default 'UNCONFIGURED' check (human_failover_state in ('UNCONFIGURED','CONFIGURED','TESTED')),
  source_system text not null default 'RONA_VOICE_GATEWAY_V1',
  configured_at timestamptz null,
  activated_at timestamptz null,
  updated_by uuid null references portal_private.portal_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (enabled or (not inbound_enabled and not outbound_enabled)),
  check (not inbound_enabled or (provider_state='READY' and openai_realtime_state='READY' and model_execution_state='READY')),
  check (not outbound_enabled or (provider_state='READY' and openai_realtime_state='READY' and model_execution_state='READY'))
);

insert into portal_private.voice_gateway_control(singleton)
values(true)
on conflict (singleton) do nothing;

create table if not exists portal_private.voice_calls (
  id uuid primary key default gen_random_uuid(),
  provider_call_id text null,
  openai_call_id text null,
  direction text not null check (direction in ('INBOUND','OUTBOUND')),
  from_e164 text null check (from_e164 is null or from_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  to_e164 text null check (to_e164 is null or to_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  routed_role portal_private.ai_business_role_enum null,
  identity_state text not null default 'UNVERIFIED' check (identity_state in ('UNVERIFIED','VERIFIED','FAILED','NOT_REQUIRED')),
  authority_mapping_ref text null,
  source_record_id uuid null references portal_private.ai_coordination_records(record_id) on delete set null,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','RINGING','ACCEPTED','ACTIVE','TRANSFERRED','COMPLETED','REJECTED','FAILED','BLOCKED')),
  purpose text null,
  recording_state text not null default 'DISABLED' check (recording_state in ('DISABLED','CONSENT_PENDING','RECORDING','STOPPED','PURGED')),
  transcript_state text not null default 'METADATA_ONLY' check (transcript_state in ('METADATA_ONLY','TRANSCRIPT_ALLOWED','PURGED')),
  last_error_code text null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  answered_at timestamptz null,
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (routed_role is null or routed_role <> 'SYSTEM_ADMIN'::portal_private.ai_business_role_enum),
  check (identity_state='VERIFIED' or authority_mapping_ref is null)
);

create unique index if not exists voice_calls_provider_call_id_uidx
  on portal_private.voice_calls(provider_call_id)
  where provider_call_id is not null;
create unique index if not exists voice_calls_openai_call_id_uidx
  on portal_private.voice_calls(openai_call_id)
  where openai_call_id is not null;
create index if not exists voice_calls_status_idx
  on portal_private.voice_calls(status, started_at desc);
create index if not exists voice_calls_source_record_idx
  on portal_private.voice_calls(source_record_id)
  where source_record_id is not null;

create table if not exists portal_private.voice_call_events (
  id uuid primary key default gen_random_uuid(),
  voice_call_id uuid not null references portal_private.voice_calls(id) on delete cascade,
  event_type text not null,
  event_source text not null check (event_source in ('RONA_GATEWAY','OPENAI','TELEPHONY_PROVIDER','ADMIN_WORKFLOW','SYSTEM')),
  payload_hash text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists voice_call_events_call_idx
  on portal_private.voice_call_events(voice_call_id, created_at);

create table if not exists portal_private.voice_outbound_requests (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid not null references portal_private.ai_coordination_records(record_id) on delete restrict,
  target_role portal_private.ai_business_role_enum not null,
  destination_e164 text not null check (destination_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  purpose text not null check (length(btrim(purpose)) between 1 and 500),
  authorization_state text not null default 'PENDING' check (authorization_state in ('PENDING','AUTHORIZED','DENIED','BLOCKED')),
  state text not null default 'REQUESTED' check (state in ('REQUESTED','AUTHORIZED','BLOCKED','DISPATCHED','COMPLETED','FAILED','CANCELLED')),
  authorization_ref text null,
  idempotency_key text not null,
  requested_by uuid null references portal_private.portal_users(id),
  dispatch_call_id uuid null references portal_private.voice_calls(id) on delete set null,
  last_error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(idempotency_key),
  check (target_role <> 'SYSTEM_ADMIN'::portal_private.ai_business_role_enum),
  check (authorization_state='AUTHORIZED' or state not in ('AUTHORIZED','DISPATCHED','COMPLETED'))
);

create index if not exists voice_outbound_requests_state_idx
  on portal_private.voice_outbound_requests(state, created_at desc);
create index if not exists voice_outbound_requests_source_idx
  on portal_private.voice_outbound_requests(source_record_id, created_at desc);

create or replace function portal_private.voice_gateway_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, portal_private
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function portal_private.voice_call_events_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, portal_private
as $$
begin
  raise exception 'VOICE_CALL_EVENTS_IMMUTABLE';
end;
$$;

drop trigger if exists trg_voice_gateway_control_touch on portal_private.voice_gateway_control;
create trigger trg_voice_gateway_control_touch
before update on portal_private.voice_gateway_control
for each row execute function portal_private.voice_gateway_touch_updated_at();

drop trigger if exists trg_voice_calls_touch on portal_private.voice_calls;
create trigger trg_voice_calls_touch
before update on portal_private.voice_calls
for each row execute function portal_private.voice_gateway_touch_updated_at();

drop trigger if exists trg_voice_outbound_requests_touch on portal_private.voice_outbound_requests;
create trigger trg_voice_outbound_requests_touch
before update on portal_private.voice_outbound_requests
for each row execute function portal_private.voice_gateway_touch_updated_at();

drop trigger if exists trg_voice_call_events_immutable on portal_private.voice_call_events;
create trigger trg_voice_call_events_immutable
before update or delete on portal_private.voice_call_events
for each row execute function portal_private.voice_call_events_immutable();

revoke all on portal_private.voice_gateway_control from anon, authenticated;
revoke all on portal_private.voice_calls from anon, authenticated;
revoke all on portal_private.voice_call_events from anon, authenticated;
revoke all on portal_private.voice_outbound_requests from anon, authenticated;
revoke all on function portal_private.voice_gateway_touch_updated_at() from public, anon, authenticated;
revoke all on function portal_private.voice_call_events_immutable() from public, anon, authenticated;

commit;
