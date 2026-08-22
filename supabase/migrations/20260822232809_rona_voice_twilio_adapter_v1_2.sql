begin;

alter table portal_private.voice_gateway_control
  drop constraint if exists voice_gateway_control_provider_mode_check;

alter table portal_private.voice_gateway_control
  add constraint voice_gateway_control_provider_mode_check
  check (provider_mode in ('UNCONFIGURED','PLIVO_SIP_BRIDGE','TWILIO_SIP_BRIDGE'));

commit;
