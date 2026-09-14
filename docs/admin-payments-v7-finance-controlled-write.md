# Admin → Payments V7 — Finance-driven controlled write

Status: **IMPLEMENTED CANDIDATE / SYSTEM_ADMIN REVIEW REQUIRED**  
Owner visual acceptance: **PASS / UI FROZEN**  
Merge: **HOLD**  
Production deploy: **HOLD**  
Production business-data mutation: **HOLD**

## 1. CURRENT_STATE_FIRST snapshot

Authoritative inspection performed before implementation:

- Repository: `rokotove26-png/ronatrade.com`.
- Active PR: `#469`, branch `feat/admin-payments-v7-clean-rebuild`, base `main`.
- Current approved release observed at start of this stage: `release/public-go-live-v1.1@0c136582cbe825149257994465d784f28a24ab0c`.
- Production Supabase: project `sxawrwzeobaqwwmlkzws`.
- Production `rona-owner-ai-sync`: active, but still deployed from the earlier independently tested Payments V7 backend pin. This stage does **not** redeploy it.
- Production `rona-mcp-gateway`: active; current deployed wrapper is older than the release branch. This stage does **not** redeploy it.
- Finance Pilot identity is fixed as `FINANCE / AI-FINANCE` on `rona-mcp-finance-pilot`.
- Before this delta, Finance Pilot had coordination/proposal tools only. It had no authoritative Finance business-mutation primitive.
- Production already contains `payment_business_attributions_v7`, `payment_business_attribution_lines_v7`, `deal_finance_authority_v7`, `owner_payment_decision_audit_v7`, and provider readiness. `payment_resource_chains_v7` was absent.
- Current production Finance authority for `DEAL-2026-009` is RUB: total `31 002 300`, expected/not-due `9 300 690`, future conditional `21 701 610`, preserving Finance V23 semantics.
- `DEAL-2026-004` has confirmed outgoing bank facts in RUB/KZT but requires exact Finance resource-chain authority before USD actual spend is authoritative.
- the KУЗМАШ shared outgoing payment for `DEAL-2026-005` / `DEAL-2026-006` remains split `TO_VERIFY`; candidate Deal IDs are not authority.

## 2. Owner architectural decision

Canonical flow:

`OWNER-PROVIDED SOURCE → FINANCE AI INTERPRETATION + SOURCE-LOCK → STRUCTURED FINANCE AUTHORITY → PORTAL CANONICAL STORAGE → PAYMENTS V7 PROJECTION → ADMIN UI`

Explicitly out of scope:

- bank feed / open banking / bank polling;
- OCR or document parser as autonomous source of truth;
- browser-to-DB authority writes;
- direct SQL exposed to Finance AI;
- frontend financial interpretation;
- synthetic market/CBR/contractual FX used as actual resource-chain authority;
- Owner manual KPI entry;
- parallel finance register.

## 3. Gap analysis

Already present before this delta:

- Payments V7 source-locked projection and fail-closed semantics;
- Finance authority relation (`deal_finance_authority_v7`);
- typed payment attribution authority and immutable Owner decision audit;
- `verified_received`, payment progress and finance bucket projection;
- exact-spend algorithm that already consumes a resource-chain provider when available;
- Owner action persistence with optimistic-lock and idempotency patterns;
- role-bound Finance Pilot, but only for coordination/proposals.

Missing before this delta:

1. one controlled Finance mutation contract;
2. Finance event audit with fixed actor identity and correlation ID;
3. canonical resource-chain relation in production substrate;
4. Finance event → payment/allocation/authority materialization;
5. stale/idempotent Finance writes;
6. typed Finance feedback codes;
7. Finance Pilot exposure of the mutation primitive;
8. E2E regression gate proving the ten required scenarios.

## 4. Final Finance event contract

One Pilot tool: `finance_event_submit`.

Common envelope:

- `event_type`;
- `deal_id` when applicable;
- `payment_id` when applicable;
- `expected_current_authority_id` for optimistic current-authority writes;
- `effective_at`;
- `source_refs[]` with typed `source_type` / `source_id`;
- `source_version`;
- `source_timestamp`;
- `idempotency_key`;
- event-specific `payload`.

The MCP gateway injects the authenticated actor context and correlation ID. The caller cannot select its role, identity or server binding.

Supported event types:

1. `CLIENT_PAYMENT_CONFIRMED`
2. `DEAL_FINANCIAL_OBLIGATION_CONFIRMED`
3. `DEAL_PAYMENT_SCHEDULE_CONFIRMED`
4. `PAYMENT_TRIGGER_CONFIRMED`
5. `OUTGOING_PAYMENT_CONFIRMED`
6. `OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED`
7. `PAYMENT_RESOURCE_CHAIN_CONFIRMED`
8. `DOCUMENTARY_STATUS_CONFIRMED`

## 5. Canonical authority model

### `finance_events_v7`

Immutable accepted-event journal containing fixed actor `FINANCE / AI-FINANCE`, correlation ID, idempotency key, source lock/provenance, request snapshot and result snapshot.

### `deal_finance_authority_v7`

Existing relation remains the Payments V7 finance source. Finance events append a new complete current authority that references the prior authority through `supersedes_id`. Existing rows are not overwritten. This delta adds actor/correlation/idempotency lineage fields for newly written Finance authorities.

### `payment_business_attributions_v7`

Existing relation remains the allocation source. Finance events append either:

- `EXACT` single-Deal attribution;
- `EXACT` multi-Deal split;
- `SCOPE_ONLY` known scope where split remains `TO_VERIFY`.

No proportional inference is implemented.

### `payment_resource_chains_v7`

New immutable relation. One exact chain carries:

- source payment and Deal;
- native amount/currency;
- accounting amount/currency;
- actual Finance conversion/source basis;
- source refs/source version/source timestamp;
- actor/correlation/idempotency;
- supersession lineage.

CBR/market/approximate/contractual FX is rejected as a substitute for actual Finance resource-chain authority.

## 6. Controlled Finance Pilot surface

`rona-mcp-gateway` now adds `finance_event_submit` only when the authenticated MCP context resolves to all of:

- role `FINANCE`;
- identity `AI-FINANCE`;
- server `rona-mcp-finance-pilot`;
- `mcp:coordinate` scope.

All other MCP calls are delegated byte-for-behavior to the source-locked current release gateway. Browser/Admin UI never receives this write surface.

The only DB mutation primitive exposed by this extension is the parameterized call to:

`portal_private.persist_finance_event_v7(jsonb,jsonb)`

The function is revoked from `public`, `anon`, `authenticated`, `service_role`, and the read-only Payments role.

## 7. Materialization semantics

### Incoming client payment

`CLIENT_PAYMENT_CONFIRMED` atomically inserts a bank-confirmed, Finance-verified `PAYMENT` and exact `payment_allocation` to the Deal. Payments V7 consumes the normal canonical rows; no dashboard update is written.

### Obligation / schedule / trigger / documentary state

Each event requires the exact current Finance authority ID. The new complete authority appends with `supersedes_id`. Stale writes return `STALE_AUTHORITY` and change no current truth.

### Outgoing payments

The payment fact and Finance attribution are persisted in one controlled transaction. `SCOPE_ONLY` is valid and remains `TO_VERIFY`. A later exact split appends a superseding attribution.

### Cross-currency actual spend

A Deal/payment line is spend-eligible in another currency only after `PAYMENT_RESOURCE_CHAIN_CONFIRMED` supplies an exact Finance resource chain matching the payment line and the Deal accounting currency. The pre-existing Payments V7 spend engine then calculates `actual_spend` and `remaining_execution` without synthetic FX.

## 8. Feedback loop

Rejected writes return stable reason codes and an action class. Examples:

- `DEAL_NOT_FOUND`
- `PAYMENT_NOT_FOUND`
- `SOURCE_LOCK_INCOMPLETE`
- `STALE_AUTHORITY`
- `FINANCE_AUTHORITY_CONFLICT`
- `EXACT_ALLOCATION_REQUIRED`
- `RESOURCE_CHAIN_SCOPE_MISMATCH`
- `SYNTHETIC_FX_FORBIDDEN`
- `FINANCE_EVENT_IDEMPOTENCY_CONFLICT`
- `TECHNICAL_MATERIALIZATION_REQUIRED`

Finance AI refreshes current state, corrects the event and resubmits through the same Pilot surface. No manual SQL is part of the workflow.

## 9. QA matrix

`tests/admin-payments-v7/finance-controlled-write.sql` executes on PostgreSQL 17 and covers:

1. client payment → canonical payment + verified Deal allocation;
2. new obligation → append + supersession;
3. expected/not-due bucket;
4. Finance-confirmed trigger → `EXPECTED` to `DUE` bucket change;
5. same-currency outgoing exact attribution;
6. cross-currency outgoing + exact Finance resource chain;
7. shared payment without split → `SCOPE_ONLY`, no inferred split;
8. later exact split → superseding exact authority;
9. stale authority → rejection / no state change;
10. duplicate idempotency key → replay / no duplicate rows.

A separate case verifies documentary status authority. Existing Payments V7 tests continue to prove projection calculations, fail-closed behavior, Owner queue semantics and the accepted UI renderer.

## 10. Migration / production plan

1. SYSTEM_ADMIN reviews this candidate and exact-head CI.
2. Apply `20260914210000_admin_payments_v7_finance_controlled_write.sql` in a controlled preproduction/production migration window.
3. Verify relation/function ACLs, immutability triggers and provider readiness.
4. Deploy `rona-mcp-gateway` from the independently approved exact candidate SHA.
5. Reconnect/refresh Finance Pilot tool schema and verify `finance_event_submit` appears only for `FINANCE / AI-FINANCE`.
6. Do **not** seed or rewrite business data as part of deployment.
7. Execute a non-business QA event in approved test scope, then independently verify `/admin/sync` projection refresh.
8. Only after SYSTEM_ADMIN PASS may production Finance events be accepted.

## 11. UI freeze / regression rule

This Finance automation delta does not change the Payments renderer, KPI layout, card layout, typography, colors or visual structure. `OWNER_VISUAL_ACCEPTANCE = PASS` remains a hard gate. Financial figures change only through the authoritative projection after accepted Finance events, never through a frontend deploy.
