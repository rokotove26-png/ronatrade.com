# Admin Payments V7 — SYSTEM_ADMIN independent review — 2026-09-14

Status: **PASS / READY FOR CONTROLLED PRODUCTION BACKEND ACTIVATION**  
Owner visual acceptance: **PASS / UI FROZEN**  
Frontend visual delta in this review: **NONE**

## 1. CURRENT_STATE_FIRST

Repository: `rokotove26-png/ronatrade.com`.

Candidate branch: `feat/admin-payments-v7-clean-rebuild`.

Production release observed during the final review: `release/public-go-live-v1.1@2d1501dc6bfd5dc3cfd16d7968334b6e70e2a09c`.

Production Supabase project: `sxawrwzeobaqwwmlkzws`.

Production database before Finance controlled-write activation already contains the Payments V7 authority substrate, including:

- `payment_business_attributions_v7`;
- `payment_business_attribution_lines_v7`;
- `deal_finance_authority_v7`;
- `owner_payment_decision_audit_v7`.

Before activation it does **not** contain:

- `finance_events_v7`;
- `payment_resource_chains_v7`;
- `persist_finance_event_v7(jsonb,jsonb)`.

Production source facts were inspected read-only. No business financial data was modified by this review.

Current Finance authority semantics remain source-locked, including:

- `DEAL-2026-004`: `236250 USD`, Finance status `PAID`;
- `DEAL-2026-005`: total `672500 USD`, expected/not due `470750 USD`;
- `DEAL-2026-006`: total `164400 USD`, expected/not due `115080 USD`;
- `DEAL-2026-009`: total `31002300 RUB`, expected/not due `9300690 RUB`, future conditional `21701610 RUB`.

Existing outgoing bank facts remain bank facts only where Deal allocation/resource-chain authority is incomplete. No inferred allocation or synthetic FX is authorized.

## 2. Production runtime pins

Production `rona-owner-ai-sync` is active and source-pinned to tested Payments V7 candidate lineage `53f66042a818eb0e1e1b2407582654ef8f54c077`. The Finance controlled-write delta does not require an Owner AI Sync redeploy.

Production `rona-mcp-gateway` is active and currently imports exact gateway source commit:

`736a535fe245decdf79de06d32940c2cb17370aa`

The Finance extension candidate has been corrected to wrap that exact production gateway source rather than an older release pin. This prevents replacement of unrelated current MCP gateway semantics during Finance activation.

## 3. Independent review correction A — current Finance authority selector

The initial `PAYMENT_RESOURCE_CHAIN_CONFIRMED` implementation used a correct current-authority cardinality gate but its subsequent row selector did not repeat the current row `authority_state` / `lifecycle_state` predicates.

Corrective migration:

`20260914213000_admin_payments_v7_finance_current_authority_hardening.sql`

The correction:

- requires the selected Finance authority row itself to be live/current;
- preserves the existing no-live-successor rule;
- fails closed on source mismatch;
- is idempotent;
- does not insert/update/delete Finance business facts.

Regression proof:

`tests/admin-payments-v7/finance-current-authority-hardening.sql`

It proves the unsafe selector is absent, the safe selector is present, business row counts do not change, privileges stay fail-closed, and a deterministic retry remains idempotent.

## 4. Independent review correction B — exact production MCP gateway preservation

Candidate `supabase/functions/rona-mcp-gateway/index.ts` now uses:

`FINANCE_GATEWAY_UPSTREAM_COMMIT='736a535fe245decdf79de06d32940c2cb17370aa'`

Only the Finance controlled-write extension is added around the exact currently deployed gateway handler.

The new mutation tool remains available only to:

- role `FINANCE`;
- identity `AI-FINANCE`;
- server `rona-mcp-finance-pilot`;
- authenticated MCP scope `mcp:coordinate`.

The browser is never Finance authority. Actor identity/correlation are server-derived. The extension writes only through the sealed `persist_finance_event_v7` primitive.

## 5. Finance authority contract

Canonical flow remains:

`OWNER-PROVIDED SOURCE -> FINANCE AI INTERPRETATION + SOURCE-LOCK -> STRUCTURED FINANCE AUTHORITY -> PORTAL CANONICAL STORAGE -> PAYMENTS V7 PROJECTION -> ADMIN UI`

Supported events:

- `CLIENT_PAYMENT_CONFIRMED`;
- `DEAL_FINANCIAL_OBLIGATION_CONFIRMED`;
- `DEAL_PAYMENT_SCHEDULE_CONFIRMED`;
- `PAYMENT_TRIGGER_CONFIRMED`;
- `OUTGOING_PAYMENT_CONFIRMED`;
- `OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED`;
- `PAYMENT_RESOURCE_CHAIN_CONFIRMED`;
- `DOCUMENTARY_STATUS_CONFIRMED`.

Mandatory properties remain source refs/version/timestamp, actor/correlation, idempotency and stale-authority control.

Cross-currency actual spend requires an exact Finance resource chain using actual settlement facts. Synthetic CBR/market/contract FX is forbidden.

Shared outgoing payments remain `SCOPE_ONLY / TO_VERIFY` until Finance supplies an exact split. Candidate Deal IDs are hints only and never allocation authority.

## 6. QA evidence

Exact-head candidate QA after the independent-review corrections is green:

- `Admin Payments V7 Stage 3 Backend QA` — run `34889419663`: **PASS**;
- `Admin Payments V7 Finance Authority Hardening QA` — run `34889419694`: **PASS**.

The Stage 3 gate includes PostgreSQL 17 parity, Deno import graph, Cloudflare build parity, Payments V7 regression suite, live-shell browser proof, persistence/privilege/readiness integration, Finance controlled-write E2E, reader RLS visibility and no-hardcode scan.

The hardening gate independently proves PostgreSQL 17 current-authority behavior and no frontend visual scope.

## 7. Production activation decision

`SYSTEM_ADMIN_INDEPENDENT_REVIEW=PASS`

`OWNER_VISUAL_ACCEPTANCE=PASS`

`FRONTEND_VISUAL_CHANGE=NONE`

`CONTROLLED_WRITE_SCHEMA_ACTIVATION=READY`

`MCP_FINANCE_EXTENSION_DEPLOY=READY`

`PRODUCTION_BUSINESS_DATA_MUTATION=SOURCE_LOCK_ONLY`

After schema/function activation and MCP Finance extension deployment, production smoke must remain non-mutating until `finance_event_submit` is visible to Finance Pilot. Subsequent Finance events may be submitted only from actual Owner-provided/source-locked facts. Missing Deal splits or cross-currency resource chains must remain `TO_VERIFY`; they must never be synthesized to force `Потрачено / Остаток` into an authoritative state.
