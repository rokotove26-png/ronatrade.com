-- RONA Trade production security hardening
-- Scope: portal_private RLS + public SECURITY DEFINER execute grants.
-- No business/financial data mutation.
-- Generated from live production catalog with a strict baseline guard.

set lock_timeout = '3s';

do $$
declare
  expected text[] := array[
      'admin_payments_v7_provider_readiness',
      'ai_coordination_audit_events',
      'ai_coordination_records',
      'ai_model_executor_control',
      'ai_model_executor_runs',
      'ai_read_access_events',
      'ai_role_global_policies_v1',
      'ai_role_state_checkpoints_v2',
      'ai_role_state_history_v2',
      'ai_runtime_control',
      'ai_runtime_queue',
      'ai_runtime_runs',
      'ai_service_identities',
      'canonical_prospect_enrichment',
      'canonical_prospect_exclusions',
      'canonical_prospects',
      'client_intake_audit_v1',
      'client_intake_corrections_v1',
      'client_intake_routing_outbox_v1',
      'client_intake_routing_registry_v1',
      'client_intake_task_links_v1',
      'client_intake_v1',
      'client_user_binding_profiles',
      'client_user_pending_company_bindings',
      'commercial_director_market_news_control',
      'commercial_director_market_news_processed_sources',
      'commercial_director_market_news_runs',
      'deal_execution_passport_allocations_v8',
      'deal_execution_resource_authority_v8',
      'deal_finance_authority_v7',
      'finance_approved_change_jobs_v7',
      'finance_cash_effective_daily_cache_v1',
      'finance_cash_operations_effective_cache_v1',
      'finance_cash_projection_cache_meta_v1',
      'finance_cash_reversal_pairs_cache_v1',
      'finance_cash_statement_checkpoint_cache_v1',
      'finance_cash_statement_summary_cache_v1',
      'finance_document_schedule_manifests_v8',
      'finance_events_v7',
      'finance_mail_intake_alerts_v1',
      'finance_mail_intake_control_v1',
      'finance_mail_intake_v1',
      'finance_materialization_attempts_v7',
      'finance_materialization_jobs_v7',
      'finance_materialization_maintenance_audit_v7',
      'finance_materializer_audit_v7',
      'finance_reconciliation_difference_components_v1',
      'finance_reconciliation_difference_publications_v1',
      'finance_schedule_integrity_alerts_v8',
      'finance_signed_schedule_jobs_v8',
      'market_intelligence_control',
      'market_intelligence_facts',
      'market_intelligence_forecast_snapshots',
      'market_intelligence_processed_sources',
      'market_intelligence_rules',
      'market_intelligence_runs',
      'market_intelligence_source_documents',
      'market_intelligence_source_processor_control',
      'market_intelligence_source_processor_runs',
      'market_intelligence_watchdog_events',
      'market_intelligence_watchdog_state',
      'market_news_source_refs',
      'market_news_versions',
      'mcp_gateway_config',
      'mcp_gateway_owner_allowlist',
      'mcp_gateway_request_events',
      'mcp_oauth_authorization_codes',
      'mcp_oauth_authorization_requests',
      'mcp_oauth_authorize_trace',
      'mcp_oauth_clients',
      'mcp_oauth_tokens',
      'owner_agent_commercial_proposals',
      'owner_agent_display_policies',
      'owner_application_workflow',
      'owner_canonical_document_assets',
      'owner_canonical_document_standards',
      'owner_cash_snapshots',
      'owner_claims',
      'owner_deal_documents',
      'owner_deal_finance_summary',
      'owner_deal_workflow',
      'owner_outgoing_payment_facts',
      'owner_payment_decision_audit_v7',
      'owner_payment_plan',
      'owner_price_change_proposals',
      'owner_price_list_controls',
      'owner_price_snapshots',
      'owner_pricing_governance_rules',
      'owner_radio_items',
      'owner_rail_tariff_matrix',
      'payment_business_attributions_v7',
      'payment_passport_finance_allocations_v7',
      'payment_resource_chains_v7',
      'phase2b2_qa_guard',
      'public_market_news_ingest_runs',
      'telegram_market_channels',
      'telegram_market_documents',
      'telegram_market_ingest_runs',
      'voice_call_events',
      'voice_calls',
      'voice_gateway_control',
      'voice_outbound_requests'
  ]::text[];
  actual text[];
begin
  select array_agg(c.relname order by c.relname)
    into actual
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='portal_private'
    and c.relkind in ('r','p')
    and not c.relrowsecurity;

  if actual is distinct from expected then
    raise exception 'PORTAL_PRIVATE_RLS_BASELINE_DRIFT';
  end if;

  if has_schema_privilege('anon','portal_private','USAGE')
     or has_schema_privilege('authenticated','portal_private','USAGE') then
    raise exception 'PORTAL_PRIVATE_SCHEMA_GRANT_DRIFT';
  end if;
end $$;

-- Preserve the active Payments/Finance NOLOGIN reader before RLS becomes active.
create policy sa_rdr_provider_readiness_v1
  on portal_private.admin_payments_v7_provider_readiness
  for select to rona_payments_v7_reader using (true);

create policy sa_rdr_deal_finance_v7
  on portal_private.deal_finance_authority_v7
  for select to rona_payments_v7_reader using (true);

create policy sa_rdr_finance_events_v7
  on portal_private.finance_events_v7
  for select to rona_payments_v7_reader using (true);

create policy sa_rdr_owner_deal_workflow_v1
  on portal_private.owner_deal_workflow
  for select to rona_payments_v7_reader using (true);

create policy sa_rdr_owner_outgoing_facts_v1
  on portal_private.owner_outgoing_payment_facts
  for select to rona_payments_v7_reader using (true);

create policy sa_rdr_payment_attrib_v7
  on portal_private.payment_business_attributions_v7
  for select to rona_payments_v7_reader using (true);

create policy sa_rdr_payment_resource_v7
  on portal_private.payment_resource_chains_v7
  for select to rona_payments_v7_reader using (true);

-- Enable RLS on the exact live baseline set. Owner/postgres and BYPASSRLS service_role behavior remains unchanged.
alter table portal_private."admin_payments_v7_provider_readiness" enable row level security;
alter table portal_private."ai_coordination_audit_events" enable row level security;
alter table portal_private."ai_coordination_records" enable row level security;
alter table portal_private."ai_model_executor_control" enable row level security;
alter table portal_private."ai_model_executor_runs" enable row level security;
alter table portal_private."ai_read_access_events" enable row level security;
alter table portal_private."ai_role_global_policies_v1" enable row level security;
alter table portal_private."ai_role_state_checkpoints_v2" enable row level security;
alter table portal_private."ai_role_state_history_v2" enable row level security;
alter table portal_private."ai_runtime_control" enable row level security;
alter table portal_private."ai_runtime_queue" enable row level security;
alter table portal_private."ai_runtime_runs" enable row level security;
alter table portal_private."ai_service_identities" enable row level security;
alter table portal_private."canonical_prospect_enrichment" enable row level security;
alter table portal_private."canonical_prospect_exclusions" enable row level security;
alter table portal_private."canonical_prospects" enable row level security;
alter table portal_private."client_intake_audit_v1" enable row level security;
alter table portal_private."client_intake_corrections_v1" enable row level security;
alter table portal_private."client_intake_routing_outbox_v1" enable row level security;
alter table portal_private."client_intake_routing_registry_v1" enable row level security;
alter table portal_private."client_intake_task_links_v1" enable row level security;
alter table portal_private."client_intake_v1" enable row level security;
alter table portal_private."client_user_binding_profiles" enable row level security;
alter table portal_private."client_user_pending_company_bindings" enable row level security;
alter table portal_private."commercial_director_market_news_control" enable row level security;
alter table portal_private."commercial_director_market_news_processed_sources" enable row level security;
alter table portal_private."commercial_director_market_news_runs" enable row level security;
alter table portal_private."deal_execution_passport_allocations_v8" enable row level security;
alter table portal_private."deal_execution_resource_authority_v8" enable row level security;
alter table portal_private."deal_finance_authority_v7" enable row level security;
alter table portal_private."finance_approved_change_jobs_v7" enable row level security;
alter table portal_private."finance_cash_effective_daily_cache_v1" enable row level security;
alter table portal_private."finance_cash_operations_effective_cache_v1" enable row level security;
alter table portal_private."finance_cash_projection_cache_meta_v1" enable row level security;
alter table portal_private."finance_cash_reversal_pairs_cache_v1" enable row level security;
alter table portal_private."finance_cash_statement_checkpoint_cache_v1" enable row level security;
alter table portal_private."finance_cash_statement_summary_cache_v1" enable row level security;
alter table portal_private."finance_document_schedule_manifests_v8" enable row level security;
alter table portal_private."finance_events_v7" enable row level security;
alter table portal_private."finance_mail_intake_alerts_v1" enable row level security;
alter table portal_private."finance_mail_intake_control_v1" enable row level security;
alter table portal_private."finance_mail_intake_v1" enable row level security;
alter table portal_private."finance_materialization_attempts_v7" enable row level security;
alter table portal_private."finance_materialization_jobs_v7" enable row level security;
alter table portal_private."finance_materialization_maintenance_audit_v7" enable row level security;
alter table portal_private."finance_materializer_audit_v7" enable row level security;
alter table portal_private."finance_reconciliation_difference_components_v1" enable row level security;
alter table portal_private."finance_reconciliation_difference_publications_v1" enable row level security;
alter table portal_private."finance_schedule_integrity_alerts_v8" enable row level security;
alter table portal_private."finance_signed_schedule_jobs_v8" enable row level security;
alter table portal_private."market_intelligence_control" enable row level security;
alter table portal_private."market_intelligence_facts" enable row level security;
alter table portal_private."market_intelligence_forecast_snapshots" enable row level security;
alter table portal_private."market_intelligence_processed_sources" enable row level security;
alter table portal_private."market_intelligence_rules" enable row level security;
alter table portal_private."market_intelligence_runs" enable row level security;
alter table portal_private."market_intelligence_source_documents" enable row level security;
alter table portal_private."market_intelligence_source_processor_control" enable row level security;
alter table portal_private."market_intelligence_source_processor_runs" enable row level security;
alter table portal_private."market_intelligence_watchdog_events" enable row level security;
alter table portal_private."market_intelligence_watchdog_state" enable row level security;
alter table portal_private."market_news_source_refs" enable row level security;
alter table portal_private."market_news_versions" enable row level security;
alter table portal_private."mcp_gateway_config" enable row level security;
alter table portal_private."mcp_gateway_owner_allowlist" enable row level security;
alter table portal_private."mcp_gateway_request_events" enable row level security;
alter table portal_private."mcp_oauth_authorization_codes" enable row level security;
alter table portal_private."mcp_oauth_authorization_requests" enable row level security;
alter table portal_private."mcp_oauth_authorize_trace" enable row level security;
alter table portal_private."mcp_oauth_clients" enable row level security;
alter table portal_private."mcp_oauth_tokens" enable row level security;
alter table portal_private."owner_agent_commercial_proposals" enable row level security;
alter table portal_private."owner_agent_display_policies" enable row level security;
alter table portal_private."owner_application_workflow" enable row level security;
alter table portal_private."owner_canonical_document_assets" enable row level security;
alter table portal_private."owner_canonical_document_standards" enable row level security;
alter table portal_private."owner_cash_snapshots" enable row level security;
alter table portal_private."owner_claims" enable row level security;
alter table portal_private."owner_deal_documents" enable row level security;
alter table portal_private."owner_deal_finance_summary" enable row level security;
alter table portal_private."owner_deal_workflow" enable row level security;
alter table portal_private."owner_outgoing_payment_facts" enable row level security;
alter table portal_private."owner_payment_decision_audit_v7" enable row level security;
alter table portal_private."owner_payment_plan" enable row level security;
alter table portal_private."owner_price_change_proposals" enable row level security;
alter table portal_private."owner_price_list_controls" enable row level security;
alter table portal_private."owner_price_snapshots" enable row level security;
alter table portal_private."owner_pricing_governance_rules" enable row level security;
alter table portal_private."owner_radio_items" enable row level security;
alter table portal_private."owner_rail_tariff_matrix" enable row level security;
alter table portal_private."payment_business_attributions_v7" enable row level security;
alter table portal_private."payment_passport_finance_allocations_v7" enable row level security;
alter table portal_private."payment_resource_chains_v7" enable row level security;
alter table portal_private."phase2b2_qa_guard" enable row level security;
alter table portal_private."public_market_news_ingest_runs" enable row level security;
alter table portal_private."telegram_market_channels" enable row level security;
alter table portal_private."telegram_market_documents" enable row level security;
alter table portal_private."telegram_market_ingest_runs" enable row level security;
alter table portal_private."voice_call_events" enable row level security;
alter table portal_private."voice_calls" enable row level security;
alter table portal_private."voice_gateway_control" enable row level security;
alter table portal_private."voice_outbound_requests" enable row level security;

-- Remove anonymous execution from authenticated owner/client SECURITY DEFINER entry points.
-- Authenticated and service-role grants are intentionally retained.
revoke execute on function public.owner_apply_price_change_proposal(uuid) from anon;
revoke execute on function public.owner_prices_admin_workspace_legacy_cp() from anon;
revoke execute on function public.owner_r1_admin_bootstrap() from anon;
revoke execute on function public.owner_r1_cancel_application(text,text) from anon;
revoke execute on function public.owner_r1_cancel_deal(text,text,text) from anon;
revoke execute on function public.owner_r1_client_bootstrap() from anon;
revoke execute on function public.owner_r1_confirm_deal_field(text,text) from anon;
revoke execute on function public.owner_r1_mark_client_download(text,text) from anon;
revoke execute on function public.owner_r1_reconcile_document(text,text,text) from anon;
revoke execute on function public.owner_r1_send_to_payments(text) from anon;
revoke execute on function public.rona_admin_payments_current_v1() from anon;
revoke execute on function public.rona_client_application_projection(text,text) from anon;

-- This function currently inherits PUBLIC EXECUTE; close that broader grant explicitly.
revoke execute on function public.rona_admin_payments_current_v1() from public;
grant execute on function public.rona_admin_payments_current_v1() to authenticated, service_role;
