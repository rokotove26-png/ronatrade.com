# Admin → Payments V7 — Stage 2.1 architecture correction

Status: `STAGE_2_1=COMPLETE / DESIGN_ONLY`.

This is a normative correction to `docs/admin-payments-v7-stage2-data-contract.md`. If the two documents conflict, Stage 2.1 controls. All non-conflicting Stage-2 rules remain in force. The current architecture contract is Stage 2 + Stage 2.1.

No Stage-3 implementation is started. No UI/CSS/runtime code, DDL, deployment, or production business-data mutation is authorized.

Current gates:

- `UI_IMPLEMENTATION=HOLD`
- `MERGE=HOLD`
- `PRODUCTION_DEPLOY=HOLD`
- `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`

## 0. CURRENT_STATE_FIRST

Recovery was performed from repository state, not chat memory.

- repo: `rokotove26-png/ronatrade.com`
- PR: `#469`
- branch: `feat/admin-payments-v7-clean-rebuild`
- base: `main`
- verified pre-write HEAD: `d18c37692064e7e515a4ef8511bd87199ea2f3d5`
- PR at recovery: `OPEN / DRAFT / merged=false`
- pre-write changed files: Stage 1 and Stage 2 documentation only
- Stage-1 blob: `b89b52227a7feb4ea11b9fdec6dbf777771d2db0`
- Stage-2 blob: `8174942bb011dc48460e40e8ac4893cf9189cecf`

Both documents were re-read from that HEAD. Production schema was inspected read-only only to answer the Finance-normalization question below.

## 1. Correction A — full Owner workflow

Stage 2's single `ALLOCATE_PAYMENT` action is superseded.

```ts
type OwnerPaymentDecisionV7 =
  | 'BIND_TO_DEAL'
  | 'ASSIGN_ADVANCE_PAYMENT';
```

For a `GENUINELY_UNALLOCATED` event the projection must expose:

```text
owner_action_required = true
allowed_owner_actions = [BIND_TO_DEAL, ASSIGN_ADVANCE_PAYMENT]
```

For every other reconciliation class:

```text
owner_action_required = false
allowed_owner_actions = []
```

The projection contract therefore uses `allowed_owner_actions: OwnerPaymentDecisionV7[]`; the old single `owner_action='ALLOCATE_PAYMENT'` field is not part of the corrected contract.

### `BIND_TO_DEAL`

This is explicit Owner/Admin authority assigning the payment, or exact amount portions, to one or more Deals. Server-side validation must cover payment identity, current authority state, amount/currency integrity, Deal targets, amount coverage, stale-write protection, and actor authority.

The resulting business authority and its physical allocation materialization remain separate concepts.

### `ASSIGN_ADVANCE_PAYMENT`

This is a distinct Owner disposition. It must not be converted into `CLIENT_PAYMENT` merely to make projection totals work.

Hard rules:

- it does not contribute to `verified_received`;
- it does not reduce `total_to_receive`;
- it does not reduce `remaining_to_receive`;
- it does not modify `due_now`, `expected_not_due`, or `future_conditional` by arithmetic side effect;
- it remains separately source-locked and versioned until later superseded.

Both actions are Owner/Admin only, server-side. Finance AI/system, reconciliation automation, and frontend code may surface the decision but may not execute it automatically.

Every decision must preserve immutable audit/supersession history: decision id, payment id(s), decision type, exact decision scope, actor authority, effective timestamp, source/rationale refs, previous authority if superseded, resulting authority version, and replay/idempotency protection.

Only `GENUINELY_UNALLOCATED` enters this generic Owner decision queue. Known-scope, materialization, source-reconstruction, associated-fee, and FX cases remain non-queue exceptions.

## 2. Correction B — authority precedes materialization

The rule "`payment_allocations` wins because a VERIFIED row exists" is forbidden.

For each payment-attribution scope, current truth is resolved in this order:

1. collect applicable authority claims;
2. filter inactive/rejected/reversed/QA-only/non-current claims;
3. apply explicit supersession;
4. apply effective/current state and version;
5. require sufficient source-lock for the asserted field/scope;
6. select the surviving field-specific authority;
7. only then inspect physical materialization rows and compare them with current truth.

Canonical invariant:

```text
business truth = authority -> effective/current state -> supersession -> source-lock
materialization = physical representation of that truth
```

A later eligible superseding Owner authority therefore overrides an older VERIFIED allocation for the same scope even if the old row remains physically present.

In that case V7 must use the later business truth and expose a technical stale-materialization state, for example:

```text
business_truth_status = AUTHORITATIVE
materialization_status = STALE_SUPERSEDED_MATERIALIZATION
```

The projection builder remains read-only and does not repair production rows itself.

Stage 2 §4/§5 is corrected accordingly: exact materialized allocations are not the unconditional first truth winner. `RESOLVED` means current exact authority plus aligned materialization; exact truth with missing/stale materialization keeps its own explicit materialization status.

## 3. Correction C — normalized Finance obligation authority

Production Owner projection must consume one stable Finance runtime contract and must not parse arbitrary Deal-specific or schema-version-specific JSON branches from `ai_coordination_records`.

```ts
type DealFinanceAuthorityV7 = {
  deal_id: string;
  total_to_receive: MoneyValue;
  due_now: MoneyValue;
  expected_not_due: MoneyValue;
  future_conditional: MoneyValue;
  finance_status: string;
  documentary_status: DocumentaryStatus;
  contractual_payment_currency: {
    currency: string | null;
    status: 'AUTHORITATIVE' | 'TO_VERIFY';
    reason: string | null;
  };
  authority_state: string;
  lifecycle_state: string;
  effective_at: string;
  version: string | null;
  supersedes_id: string | null;
  authority_refs: AuthorityRef[];
};
```

Historical Finance conclusions and coordination records remain provenance/input-layer sources only.

### Read-only schema finding

The inspected existing relations do not provide the full stable contract above:

- `owner_deal_finance_summary` has high-level obligation/received/currency/status/source metadata, but no separate normalized `due_now`, `expected_not_due`, `future_conditional`, `documentary_status`, or explicit contractual-payment-currency authority.
- `owner_payment_plan` has planned amount, currency, due date and status, but not the full authority/supersession/documentary contract.
- `ai_coordination_records` has generic version/supersession/source metadata plus free-form `payload jsonb`; current Finance conclusions use a generic envelope rather than the required normalized obligation schema.

Therefore a stable production adapter cannot be proven from the inspected relations without a normalization boundary. The Owner projection must not grow special parsers for particular Deals or Finance payload versions.

### Minimal future normalization model

No DDL is performed in Stage 2.1. The minimal future normalized authority may be one generic relation/API such as `deal_finance_authority_v7`, carrying:

- canonical Deal reference;
- `total_to_receive`;
- `due_now`;
- `expected_not_due`;
- `future_conditional`;
- obligation currency;
- contractual payment currency;
- Finance status;
- documentary status;
- authority/lifecycle state;
- effective timestamp;
- source version/timestamp/refs;
- supersedes reference;
- audit fields.

The server-side normalization adapter may read historical coordination records, summaries, payment plans and canonical documents, but it must emit the same `DealFinanceAuthorityV7` contract before `buildAdminPaymentsV7Projection(...)` sees the data.

A source schema change belongs in that generic normalization adapter, not in Deal-specific projection logic. Until a normalized provider exists, affected obligation fields fail closed.

## 4. Correction D — over-receipt semantics

`financial_status` gains explicit state:

```text
OVERRECEIVED
```

The formula remains unclamped:

```text
remaining_to_receive = total_to_receive - verified_received
```

When both inputs are authoritative in the same accounting currency and `verified_received > total_to_receive`:

```text
remaining_to_receive < 0
financial_status = OVERRECEIVED
```

`payment_progress` also remains unclamped and may exceed 100%.

Corrected backend status precedence:

1. authority/currency/core-obligation conflict -> `TO_VERIFY`;
2. `verified_received > total_to_receive` -> `OVERRECEIVED`;
3. `remaining_to_receive == 0` -> `PAID`;
4. authoritative overdue condition -> `OVERDUE`;
5. `due_now > 0` -> `DUE`;
6. `expected_not_due > 0` -> `EXPECTED`;
7. `future_conditional > 0` -> `CONDITIONAL`;
8. otherwise -> `OPEN`.

Over-receipt is also exposed as a separate backend financial exception, e.g. `OVERRECEIPT`, with authoritative excess amount and provenance. It is not a payment-attribution exception and never enters the generic Owner allocation queue.

The backend must not clamp the negative remainder, hide it, convert it to `OPEN`, or silently normalize it to ordinary `PAID`.

## 5. Corrected projection deltas

```ts
type OwnerPaymentDecisionV7 =
  | 'BIND_TO_DEAL'
  | 'ASSIGN_ADVANCE_PAYMENT';

type PaymentExceptionV7 = {
  exception_id: string;
  payment_ids: string[];
  reconciliation_class: ReconciliationClass;
  owner_action_required: boolean;
  allowed_owner_actions: OwnerPaymentDecisionV7[];
  candidate_deal_ids: string[];
  known_scope_refs: string[];
  technical_gap: string | null;
  authority_refs: AuthorityRef[];
};

type FinancialExceptionV7 = {
  code: 'OVERRECEIPT';
  amount: MoneyValue;
  authority_refs: AuthorityRef[];
};
```

`DealPaymentsProjectionV7` must include `OVERRECEIVED` in `financial_status` and add `financial_exceptions: FinancialExceptionV7[]`.

## 6. Corrected state machines

Payment attribution:

```text
bank fact
 -> authority claims
 -> current/applicable filter
 -> supersession/effective resolution
 -> source-lock winner
 -> materialization comparison
 -> reconciliation class
 -> only GENUINELY_UNALLOCATED enters Owner queue
    with [BIND_TO_DEAL, ASSIGN_ADVANCE_PAYMENT]
```

Deal finance:

```text
DealFinanceAuthorityV7
 + verified incoming CLIENT_PAYMENT receipts
 + accounting-currency authority
 -> formulas
 -> conflict gate
 -> OVERRECEIVED if received > total
 -> otherwise PAID / OVERDUE / DUE / EXPECTED / CONDITIONAL / OPEN
```

`ASSIGN_ADVANCE_PAYMENT` stays outside the client-receipt formula unless a later separate authority supersedes that disposition.

## 7. QA additions

Existing Stage-2 tests A-J remain, subject to this correction. Add:

### K — Owner `BIND_TO_DEAL`

Start with a genuine unallocated event. Assert the queue exposes exactly both allowed Owner actions. Execute an authorized Owner/Admin bind in a test fixture. Assert the new authority version becomes current, immutable history remains, the queue item disappears, and a non-Owner Finance/system actor cannot perform the action.

### L — Owner `ASSIGN_ADVANCE_PAYMENT`

Start with a genuine unallocated event and apply authorized advance disposition. Assert it is no longer in the generic queue, is not converted to `CLIENT_PAYMENT`, and does not change `verified_received`, `total_to_receive`, `remaining_to_receive`, or Finance obligation buckets. Assert later supersession preserves history.

### M — superseding Owner authority over old VERIFIED allocation

Fixture an older VERIFIED/materialized allocation to Deal A, then a later eligible Owner authority superseding it to Deal B or a different exact split while leaving the old physical row present. Assert current truth follows the later authority, the old row does not win by existence, stale materialization is visible, and the amount is not double-counted.

### N — Finance source schema change without Deal-specific code

Normalize two different Finance source payload versions to the same `DealFinanceAuthorityV7`. Assert `buildAdminPaymentsV7Projection(...)` is unchanged, has no Deal/counterparty/schema-version branch, preserves provenance, and produces equivalent semantics.

FAIL if the Owner projection itself must parse special JSON paths for a specific Deal or Finance conclusion version.

### O — over-receipt

Fixture authoritative `total_to_receive=100` and `verified_received=120` in the same currency. Assert:

- `remaining_to_receive=-20`;
- progress = `120%`;
- `financial_status=OVERRECEIVED`;
- financial exception `OVERRECEIPT` amount = `20`;
- no clamping;
- not `OPEN`;
- no Owner allocation queue item merely because of over-receipt.

## 8. Consistency review

| Concern | Enum/API | Formula | State machine | Exception/queue | QA |
| --- | --- | --- | --- | --- | --- |
| Owner workflow | two Owner actions | no automatic receipt effect | only genuine unallocated actionable | one queue, two allowed actions | K/L |
| Advance disposition | distinct from CLIENT_PAYMENT | excluded from receipt/obligation reduction | separate until superseded | leaves generic queue after Owner decision | L |
| Authority precedence | truth separate from materialization | stale rows not double-counted | authority/current/supersession/source-lock first | stale materialization is technical | M |
| Finance authority | `DealFinanceAuthorityV7` | normalized obligation buckets | normalized current/superseding authority | schema gaps fail closed | N |
| Over-receipt | `OVERRECEIVED` | negative remainder and >100% preserved | explicit state after conflict gate | financial exception, not allocation queue | O |

Consistency result: **PASS**. Enums, formulas, attribution state machine, financial state machine, exception separation, Owner queue predicate, and QA coverage are aligned under Stage 2 + Stage 2.1.

## 9. Holds

This document authorizes no implementation. No DDL, Owner-action endpoint, allocation repair, Finance rewrite, renderer work, deployment, or production business-data mutation is performed.

Stage 3 remains not started and all four HOLD gates remain in force.
