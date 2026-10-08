-- portal_private RLS hardening V2
-- Owner instruction 2026-10-08.
-- Audit evidence:
-- - all 10 tables are owned by postgres;
-- - only postgres has direct table grants;
-- - postgres has BYPASSRLS;
-- - known application access paths are postgres-owned SECURITY DEFINER functions.
-- Therefore ENABLE RLS (without FORCE RLS and without permissive policies) is fail-closed
-- for future direct non-bypass roles while preserving current owner-definer runtime semantics.

alter table portal_private.agent_reward_owner_corrections_v1 enable row level security;
alter table portal_private.ai_office_domain_routing_v1 enable row level security;
alter table portal_private.ai_staff_directory_v1 enable row level security;
alter table portal_private.finance_canonical_report_registry_v1 enable row level security;
alter table portal_private.owner_canonical_document_asset_manifest_v2 enable row level security;
alter table portal_private.owner_radio_notification_reads enable row level security;
alter table portal_private.rail_deal_monitoring_control_v1 enable row level security;
alter table portal_private.role_mail_intake_alerts_v1 enable row level security;
alter table portal_private.role_mail_intake_control_v1 enable row level security;
alter table portal_private.role_mail_intake_v1 enable row level security;

revoke all on table portal_private.agent_reward_owner_corrections_v1 from public,anon,authenticated,service_role;
revoke all on table portal_private.ai_office_domain_routing_v1 from public,anon,authenticated,service_role;
revoke all on table portal_private.ai_staff_directory_v1 from public,anon,authenticated,service_role;
revoke all on table portal_private.finance_canonical_report_registry_v1 from public,anon,authenticated,service_role;
revoke all on table portal_private.owner_canonical_document_asset_manifest_v2 from public,anon,authenticated,service_role;
revoke all on table portal_private.owner_radio_notification_reads from public,anon,authenticated,service_role;
revoke all on table portal_private.rail_deal_monitoring_control_v1 from public,anon,authenticated,service_role;
revoke all on table portal_private.role_mail_intake_alerts_v1 from public,anon,authenticated,service_role;
revoke all on table portal_private.role_mail_intake_control_v1 from public,anon,authenticated,service_role;
revoke all on table portal_private.role_mail_intake_v1 from public,anon,authenticated,service_role;

comment on table portal_private.agent_reward_owner_corrections_v1 is 'Private owner correction overlays. RLS enabled; direct anon/authenticated/service_role access denied. Existing postgres-owned SECURITY DEFINER access remains canonical.';
comment on table portal_private.ai_office_domain_routing_v1 is 'Private AI office routing registry. RLS enabled; direct client/service API roles denied.';
comment on table portal_private.ai_staff_directory_v1 is 'Private AI staff directory. RLS enabled; expose only through authority-checked functions.';
comment on table portal_private.finance_canonical_report_registry_v1 is 'Private Finance canonical report registry. RLS enabled; expose only through canonical report functions.';
comment on table portal_private.owner_canonical_document_asset_manifest_v2 is 'Private canonical document asset manifest. RLS enabled; owner-definer functions remain authoritative.';
comment on table portal_private.owner_radio_notification_reads is 'Private owner radio read-state table. RLS enabled; no direct client/service API grants.';
comment on table portal_private.rail_deal_monitoring_control_v1 is 'Private rail monitoring control. RLS enabled; access remains through owner/admin SECURITY DEFINER functions.';
comment on table portal_private.role_mail_intake_alerts_v1 is 'Private role-mail intake alerts. RLS enabled; runtime access remains through postgres-owned worker functions.';
comment on table portal_private.role_mail_intake_control_v1 is 'Private role-mail intake control. RLS enabled; runtime access remains through postgres-owned worker functions.';
comment on table portal_private.role_mail_intake_v1 is 'Private role-mail intake queue. RLS enabled; runtime access remains through postgres-owned worker functions.';
