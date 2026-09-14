# Admin → Payments V7 — Stage 1 reconciliation

Status: `STAGE_1=OPEN` pending one source-reconstruction clarification identified in Stage 1B. This document contains data-truth, source-lock and classification findings only. No V7 UI implementation is included. Production business data remains unchanged.

Current gates: `STAGE_2=HOLD`, `UI_IMPLEMENTATION=HOLD`, `MERGE=HOLD`, `PRODUCTION_DEPLOY=HOLD`, `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`.

## Scope

V7 follows the pipeline:

`authoritative data -> reconciliation -> calculation -> projection -> UI`

The UI is not an authority for financial values, Deal attribution, payment allocation, FX, expected receipts, or spend.

A missing technical `PAYMENT_ALLOCATION` row or Owner-decision row is not, by itself, evidence that business attribution does not exist.

## Authoritative source layers

- Payment-contour membership: existing upstream Deal/workflow state. V7 is read-only with respect to Deal lifecycle.
- Bank facts: `portal_private.payments`.
- Materialized Deal allocation: `portal_private.payment_allocations`, using active authoritative verified allocations only.
- Outgoing source evidence: `portal_private.owner_outgoing_payment_facts`, bank payment documents, supplier obligations, canonical Finance/Commercial evidence and explicit Owner authority.
- Finance/Owner projection authority: current source-locked Finance conclusion plus eligible current per-Deal projection records.
- Cross-currency Deal spend: authoritative bank/Treasury resource-chain only. No current/CBR/market synthetic FX.
- Canonical archive: signed supplier/client documents and current canonical Finance workbooks are admissible source-lock evidence; derived projections do not override newer direct Owner authority.

## V6 false-unallocated root cause

The rejected V6 path inherited the V5 `buildUnallocated` model. For outgoing `COUNTERPARTY_PAYMENT` / `BANK_FEE` rows, that function did not reconcile active `PAYMENT_ALLOCATION` records and did not consume confirmed Deal attribution already available from outgoing-payment evidence. Instead, it treated the absence of a separate Owner-decision row as sufficient to classify the whole outgoing payment as unresolved.

That is invalid. An outgoing payment is not unresolved merely because no Owner decision row exists.

V7 must classify unresolved state from the joined authoritative evidence graph, not from a single auxiliary decision table.

## Stage 1B — Owner-truth reconciliation

Latest Owner authority establishes an additional hard rule: the outgoing payments previously presented by the rejected screen as generic “unallocated” were factually allocated in the business process. Therefore historical Finance labels such as `UNALLOCATED / TO_VERIFY` are treated as technical/materialization state only where they conflict with later direct Owner truth.

The V7 classification model must distinguish at least:

1. `RESOLVED` — exact Deal attribution is source-locked and technically materialized;
2. `KNOWN_MULTI_DEAL_EXACT_SPLIT / SYSTEM_ALLOCATION_NOT_MATERIALIZED` — exact business split is source-locked but the current allocation table does not reflect it;
3. `SHARED_DEAL_SCOPE / SPLIT_TO_VERIFY` — business scope is known, exact split is not source-locked;
4. `OWNER_ASSERTED_ALLOCATED / SYSTEM_AUTHORITY_NOT_MATERIALIZED` — Owner confirms allocation exists, but the currently accessible system authority does not preserve enough detail to reconstruct the exact Deal binding;
5. `UNALLOCATED` — only after full reconciliation proves that no business attribution exists and a genuinely new Owner allocation decision is required.

### DEAL-2026-004 outgoing records

The six historical outgoing records for supplier/logistics/bank-fee spend are fully resolved by existing verified Deal allocations to `DEAL-2026-004`.

They must never enter an unresolved or unallocated queue again.

Classification: `RESOLVED`.

### OUT-2026-005006-KUZMASH — principal

The bank fact is a confirmed outgoing KUZMASH payment with known Deal scope `DEAL-2026-005 + DEAL-2026-006`.

Stage 1B source-lock recovered the exact business split from the current canonical Deal P&L / paid-resource evidence:

- `DEAL-2026-005`: `13,229,568 RUB` — KUZMASH 30% paid resource amount for the documented 480 t component;
- `DEAL-2026-006`: `3,307,392 RUB` — KUZMASH 30% paid resource amount for the 120 t component;
- exact total: `16,536,960 RUB`, equal to the bank principal.

This is an exact source-locked reconciliation result, not a newly calculated proportional allocation.

Classification: `KNOWN_MULTI_DEAL_EXACT_SPLIT / SYSTEM_ALLOCATION_NOT_MATERIALIZED`.

It is not `UNALLOCATED`, and it does not require a new Owner allocation decision.

### OUT-2026-005006-KUZMASH-FEE

The associated `3,000 RUB` bank fee is in the known 005/006 transaction scope, but no retrieved authoritative Bank/Treasury/Accounting source assigns the fee amount between the two Deals. The canonical Deal P&L does not allocate that fee to either Deal.

No proportional or principal-ratio split is permitted.

Classification: `SHARED_DEAL_SCOPE / FEE_SPLIT_AUTHORITY_MISSING`.

It is not a generic unallocated bank payment. The remaining gap is fee-attribution granularity inside an already known transaction scope.

### PAYEV-2026-000008 — primary payment order recovered

Primary bank/payment-order evidence was recovered for the `3,644,000 RUB` outgoing KUZMASH payment.

Payment order `№ 2/1266410` dated 10.09.2026 states the payment purpose as a partial 30% advance for gas under KUZMASH Contract `1008-2026` dated 10.08.2026 and Specification `No. 2`.

Therefore the business obligation scope is source-locked: this is not a generic unidentified KUZMASH payment.

Canonical Specification No. 2 establishes a supplier package of 895 t with three destination/resource lines:

- Kirgili — 175 t;
- Bataysk — 250 t;
- Neklinovka — 470 t;

Existing Deal/application evidence maps those destinations into the current business graph as Kirgili / `DEAL-2026-004`, Bataysk / `DEAL-2026-007`, and Neklinovka / `DEAL-2026-008`. Current client direct-payment arrangements for Deals 007/008 also point to the same KUZMASH Contract 1008-2026 / Specification No. 2.

However, after exhausting the currently accessible bank, Treasury/payment, PAYMENT/PAYMENT_ALLOCATION history, Finance/Commercial/Operations coordination, canonical Drive, document registry and mail sources, no authoritative record was found that states the exact Deal ID or exact multi-Deal amount split for this `3,644,000 RUB` RONA payment.

The bank document itself identifies Contract 1008-2026 / Specification No. 2 but does not identify a Deal. The Specification does not yield a unique deterministic split for 3,644,000 RUB, and Operations evidence explicitly warns against inferring line-to-recipient attribution without an additional source. Sequential, proportional, or residual allocation is therefore prohibited.

Direct Owner authority nevertheless establishes that the payment was factually allocated. Accordingly the old derived `UNALLOCATED` label is not business truth.

Classification: `OWNER_ASSERTED_ALLOCATED / KNOWN_SPEC2_SCOPE / SYSTEM_AUTHORITY_NOT_MATERIALIZED`.

This is a source-reconstruction/materialization gap, not a new allocation decision.

### PAYEV-2026-000009 — associated fee

The separate `3,000 RUB` bank-fee record is explicitly the commission for the PAYEV-2026-000008 / bank-document-2539516 transfer.

Its transaction scope is therefore known. The accessible sources do not contain a separate exact per-Deal fee allocation authority, and fees must not silently inherit a principal split unless an explicit rule/source permits it.

Classification: `ASSOCIATED_BANK_FEE / OWNER_ASSERTED_SCOPE / FEE_ATTRIBUTION_NOT_MATERIALIZED`.

It is not `UNALLOCATED`.

## Stage 1B classification matrix

| Event group | Business attribution truth | Technical state | V7 classification | Generic Owner unallocated queue |
| --- | --- | --- | --- | --- |
| Six DEAL-004 outgoing records | Exact Deal = 004 | Verified allocations materialized | `RESOLVED` | Never |
| OUT-2026-005006-KUZMASH principal | Exact split 005 / 006 source-locked | Exact split not materialized in current allocation table | `KNOWN_MULTI_DEAL_EXACT_SPLIT / SYSTEM_ALLOCATION_NOT_MATERIALIZED` | Never |
| OUT-2026-005006-KUZMASH fee | Shared scope 005 / 006 known | Exact fee split authority missing | `SHARED_DEAL_SCOPE / FEE_SPLIT_AUTHORITY_MISSING` | Never |
| PAYEV-2026-000008 | Owner confirms allocated; Contract 1008-2026 / Spec 2 scope source-locked | Exact Deal binding not recoverable from current system authority | `OWNER_ASSERTED_ALLOCATED / KNOWN_SPEC2_SCOPE / SYSTEM_AUTHORITY_NOT_MATERIALIZED` | Never while Owner assertion stands |
| PAYEV-2026-000009 | Fee belongs to the 000008 transfer scope | Separate exact fee attribution not materialized | `ASSOCIATED_BANK_FEE / OWNER_ASSERTED_SCOPE / FEE_ATTRIBUTION_NOT_MATERIALIZED` | Never |
| FX conversion legs | Resource conversion only | Deal allocation `NOT_APPLICABLE` | `FX_CONVERSION` | Never |

## Owner action count after Stage 1B

For the payment set under review:

- generic `UNALLOCATED` cases: **0**;
- genuinely new Owner allocation decisions required: **0**;
- source-reconstruction clarifications still required: **1** — the exact previously-made Deal attribution for PAYEV-2026-000008.

This distinction is mandatory. Restoring an already-existing Owner business attribution is not the same as asking Owner to make a new allocation decision.

## Exhausted source-lock for PAYEV-2026-000008

The following read-only sources were checked without finding the missing exact Deal binding:

- primary `portal_private.payments` bank fact and bank reference 2539516;
- `portal_private.payment_allocations`;
- `portal_private.payment_allocation_authority_history_v1`;
- payment references / outgoing payment facts;
- Owner payment-plan records;
- Deal/document/version relations;
- supplier/resource decision tables;
- Finance, Commercial and Operations coordination records immediately before and after 10.09.2026;
- canonical Finance liquidity and P&L workbooks;
- canonical KUZMASH Contract 1008-2026 / Specification No. 2 / invoice package;
- NIK-OIL direct-payment documents linked to the same supplier obligation;
- bank statement evidence and the underlying payment order `№ 2/1266410`;
- corporate mail and accessible archive search around the payment date.

What is missing is not proof of whether the payment belongs to a supplier obligation; that is already source-locked. The only unrecovered fact is the exact Deal ID / exact multi-Deal split that Owner says was previously assigned.

## Required V7 unresolved rule

A bank event may be classified `UNALLOCATED` only when, after the full evidence graph is reconciled, all of the following are true:

1. the bank fact is authoritative and active;
2. the payment is Deal-allocatable;
3. no active authoritative Deal allocation resolves the attribution;
4. no confirmed outgoing-payment attribution resolves it;
5. no canonical document/payment-preparation/Treasury/Finance/Commercial evidence establishes its business scope or exact binding;
6. no direct Owner authority asserts that the event has already been allocated;
7. the event is not a known-scope / missing-materialization case;
8. the event is not a known multi-Deal scope / missing-split case;
9. the event is not an FX-conversion leg or another `NOT_APPLICABLE` allocation class;
10. a genuinely new Owner allocation decision is required.

A known factual Deal attribution must never be downgraded to `UNALLOCATED` merely because its technical persistence record is missing.

## FX rule

FX-conversion source and destination legs are resource movements, not client receipts and not completed Deal spend by themselves. They are excluded from the Owner unresolved queue when Deal allocation is `NOT_APPLICABLE`. Conversion principal must not be double-counted with the later execution payment.

## V7 data contract — minimum fields

### Contour

`deal_id`, `payment_handoff_state`, `deal_lifecycle_state`, `deal_authority_state`, `client_id`, `client_name`, `contract_id`, source provenance.

### Immutable payment fact

`payment_id`, `payment_at`, `direction`, `kind`, `amount`, `currency`, bank confirmation, Finance verification, payer/beneficiary/counterparty, purpose, bank reference, allocation applicability/review state, candidate Deal IDs, FX source fields, source provenance.

### Reconciled business attribution

`payment_id`, exact Deal ID(s) where known, exact allocated amounts where known, attribution class, business-authority source, technical-materialization state, reconstruction status, supersession provenance.

This layer is distinct from raw `PAYMENT_ALLOCATION`; it must be capable of representing source-locked business truth that is not yet materialized in the allocation table.

### Allocation

`payment_id`, `deal_id`, `allocated_amount`, allocation status, authority state, lifecycle state, allocation reference, source provenance. Superseded allocation rows are excluded.

### Client receipt projection

Derived only from verified incoming `CLIENT_PAYMENT` bank facts plus verified active client-payment Deal allocation.

### Expected / due projection

`accounting_currency`, `total_to_receive`, `verified_received`, `due_now`, `expected_not_due`, `future_conditional`, projection status, Finance status, documentary/trigger status, Finance authority record/version/source timestamp.

### Deal spend

Native outgoing amount/currency, exact Deal attribution authority, spend class, and optional accounting-currency amount only when an authoritative bank/Treasury resource-chain exists. Incoming allocation is never Deal spend.

### Exception classes

V7 must keep separate:

- `TRUE_UNALLOCATED_OWNER_DECISION_REQUIRED`;
- `KNOWN_SCOPE_SPLIT_TO_VERIFY`;
- `OWNER_ASSERTED_ALLOCATED_AUTHORITY_NOT_MATERIALIZED`;
- `EXACT_ATTRIBUTION_NOT_MATERIALIZED`;
- `FEE_ATTRIBUTION_NOT_MATERIALIZED`;
- `FX_CONVERSION_NOT_APPLICABLE`.

Only the first class belongs in a generic Owner allocation queue.

## Lifecycle conclusion

No upstream Deal lifecycle change is required by Stage 1 or Stage 1B. V7 must consume the existing payment handoff/membership state and remain read-only toward upstream Deal lifecycle.

## Stage 1B close condition

The only remaining Stage 1 source-reconstruction gap is PAYEV-2026-000008 exact Deal attribution. All available read-only sources establish the supplier Contract/Specification scope but do not contain the exact Deal binding asserted by Owner.

Until that exact prior attribution is restored or explicitly source-locked, `STAGE_1=OPEN` and Stage 2/UI remain on hold.
