-- Payments V7 funding-side read model privileges only.
-- BUSINESS_DATA_MUTATION=NONE
-- FINANCE_RECORD_MUTATION=NONE
-- RE-MATERIALIZATION=NONE

begin;

grant select on portal_private.finance_events_v7 to rona_payments_v7_reader;
grant execute on function portal_private.ai_role_global_policies_current_v1(portal_private.ai_business_role_enum) to rona_payments_v7_reader;

commit;
