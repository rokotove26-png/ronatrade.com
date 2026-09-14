# Admin → Payments V7 — Stage 2 authoritative data contract and clean architecture

Status: `STAGE_2=COMPLETE / DESIGN_ONLY`.

This document is the Stage-2 architecture contract for Admin → Payments V7. It does not implement UI/CSS, does not deploy backend code, does not mutate production business data, and does not change upstream Deal lifecycle.

Current gates remain:

- `MERGE=HOLD`
- `PRODUCTION_DEPLOY=HOLD`
- `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`
- `UI_IMPLEMENTATION=HOLD`

Stage 1/1B is accepted by Owner as a sufficient source basis for Stage 2. The Stage-1 file remains immutable audit history even where its earlier hold wording is superseded by the later Owner direction to proceed with Stage 2.

## 0. CURRENT_STATE_FIRST snapshot used for this design

Repository state was re-read before this document was written:

- repository: `rokotove26-png/ronatrade.com`;
- PR: `#469`;
- branch: `feat/admin-payments-v7-clean-rebuild`;
- base: `main`;
- pre-write HEAD: `a5be51d0aa3e7e9df64d922014a29d3883b91bfd`;
- PR state: `OPEN / DRAFT / merged=false`;
- pre-write changed-file set: Stage-1 reconciliation document only.

The current Stage-1 reconciliation document was re-read from that exact HEAD.

Production was inspected read-only. The current schema confirms the existing authoritative relations used by this contract, including `payments`, `payment_allocations`, `payment_references`, `payment_allocation_authority_history_v1`, `deals`, `owner_deal_workflow`, `clients`, `contracts`, `documents`, `owner_deal_finance_summary`, `owner_payment_plan`, `owner_outgoing_payment_facts`, and `ai_coordination_records`.

The current Payments contour remains driven by existing upstream handoff state. Active current membership is derived from `owner_deal_workflow.payment_handoff_state` plus Deal lifecycle; there is no need for a new payment lifecycle state/gate.

Read-only production inspection also confirms the Stage-1 classification premise: a missing `payment_allocations` row is not a sufficient unresolved test. Current data contains verified exact allocations, known multi-Deal scope without materialized split, FX events with allocation `NOT_APPLICABLE`, and Owner-asserted allocated state whose exact technical binding is not currently materialized.

The current Finance canon is Finance conclusion v23 (`eabba23f-70b9-4d40-86ef-3d0578c71d4a`), which supersedes the old universal-USD semantics. Its controlling rule is: accounting currency comes from verified incoming client-payment currency; before first client payment, only explicit authoritative Owner/Finance contractual payment currency may be used; mixed inbound currencies without a separate Owner rule fail closed to `TO_VERIFY`.

## 1. Architectural invariant

V7 is a single data pipeline:

`upstream payment contour -> immutable PAYMENT facts -> reconciled business attribution -> Finance obligations/projections -> Deal spend/resource chain -> Owner Payments projection -> native Admin renderer`

The Owner UI is a consumer of a backend projection. It is not a financial calculation engine and is never an authority for amounts, Deal attribution, accounting currency, FX, expected receipts, or spend.

All business arithmetic is centralized in one server-side projection builder. Frontend logic is limited to rendering, local presentation state, navigation, accessibility, and user interaction that does not derive financial truth.

## 2. Authoritative source / priority matrix

Authority is field-specific. There is no single table that wins every field.

| Domain / field | Primary authority | Secondary evidence | Explicitly not authority | Fail-closed rule |
| --- | --- | --- | --- | --- |
| Payments contour membership | `owner_deal_workflow.payment_handoff_state` joined to current Deal lifecycle | `deals` lifecycle/business status | Finance/UI-created payment stage | Include only existing upstream `READY`/`SENT` members that are live and not cancelled/closed/archived/superseded |
| Deal/client identity | `deals` + active authoritative `clients` + `contracts` | canonical documents | hardcoded client label | missing current identity -> nullable display field; never fabricate |
| Immutable bank event | `payments` | `payment_references`, bank source refs | UI, derived Finance total | `PAYMENT.amount` and currency are immutable facts |
| Exact materialized allocation | active authoritative VERIFIED `payment_allocations` | `payment_allocation_authority_history_v1` | absence of allocation row | superseded/reversed/inactive allocations are excluded |
| Business attribution not fully materialized | structured authoritative payment-attribution layer defined in §11 | `owner_outgoing_payment_facts`, canonical documents, explicit Owner authority, Finance/Commercial/Treasury evidence | `candidate_deal_ids` alone; free-form UI state | if exact attribution cannot be source-locked, keep scope/status but do not invent split |
| Client receipt | `payments` + active VERIFIED `payment_allocations` | none | `owner_deal_finance_summary.received_amount` as independent truth | only `INCOMING + CLIENT_PAYMENT + BANK_CONFIRMED + finance VERIFIED` contributes |
| Accounting currency after first receipt | currencies of authoritative verified incoming client payments allocated to the Deal | none | universal USD, contractual historical display currency | exactly one inbound currency -> authoritative; >1 -> `TO_VERIFY` unless separate Owner rule exists |
| Accounting currency before first receipt | current explicit Owner/Finance contractual payment-currency authority | current signed contractual source | historical management view; implicit default | no explicit current authority -> `TO_VERIFY` |
| Total/due/expected/future obligation | newest eligible current source-locked Finance structured projection / current Owner authority | current contract/document trigger evidence | stale `owner_deal_finance_summary` row when superseded | select newest eligible non-rejected/non-superseded field authority; conflict -> `TO_VERIFY` |
| Outgoing Deal spend in native currency | BANK_CONFIRMED outgoing payment + authoritative Deal attribution | `owner_outgoing_payment_facts` | incoming allocation | no Deal attribution -> not Deal spend |
| Cross-currency Deal spend in accounting currency | exact Bank/Treasury resource-chain linked to Deal and execution payment | source-locked conversion legs | current/CBR/market FX; contractual invoice FX unless it is the actual execution resource chain | missing exact chain -> `actual_spend_status=TO_VERIFY` |
| FX conversion event | `payments` where `payment_kind=FX_CONVERSION` / allocation `NOT_APPLICABLE` | bank FX source fields | Deal spend by itself | conversion principal is resource movement, not second spend |
| Owner allocation action queue | final reconciliation result only | all preceding layers | no allocation row by itself | only `GENUINELY_UNALLOCATED` may enter queue |

### Authority selection rule for Finance records

V7 must not hardcode a Finance conclusion UUID/version in application logic. The runtime selector must choose the newest eligible current Finance authority using structured metadata and supersession/evidence rules. A valid field source must be current, source-locked, not QA-only, not rejected/returned/cancelled/superseded, and applicable to the Deal/field being projected.

Current Finance v23 is a present data fact, not a permanent application constant.

## 3. V7 backend projection contract

The backend returns one stable projection object. Suggested TypeScript shape:

```ts
type MoneyStatus = 'AUTHORITATIVE' | 'TO_VERIFY' | 'NOT_APPLICABLE';
type ActualSpendStatus = 'AUTHORITATIVE' | 'PARTIAL_TO_VERIFY' | 'TO_VERIFY' | 'NONE';
type AccountingCurrencyStatus = 'AUTHORITATIVE' | 'TO_VERIFY';
type DocumentaryStatus = 'CONFIRMED' | 'TO_VERIFY' | 'NOT_APPLICABLE';

type AuthorityRef = {
  source_type: string;
  source_id: string | null;
  source_version: string | null;
  source_timestamp: string | null;
  authority_state: string | null;
  lifecycle_state: string | null;
};

type MoneyValue = {
  amount: string | null;       // decimal string; never binary-float money
  currency: string | null;
  status: MoneyStatus;
  reason: string | null;
  authority_refs: AuthorityRef[];
};

type ReconciliationClass =
  | 'RESOLVED'
  | 'KNOWN_MULTI_DEAL_EXACT_SPLIT'
  | 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY'
  | 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED'
  | 'ASSOCIATED_BANK_FEE'
  | 'FX_CONVERSION_NOT_APPLICABLE'
  | 'GENUINELY_UNALLOCATED';

type PaymentException = {
  exception_id: string;
  payment_ids: string[];
  reconciliation_class: ReconciliationClass;
  owner_action_required: boolean;
  owner_action: 'ALLOCATE_PAYMENT' | null;
  candidate_deal_ids: string[];
  known_scope_refs: string[];
  technical_gap: string | null;
  authority_refs: AuthorityRef[];
};

type DealPaymentsProjectionV7 = {
  deal_id: string;
  client_display: string | null;
  payment_handoff_state: 'READY' | 'SENT';

  accounting_currency: {
    currency: string | null;
    status: AccountingCurrencyStatus;
    reason: string;
    authority_refs: AuthorityRef[];
  };

  total_to_receive: MoneyValue;
  verified_received: MoneyValue;
  due_now: MoneyValue;
  expected_not_due: MoneyValue;
  future_conditional: MoneyValue;
  remaining_to_receive: MoneyValue;

  actual_spend: MoneyValue;
  actual_spend_status: ActualSpendStatus;
  remaining_execution: MoneyValue;

  payment_progress: {
    ratio: string | null;
    percent: string | null;
    status: 'AUTHORITATIVE' | 'TO_VERIFY';
    reason: string | null;
  };

  financial_status:
    | 'PAID'
    | 'OVERDUE'
    | 'DUE'
    | 'EXPECTED'
    | 'CONDITIONAL'
    | 'OPEN'
    | 'TO_VERIFY';

  documentary_status: DocumentaryStatus;
  exceptions: PaymentException[];
  authority_refs: AuthorityRef[];
};

type AdminPaymentsProjectionV7 = {
  contract: 'ADMIN_PAYMENTS_V7';
  generated_at: string;
  source_as_of: string;
  deals: DealPaymentsProjectionV7[];
  owner_exception_queue: PaymentException[];
  reconciliation_summary: {
    genuinely_unallocated_count: number;
    technical_gap_count: number;
    known_scope_count: number;
  };
};
```

### Contract rules

- Money travels as decimal strings in the API contract; server arithmetic uses exact numeric/decimal semantics.
- Every nullable financial field carries status/reason/provenance. Null without status is forbidden.
- `client_display` is presentation identity only and cannot affect calculations.
- `exceptions` may contain technical/reconciliation gaps that are not Owner actions.
- `owner_exception_queue` is a strict subset containing only `owner_action_required=true`.
- The same projection contract serves production and QA. QA may replace source adapters/fixtures, but it must not use a second renderer or second financial algorithm.

## 4. Reconciliation pipeline

The server-side builder executes in this order.

### Step 1 — read contour

1. Read current `deals` + `owner_deal_workflow`.
2. Include only existing upstream `payment_handoff_state in ('READY','SENT')`.
3. Exclude cancelled/closed/archived/superseded lifecycle/business state.
4. Do not require an extra Finance/payment-stage status.
5. Do not write any upstream field.

Output: ordered set of contour Deal keys/IDs with client/contract identity.

### Step 2 — read immutable bank facts

Read active current `payments` and supporting `payment_references`. Preserve payment amount/currency/direction/kind/bank state/Finance verification/allocation applicability/candidate scope/FX evidence exactly as stored.

### Step 3 — read exact materialized allocations

Read active, non-reversed, authoritative VERIFIED `payment_allocations`, joined to Deal identity. Use `payment_allocation_authority_history_v1` only for provenance/supersession audit, not as a second current allocation truth.

### Step 4 — build reconciled business-attribution graph

For each outgoing allocatable bank event, reconcile in descending authority:

1. active exact verified `payment_allocations`;
2. structured exact business-attribution authority (including source-locked exact multi-Deal split not yet materialized as allocation rows);
3. confirmed `owner_outgoing_payment_facts` / canonical payment-preparation or document authority that establishes exact Deal binding;
4. known shared Deal/business scope without exact split;
5. explicit Owner assertion that allocation already exists but system authority is not materialized;
6. associated-principal relation for bank fee;
7. FX / `NOT_APPLICABLE` exclusion;
8. only then unresolved evaluation.

The graph stores separately:

- business truth;
- technical materialization state;
- exact amount split state;
- known scope;
- principal/fee association;
- provenance.

### Step 5 — classify each payment event

Run the state machine in §5. Classification is derived from the full graph, not from one table.

### Step 6 — compute verified client receipts

For each contour Deal, sum only allocations where all are true:

- payment is active;
- `payment_direction=INCOMING`;
- `payment_kind=CLIENT_PAYMENT`;
- `bank_fact_status=BANK_CONFIRMED`;
- `finance_verification_status=VERIFIED`;
- allocation is active;
- allocation status is VERIFIED;
- allocation authority is authoritative/current;
- allocation Deal equals the projected Deal.

### Step 7 — resolve accounting currency

Use §8.

### Step 8 — resolve Finance obligation fields

Select current field-level Finance authority for `total_to_receive`, `due_now`, `expected_not_due`, `future_conditional`, Finance state and documentary state. Do not blindly trust a stale summary table if newer eligible structured authority supersedes it.

### Step 9 — compute actual Deal spend

Use only outgoing BANK_CONFIRMED/verified execution facts that have authoritative Deal attribution. Convert to accounting currency only through §9 resource-chain rules.

### Step 10 — calculate Deal projection

Apply formulas in §6 only on values whose authority and currency are valid.

### Step 11 — build exceptions and queue

Attach all non-normal reconciliation states to `exceptions`. Add only genuine new Owner decisions to `owner_exception_queue` under §7.

### Step 12 — return one projection

The renderer receives one already-reconciled object. It never joins raw payment/allocation/Finance arrays itself.

## 5. Payment classification state machine

Classification precedence is deterministic.

### A. FX exclusion

If `payment_kind=FX_CONVERSION` or `deal_allocation_applicability=NOT_APPLICABLE` for an FX/resource movement:

`FX_CONVERSION_NOT_APPLICABLE`

It never enters Owner allocation queue and is never Deal spend by itself.

### B. Associated bank fee

If a bank fee is source-linked to a principal payment:

`ASSOCIATED_BANK_FEE`

The fee carries:

- principal payment reference;
- principal reconciliation class;
- fee attribution state (`EXACT`, `SHARED_SCOPE`, `TO_VERIFY`, `NOT_APPLICABLE`);
- its own spend eligibility.

A fee must not silently inherit a principal split unless explicit authority/rule permits it.

### C. Exact single-Deal allocation

If exact active authoritative allocation resolves the bank event to one Deal and the materialized amount is valid:

`RESOLVED`

### D. Exact multi-Deal split

If exact Deal IDs and exact amounts are source-locked for more than one Deal, regardless of whether current `payment_allocations` has materialized the split:

`KNOWN_MULTI_DEAL_EXACT_SPLIT`

A separate `materialization_status`/technical gap indicates whether allocation rows exist. Lack of rows does not downgrade business truth.

### E. Known shared scope, exact split missing

If authoritative evidence proves a finite Deal/business scope but no exact amount split:

`SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY`

This is not Owner generic unallocated. It is an attribution-granularity/source gap.

### F. Owner asserted already allocated, system binding missing

If direct current Owner authority states the payment was allocated, but current system authority does not preserve the exact binding:

`OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED`

The current PAYEV-2026-000008 Stage-1/Owner case is the canonical acceptance example. Its known Specification/business scope and Owner assertion prevent it from entering the Owner unresolved queue. PAYEV-2026-000009 is the associated-fee companion to the same principal and also cannot become a generic Owner allocation action merely because an allocation row is absent.

### G. Genuine unallocated

Only if all preceding branches fail and the event satisfies §7:

`GENUINELY_UNALLOCATED`

This is the only class allowed to request a new Owner allocation decision.

## 6. Calculation rules and formulas

All formulas execute server-side.

### `verified_received`

```text
verified_received(deal, accounting_currency)
  = SUM(active VERIFIED allocation amounts from
        BANK_CONFIRMED + finance VERIFIED + INCOMING + CLIENT_PAYMENT)
```

If any contributing verified incoming payment currency conflicts with resolved accounting currency, the field fails closed to `TO_VERIFY` rather than converting synthetically.

### `remaining_to_receive`

Only when `total_to_receive` and `verified_received` are authoritative and share accounting currency:

```text
remaining_to_receive = total_to_receive - verified_received
```

Do not clamp to zero. A negative result is meaningful over-receipt data and should be surfaced by financial status/exception logic rather than hidden.

### `payment_progress`

Only when both inputs are authoritative, same currency, and `total_to_receive > 0`:

```text
payment_progress.ratio   = verified_received / total_to_receive
payment_progress.percent = 100 * ratio
```

No per-Deal progress constant. No frontend percentage calculation. Do not clamp above 100%; an over-receipt must remain observable.

If total is zero, missing, conflicting, or not authoritative -> `payment_progress.status=TO_VERIFY`.

### `actual_spend`

```text
actual_spend = SUM(authoritative Deal-attributed outgoing execution amounts
                   expressed in Deal accounting currency)
```

Each component must be either:

- native outgoing execution already in accounting currency; or
- cross-currency execution with exact Bank/Treasury resource-chain giving the accounting-currency resource amount.

If at least one in-scope spend component cannot be authoritatively expressed in accounting currency, do not fabricate a full total. Return either `PARTIAL_TO_VERIFY` with explicitly separated authoritative subtotal + unresolved detail, or `TO_VERIFY` where a safe subtotal would mislead. The primary `actual_spend.amount` must not imply completeness when it is not complete.

### `remaining_execution`

This field means currently verified client resource remaining after completed authoritative Deal spend; it does not include future expected receipts.

Only when both `verified_received` and complete `actual_spend` are authoritative in the same accounting currency:

```text
remaining_execution = verified_received - actual_spend
```

Do not clamp. Negative value means Deal execution has consumed funding beyond verified client receipts and requires business interpretation; V7 must not conceal it.

If spend is `PARTIAL_TO_VERIFY`/`TO_VERIFY`, `remaining_execution` is also `TO_VERIFY`.

### `due_now`, `expected_not_due`, `future_conditional`

These are not inferred from `remaining_to_receive` by the UI. They come from current source-locked Finance/Owner obligation/tranche authority.

They represent distinct buckets:

- `due_now`: payment obligation currently due under authoritative trigger;
- `expected_not_due`: confirmed expected obligation whose due trigger/time has not yet arrived;
- `future_conditional`: nominal/conditional future amount dependent on future trigger/quantity/document condition.

No formula is allowed to force these three buckets to sum to `remaining_to_receive` unless the authoritative Finance contract explicitly guarantees that identity.

### `financial_status`

Deterministic backend precedence:

1. any controlling authority conflict / unresolved accounting currency / unusable core obligation -> `TO_VERIFY`;
2. authoritative Finance overdue state -> `OVERDUE`;
3. `remaining_to_receive == 0` with authoritative inputs -> `PAID`;
4. `due_now > 0` -> `DUE`;
5. `expected_not_due > 0` -> `EXPECTED`;
6. `future_conditional > 0` -> `CONDITIONAL`;
7. otherwise -> `OPEN`.

An `OVERDUE` state requires an authoritative overdue condition; V7 does not invent overdue solely from local browser time.

### `documentary_status`

Derived from current authoritative Finance/document trigger state, not from amount arithmetic. A Deal may have authoritative accounting currency but documentary `TO_VERIFY`.

## 7. Owner exception queue rules

An event enters `owner_exception_queue` only if every condition below is true after full reconciliation:

1. the bank event is current/authoritative and Deal-allocatable;
2. no exact authoritative Deal attribution exists;
3. no known Deal/business scope exists;
4. no current Owner assertion/binding says it was already allocated;
5. the event is not FX / `NOT_APPLICABLE`;
6. it is not merely an associated fee with known principal scope;
7. it is not an exact-business-attribution / missing-materialization case;
8. it is not a known multi-Deal scope / split-to-verify case;
9. the remaining gap cannot be solved by technical materialization or source reconstruction;
10. a genuinely new Owner business allocation decision is required.

Then and only then:

```text
reconciliation_class = GENUINELY_UNALLOCATED
owner_action_required = true
owner_action = ALLOCATE_PAYMENT
```

All other reconciliation gaps may be exposed in Deal/payment drill-down as technical or source exceptions, but they do not create an Owner allocation queue item.

For the current Stage-1 reviewed set, the acceptance baseline is `generic unallocated = 0`.

## 8. Accounting-currency resolution algorithm

For each contour Deal:

1. Collect all authoritative verified incoming client payments allocated to that Deal.
2. Extract payment currencies from the immutable `payments` rows, not from UI or Finance display totals.
3. If the set has exactly one currency -> `AUTHORITATIVE / VERIFIED_INBOUND_CLIENT_PAYMENT`.
4. If the set has more than one currency:
   - look for a current explicit Owner rule resolving mixed inbound accounting currency;
   - if none -> `TO_VERIFY / MIXED_INBOUND_CURRENCIES`.
5. If there is no verified incoming client payment:
   - select current explicit source-locked Owner/Finance contractual payment currency;
   - if exactly one eligible current authority exists -> use it;
   - otherwise -> `TO_VERIFY / NO_AUTHORITATIVE_PREPAYMENT_CURRENCY`.
6. Historical management currency, prior universal USD presentation, client nationality, contract country, browser locale, or FX availability cannot supply accounting currency.

The algorithm is generic and contains no Deal-specific branches.

## 9. Deal spend and Bank/Treasury resource-chain algorithm

### 9.1 Eligibility as spend

An outgoing payment can enter Deal spend only when:

- bank fact is authoritative/current;
- payment represents completed outgoing execution (`COUNTERPARTY_PAYMENT`, eligible `BANK_FEE`, or another explicitly spend-eligible kind);
- Deal attribution is authoritative for the amount being counted;
- the payment is not merely an FX conversion principal/resource movement.

Incoming client payment allocation is never Deal spend.

### 9.2 Same-currency spend

If the execution payment currency equals Deal accounting currency, the attributed native execution amount may be used directly, provided attribution and amount coverage are authoritative.

### 9.3 Cross-currency spend

If execution currency differs from Deal accounting currency, require an exact resource chain that links:

`accounting-currency resource -> bank/Treasury conversion/source leg(s) -> specific execution payment -> specific Deal attribution`

The chain must identify enough information to prove the accounting-currency resource amount consumed by that execution. Required provenance includes source payment/leg references, execution payment, Deal, native amount/currency, accounting amount/currency, bank/Treasury source reference, authority state, lifecycle/currentness, and supersession.

Synthetic current FX, CBR FX, market FX, arithmetic back-solving, proportional allocation, invoice pricing FX, or a conversion occurring near the same date are not substitutes for this chain.

### 9.4 FX double-count prevention

FX source/destination conversion legs are resource transformations. Their principal amount is not added to `actual_spend` in addition to the later execution payment.

One economic resource consumption is counted once: at completed Deal-attributed execution, with the resource-chain used only to express it in accounting currency.

### 9.5 Missing chain

If cross-currency execution is Deal-attributed but no exact resource chain exists:

- preserve the native execution fact in drill-down/provenance;
- `actual_spend_status=TO_VERIFY` or `PARTIAL_TO_VERIFY` as appropriate;
- do not convert it synthetically;
- `remaining_execution=TO_VERIFY` if complete spend cannot be established.

## 10. Native renderer integration point

Stage 2 does not write UI.

Repository inspection of the prior/rejected V6 lineage shows two relevant facts:

1. the canonical Admin shell source has a native Payments section and a `renderPayments()` path inside the existing Admin page lifecycle;
2. the rejected `functions/portal/main-ui/index.js` path wrapped the existing Admin UI and performed string-replacement/takeover-style patching. V7 must not use that architecture.

### Proposed Stage-3 integration

The V7 renderer is integrated at the canonical Admin shell source layer, at the existing native `payments` route/page dispatch. There is exactly one Payments renderer owner.

Target source-level contract:

```text
existing Admin shell navigation
  -> existing payments page lifecycle
  -> one native renderPaymentsV7(projection)
  -> render data.paymentsV7Projection only
```

Backend projection is produced by one `buildAdminPaymentsV7Projection(...)` function and exposed through the ordinary authenticated Admin data path. The natural integration point is the existing `/admin/sync`/Admin bootstrap flow, replacing the need for frontend reconciliation of raw Finance fragments. A dedicated refresh endpoint may be added only if it calls the same projection builder and returns the same contract; it must not become a second truth or QA-only renderer path.

Forbidden in Stage 3:

- lexical replacement of `renderPayments`;
- wrapper HTML source rewriting;
- competing legacy and V7 renderers;
- MutationObserver DOM recovery;
- repeated/cyclic DOM ownership;
- full-page replacement that destroys native header/shell;
- special mock route with different projection or calculation semantics.

QA may intercept the data source, but it must exercise the same production projection contract and native renderer.

## 11. Read relations/API requirements and minimal persistence changes

### 11.1 Existing production relations to read

V7 projection requires read access to:

- `portal_private.deals`
- `portal_private.owner_deal_workflow`
- `portal_private.clients`
- `portal_private.contracts`
- `portal_private.documents` where documentary provenance is required
- `portal_private.payments`
- `portal_private.payment_references`
- `portal_private.payment_allocations`
- `portal_private.payment_allocation_authority_history_v1`
- `portal_private.owner_outgoing_payment_facts`
- `portal_private.owner_payment_plan` where current Finance obligation authority still legitimately references it
- `portal_private.owner_deal_finance_summary` only as a subordinate/legacy source when not superseded by newer authority
- `portal_private.ai_coordination_records` for current structured Finance/Owner authority selection and supersession provenance

The application should read these through a server-side adapter/projection layer. Browser code should not have direct access to private relations.

### 11.2 New persistence structure that is actually necessary

Current production schema has no dedicated structured current authority capable of representing all of the following without hardcode:

- exact business split known but `payment_allocations` not yet materialized;
- known shared multi-Deal scope where exact split is missing;
- direct Owner assertion that allocation exists while exact binding is not technically preserved;
- principal/associated-fee scope relationship;
- supersession of those attribution assertions as the missing system authority is later reconstructed.

`candidate_deal_ids` is insufficient, `owner_outgoing_payment_facts.deal_ids` cannot represent every amount/scope state, and generic `ai_coordination_records` is an audit/coordination envelope rather than a normalized per-payment current attribution contract.

Therefore Stage 3 requires one generic attribution authority model. Preferred normalized design:

#### `portal_private.payment_business_attributions_v7`

Header/current authority:

- `id uuid`
- `payment_key uuid`
- `classification text`
- `authority_kind text` (`OWNER`, `BANK_TREASURY`, `CANONICAL_DOCUMENT`, `FINANCE`, etc.)
- `authority_source_ref text`
- `business_scope_refs text[]`
- `principal_payment_key uuid null` for associated fee relationship
- `materialization_status text`
- `authority_state`
- `lifecycle_state`
- `effective_at`
- `supersedes_id uuid null`
- standard source/version/timestamp provenance

#### `portal_private.payment_business_attribution_lines_v7`

Optional exact/scope Deal lines:

- `attribution_id uuid`
- `deal_key uuid`
- `amount numeric null`
- `currency char(3) null`
- `amount_status text` (`EXACT`, `SCOPE_ONLY`)
- provenance/currentness fields as needed

This model is generic. It must not contain code-level exceptions for current Deal IDs or counterparties.

No DDL or production rows are created in Stage 2 because `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`.

### 11.3 Bank/Treasury resource-chain persistence

Current production schema does not contain the previously proposed `finance_deal_execution_accounting_currency_links_v6` relation. V7 must not recreate a V6-specific table by name or semantics merely to make the UI work.

Stage 3 has two acceptable options:

1. preferred: consume an existing authoritative Treasury/Bank API that already returns exact execution-resource linkage under the §9 contract; or
2. if no such authoritative API exists, introduce one generic resource-chain persistence model, e.g. `deal_execution_resource_chains` + normalized legs, with exact source/FX/execution/Deal provenance and supersession.

This persistence is necessary only if there is no existing authoritative Treasury provider capable of satisfying the contract. Until one exists, cross-currency spend fails closed to `TO_VERIFY`.

### 11.4 What is not needed

V7 does **not** need:

- a new Deal lifecycle field;
- a new payment-stage gate;
- a Deal-specific configuration table;
- a currency-default table that forces USD;
- a frontend cache of financial truth;
- a separate QA-only financial model;
- a table that mutates `PAYMENT.amount`.

## 12. A/B automated data-driven QA contract

The automated QA suite must prove that projection changes are driven by authoritative data only.

### Test A — Finance projection mutation without application-code change

1. Load Dataset A with a contour Deal and authoritative Finance obligation projection.
2. Build `AdminPaymentsProjectionV7`; capture projection A.
3. Change only authoritative Finance source data to Dataset B (for example total/expected/documentary state).
4. Do not change application code.
5. Rebuild projection.
6. Assert only data-dependent fields change to B and provenance points to B.

FAIL if a source-code change or Deal-specific constant is required.

### Test B — new Deal enters upstream contour

1. Dataset A has N contour Deals.
2. Add a new live Deal and set existing upstream `payment_handoff_state=READY` or `SENT`.
3. Provide generic identity/Finance authority through normal relations.
4. Rebuild with unchanged code.
5. Assert Deal count is N+1 and the new Deal projection is present.

FAIL if a Deal ID list must be edited in code.

### Test C — new verified client payment

1. Dataset A contains a Deal with authoritative total and current verified receipt.
2. Insert a new BANK_CONFIRMED + finance VERIFIED `INCOMING/CLIENT_PAYMENT` plus active VERIFIED allocation to the Deal.
3. Rebuild with unchanged code.
4. Assert `verified_received`, `remaining_to_receive`, and `payment_progress` recompute automatically.
5. Assert `actual_spend` is unchanged.

### Test D — new authoritative Deal spend

1. Add a new BANK_CONFIRMED outgoing execution payment.
2. Add generic authoritative Deal attribution.
3. If same currency, assert spend increases directly.
4. If cross-currency, add exact resource-chain authority and assert accounting-currency spend increases by the source-locked resource amount.
5. Remove/break the resource chain and assert spend fails closed to `TO_VERIFY`; no synthetic FX appears.

### Test E — genuine unresolved appears/disappears

1. Create an allocatable outgoing payment with no exact attribution, no known scope, no Owner assertion, no associated-principal scope, and not FX.
2. Assert class `GENUINELY_UNALLOCATED` and one Owner queue item.
3. Add a generic Owner assertion/known scope authority without frontend/code change.
4. Assert queue item disappears and classification changes to the appropriate non-queue class.

### Test F — technical materialization gap is not Owner action

Fixture exact business split exists in attribution authority but `payment_allocations` is empty.

Assert:

- class = `KNOWN_MULTI_DEAL_EXACT_SPLIT`;
- `owner_action_required=false`;
- technical materialization status remains visible;
- no generic unallocated row is created.

Current Stage-1 recovered 005/006 split is an admissible private/source-lock QA fixture for this scenario, but its Deal IDs and amounts must never become production branching logic.

### Test G — Owner-asserted allocated / authority not materialized

Fixture models the PAYEV-2026-000008 acceptance semantics generically:

- allocatable bank event;
- no materialized exact allocation;
- authoritative Owner assertion that it is already allocated;
- known business/source scope;
- exact technical binding unavailable.

Assert:

- class = `OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED`;
- no Owner queue item;
- no guessed Deal/split;
- technical reconstruction gap remains visible only as non-action exception.

Associated fee fixture asserts `ASSOCIATED_BANK_FEE` and inherits scope association, not an inferred split.

### Test H — FX conversion

Add conversion source/destination legs with allocation `NOT_APPLICABLE`.

Assert:

- class = `FX_CONVERSION_NOT_APPLICABLE`;
- no Owner queue item;
- no client receipt;
- no Deal spend merely from conversion principal;
- no double counting when later execution occurs.

### Test I — mixed inbound currencies

Allocate two verified client payments in different currencies to the same Deal without an explicit Owner mixed-currency rule.

Assert accounting currency and dependent calculations fail closed to `TO_VERIFY`.

### Test J — current acceptance baseline

For the current Stage-1 reviewed payment set, the semantic test must assert:

- generic `GENUINELY_UNALLOCATED` count = 0;
- exact resolved payments remain resolved;
- known exact multi-Deal split is not queueable;
- shared-scope fee split gap is not queueable;
- Owner-asserted allocated / system authority not materialized is not queueable;
- associated fee is not queueable;
- FX legs are not queueable.

## 13. Fail-closed behavior

V7 must prefer visible `TO_VERIFY` over fabricated precision.

Fail closed when any of the following occurs:

- no current authoritative accounting currency;
- mixed inbound currencies without Owner rule;
- Finance projection sources conflict or are stale/superseded without a current winner;
- verified receipt allocation currency conflicts with Deal accounting currency;
- outgoing payment has incomplete attribution for spend;
- cross-currency spend lacks exact Bank/Treasury resource chain;
- exact business split cannot be proved;
- technical source data violates amount coverage/integrity;
- provenance required by the contract is missing.

Fail-closed rules must not transform a technical gap into an Owner action. Owner queue has its own stricter predicate in §7.

## 14. NO HARDCODE contract

Production application code must contain **no hardcoded**:

- Deal IDs;
- current Deal/client names;
- current payment IDs as business branches;
- Deal-specific currencies;
- current amounts;
- current progress percentages;
- counterparty-specific financial branches;
- GazOne/005/006 special cases;
- universal USD default;
- known Owner figures as fallbacks;
- per-Deal status constants.

Permitted in production code:

- generic enum/state names;
- generic relation/field names;
- generic projection formulas;
- generic authority/supersession rules;
- generic endpoint/contract version identifiers.

Current Deal IDs/amounts/payment IDs may appear only in tests/fixtures/source-lock assertions, never as production calculation logic.

Architecture acceptance rule:

> If a new Deal, payment amount, verified client receipt, Finance obligation, Deal spend, attribution state, or genuine Owner exception requires an application-code commit, V7 architecture has failed.

## 15. NO UPSTREAM LIFECYCLE CHANGE

Confirmed: V7 requires **no upstream Deal lifecycle change**.

The existing upstream `owner_deal_workflow.payment_handoff_state` is the only payment-contour handoff signal consumed by V7, together with current Deal lifecycle/cancellation state.

V7 is read-only toward upstream Deal lifecycle.

No new payment-stage status/gate is designed or authorized.

## Stage-2 exit criteria

Stage 2 is complete when this document is committed and post-write verification confirms:

- it is in PR #469 branch;
- only documentation changed in this Stage-2 commit;
- no UI/CSS/runtime implementation was introduced;
- no production business data was mutated;
- PR remains open/draft/unmerged;
- holds remain in force.

The next permitted phase is Stage 3 clean implementation, but `UI_IMPLEMENTATION=HOLD` remains until explicitly released by Owner.