-- Stage 4A production-lineage hardening.
-- Pin V7 helper/trigger-function search paths to the exact production setting.
alter function portal_private.admin_payments_v7_valid_currency(text)
  set search_path = pg_catalog, portal_private;
alter function portal_private.reject_v7_authority_mutation()
  set search_path = pg_catalog, portal_private;
alter function portal_private.validate_payment_business_attribution_v7()
  set search_path = pg_catalog, portal_private;
