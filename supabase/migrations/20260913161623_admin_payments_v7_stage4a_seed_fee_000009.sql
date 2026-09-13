-- Stage 4A production-lineage marker only.
-- Production recorded one controlled, source-locked Stage 4A business-data seed under this
-- migration version. Business data is intentionally NOT replayed by repository migrations:
-- current payment identities/amounts are runtime data, not application schema constants.
-- Fresh environments must source-lock/materialize business authority separately.
select 1;
