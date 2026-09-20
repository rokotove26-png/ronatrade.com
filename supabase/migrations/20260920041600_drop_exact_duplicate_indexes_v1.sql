-- Remove exact duplicate indexes reported by Supabase performance advisor.
-- Preserve the index in each pair that is currently used more often or is the current semantic contract.
drop index if exists portal_private.ux_client_applications_v12_idempotency;
drop index if exists portal_private.finance_signed_schedule_jobs_v8_deal_idx;
drop index if exists portal_private.owner_deal_documents_active_kind_idx;
drop index if exists portal_private.owner_price_change_proposals_status_idx;
