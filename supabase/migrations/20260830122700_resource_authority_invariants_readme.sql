-- Resource confirmation invariants for all client deals.
-- 1. Payment allocation / received finance facts require confirmed resource.
-- 2. EXECUTING requires confirmed resource.
-- 3. Legacy SOURCE_FREEZE_V5 executing deals are normalized into resource_decisions once.
-- 4. Client realization UI consumes server-authoritative facts only and contains no client/deal hardcoding.
select 1;
