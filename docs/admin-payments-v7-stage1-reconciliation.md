# Admin → Payments V7 — Stage 1 reconciliation

Status: data-truth baseline for the clean V7 rebuild. This document intentionally contains architecture and classification findings only; live financial values remain in the authoritative private data sources and are not duplicated into this public repository.

## Scope

V7 follows the pipeline:

`authoritative data -> calculation -> projection -> UI`

The UI is not an authority for financial values, Deal attribution, payment allocation, FX, expected receipts, or spend.

## Authoritative source layers

- Payment-contour membership: existing upstream Deal/workflow state. V7 is read-only with respect to Deal lifecycle.
- Bank facts: `portal_private.payments`.
- Deal allocation: `portal_private.payment_allocations`, using active authoritative verified allocations only.
- Outgoing source evidence: `portal_private.owner_outgoing_payment_facts` plus an explicit Owner-authorized outgoing binding when such authority exists.
- Finance/Owner projection authority: current source-locked Finance conclusion plus its eligible current per-Deal projection records.
- Cross-currency Deal spend: authoritative bank/Treasury resource-chain only. No current/CBR/market synthetic FX.

## V6 false-unallocated root cause

The rejected V6 path inherited the V5 `buildUnallocated` model. For outgoing `COUNTERPARTY_PAYMENT` / `BANK_FEE` rows, that function did not reconcile active `PAYMENT_ALLOCATION` records and did not consume confirmed Deal attribution already available from outgoing-payment evidence. Instead, it treated the absence of a separate Owner-decision row as sufficient to classify the whole outgoing payment as unresolved.

That is invalid. An outgoing payment is not unresolved merely because no Owner decision row exists.

V7 must classify unresolved state from the joined authoritative evidence graph, not from a single auxiliary decision table.

## Required V7 unresolved rule

A bank event can enter the Owner decision queue only when all of the following remain true after reconciliation:

1. the bank fact is authoritative and active;
2. the payment is Deal-allocatable;
3. no active authoritative Deal allocation resolves the exact attribution;
4. no confirmed outgoing-payment attribution resolves it;
5. no valid Owner-authorized outgoing binding resolves it;
6. the event is not an FX-conversion leg or another `NOT_APPLICABLE` allocation class.

Known candidate Deals with an unresolved split must be represented as an attribution-granularity exception, not as a generic unknown payment.

## FX rule

FX-conversion source and destination legs are resource movements, not client receipts and not completed Deal spend by themselves. They are excluded from the Owner unresolved queue when Deal allocation is `NOT_APPLICABLE`. Conversion principal must not be double-counted with the later execution payment.

## V7 data contract — minimum fields

### Contour

`deal_id`, `payment_handoff_state`, `deal_lifecycle_state`, `deal_authority_state`, `client_id`, `client_name`, `contract_id`, source provenance.

### Immutable payment fact

`payment_id`, `payment_at`, `direction`, `kind`, `amount`, `currency`, bank confirmation, Finance verification, payer/beneficiary/counterparty, purpose, bank reference, allocation applicability/review state, candidate Deal IDs, FX source fields, source provenance.

### Allocation

`payment_id`, `deal_id`, `allocated_amount`, allocation status, authority state, lifecycle state, allocation reference, source provenance. Superseded allocation rows are excluded.

### Client receipt projection

Derived only from verified incoming `CLIENT_PAYMENT` bank facts plus verified active Deal allocation.

### Expected / due projection

`accounting_currency`, `total_to_receive`, `verified_received`, `due_now`, `expected_not_due`, `future_conditional`, projection status, Finance status, documentary/trigger status, Finance authority record/version/source timestamp.

### Deal spend

Native outgoing amount/currency, exact Deal attribution authority, spend class, and optional accounting-currency amount only when an authoritative bank/Treasury resource-chain exists. Incoming allocation is never Deal spend.

### Owner exceptions

`payment_id`, unresolved dimension, candidate Deal IDs if known, missing authority/evidence, allowed Owner action, and source provenance. No generic `unallocated` row may be created solely because an auxiliary decision record is absent.

## Lifecycle conclusion

No upstream Deal lifecycle change is required by Stage 1. V7 must consume the existing payment handoff/membership state and remain read-only toward upstream Deal lifecycle.

## Implementation gate

No V7 UI implementation starts from this document. Stage 2 must formalize the contract and calculation boundary first. Production business-data mutation, production deployment, and merge remain outside this Stage 1 change.