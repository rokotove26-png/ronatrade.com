begin;

alter table portal_private.voice_gateway_control
  add column if not exists provider_mode text not null default 'UNCONFIGURED',
  add column if not exists default_inbound_role portal_private.ai_business_role_enum not null default 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,
  add column if not exists provider_number_e164 text null,
  add column if not exists provider_verified_at timestamptz null;

alter table portal_private.voice_gateway_control
  drop constraint if exists voice_gateway_control_provider_mode_check;
alter table portal_private.voice_gateway_control
  add constraint voice_gateway_control_provider_mode_check
  check (provider_mode in ('UNCONFIGURED','PLIVO_SIP_BRIDGE'));

alter table portal_private.voice_gateway_control
  drop constraint if exists voice_gateway_control_default_inbound_role_check;
alter table portal_private.voice_gateway_control
  add constraint voice_gateway_control_default_inbound_role_check
  check (default_inbound_role <> 'SYSTEM_ADMIN'::portal_private.ai_business_role_enum);

alter table portal_private.voice_gateway_control
  drop constraint if exists voice_gateway_control_provider_number_e164_check;
alter table portal_private.voice_gateway_control
  add constraint voice_gateway_control_provider_number_e164_check
  check (provider_number_e164 is null or provider_number_e164 ~ '^\+[1-9][0-9]{7,14}$');

alter table portal_private.voice_outbound_requests
  add column if not exists provider_request_id text null,
  add column if not exists provider_name text null;

create index if not exists voice_outbound_requests_provider_request_idx
  on portal_private.voice_outbound_requests(provider_name, provider_request_id)
  where provider_request_id is not null;

update portal_private.voice_gateway_control
set provider_mode = case when provider='PLIVO' then 'PLIVO_SIP_BRIDGE' else provider_mode end
where singleton=true;

revoke all on portal_private.voice_gateway_control from anon, authenticated;
revoke all on portal_private.voice_outbound_requests from anon, authenticated;

commit;
