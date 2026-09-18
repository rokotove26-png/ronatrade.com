# Issue #629 — Finance Cash release reconciliation

## Scope

Release-targeted repository reconciliation only.

- Production branch: `release/public-go-live-v1.1`
- Reconciliation base: `79e0a2c9d6ca1f2fb1532fa8e41af98a1cd2be8c`
- Finance source branch used only for selected artifacts: `finance/admin-cash-source-projection-630`
- Finance PR #632 is **not** merged wholesale.
- No Payment, PaymentAllocation, Deal, bank amount, ledger row, canonical identity, raw bank operation, or source-lock business fact is changed by repository reconciliation.

## Artifacts copied into the release baseline

Finance Cash migrations:

- `supabase/migrations/20260918130000_finance_admin_cash_source_projection_v1.sql`
- `supabase/migrations/20260918132500_finance_admin_cash_cumulative_ledger_v2.sql`
- `supabase/migrations/20260918171000_finance_cash_counterparty_identity_v1.sql`
- `supabase/migrations/20260918184500_finance_cash_stable_entity_identity_hold_629.sql`

Finance Cash automation sources already active in production:

- `supabase/functions/rona-accounting-statement-intake/index.ts`
- `supabase/functions/rona-accounting-mail-bridge/index.ts`
- `supabase/functions/rona-role-mail-bridge/index.ts`

Finance Cash tests / release CI:

- `tests/admin-cash-source-projection/source-projection.test.mjs`
- `tests/admin-cash-source-projection/cumulative-ledger-v2.test.mjs`
- `tests/admin-cash-source-projection/counterparty-identity-v1.test.mjs`
- `tests/admin-cash-source-projection/hold-629-stable-entity-id.test.mjs`
- `tests/admin-cash-source-projection/hold-629-production-regression.sql`
- `.github/workflows/admin-cash-source-projection-qa.yml`

## Production migration-history reconciliation

The four Finance migrations above had already been materially applied to production by prior controlled Finance work, but their repository migration versions were absent from `supabase_migrations.schema_migrations`.

The DDL was **not replayed**.

Before migration-history reconciliation, production was verified to contain all required Finance Cash tables/views/functions and the following invariants:

- current operations: 43;
- unique operation fingerprints: 43;
- canonical `PAYMENT:*` IDs: 0;
- invalid canonical entity prefixes: 0;
- TO_VERIFY: 1;
- daily rows: 144;
- zero-turnover rows: 126;
- statement checkpoints: 20 / 20 PASS;
- max daily balance difference: 0;
- max statement checkpoint difference: 0;
- closing balances: USD 231,557.04; RUB 1,756,237.63; KZT 0.91.

The exact current schema/function fingerprints were captured before the metadata write:

- operations current view: `b0ec9a8b318ff4a6eea4c8d1c0c13f37`
- daily summary view: `68f0222f7809d25eec3e1fd33afef3bb`
- checkpoint audit view: `fcb91b66241da40db95c18a11cfe39ba`
- identity view: `27003665e832852b9332feb18eea9ccd`
- payload v1 function: `431183985411849de43a7fe58d55ef8f`
- payload v2 identity wrapper: `9152967a2184624d6d42c94e159eddca`
- public Admin RPC: `9e8a92d7d73573a0fbf41bb3246e6232`

Only migration metadata was then inserted for:

- `20260918130000 finance_admin_cash_source_projection_v1`
- `20260918132500 finance_admin_cash_cumulative_ledger_v2`
- `20260918171000 finance_cash_counterparty_identity_v1`
- `20260918184500 finance_cash_stable_entity_identity_hold_629`

with `created_by = system-admin-release-reconciliation-629`.

After the metadata write every schema/function fingerprint and every ledger/control invariant above remained byte-for-byte / value-for-value unchanged.

## One-entity period presentation delta

The Admin period presentation is corrected independently of Finance payment semantics:

- RESOLVED operations group by `canonical_counterparty_id` only.
- A resolved entity is one period row even when it has multiple currencies.
- Currency values remain separate subtotals within the row.
- Unlike currencies are never added together.
- A `TO_VERIFY` operation does not receive a synthetic canonical ID and is kept separate by safe source-operation identity.

This presentation delta does **not** net reversals and does not calculate effective payments.

## Effective payment integration

Finance handoff `5733339302` and System Admin acceptance `5733354652` supersede the earlier hold.

Production Finance contract is verified as:

- `effectivePaymentVersion = FINANCE_EFFECTIVE_PAYMENT_V1`;
- operation fields:
  - `raw_operation_type`
  - `gross_amount`
  - `reversed_amount`
  - `effective_external_payment_amount`
  - `effective_payment_status`
  - `matched_original_operation_fingerprint`
  - `matched_original_operation_ref`
  - `matched_reversal_operation_refs`
  - `reversal_pair_status`
  - `reversal_pair_evidence`
- period/day fields:
  - `gross_external_payment`
  - `matched_external_payment_reversal`
  - `effective_external_payment`
  - `effective_external_payment_operation_count`
  - `reversal_pair_unresolved_count`
  - `effective_payment_unresolved_count`
  - cumulative effective/reversal fields;
- controls:
  - `reversal_count`
  - `matched_reversal_count`
  - `unresolved_reversal_count`.

The release baseline also contains the exact Finance artifact:

- `supabase/migrations/20260918195000_finance_cash_reversal_effective_payment_v1.sql`
- `tests/admin-cash-source-projection/reversal-effective-payment-v1.test.mjs`
- `tests/admin-cash-source-projection/reversal-effective-payment-production-regression.sql`.

Production originally recorded the managed apply as migration version
`20260918165540 / finance_cash_reversal_effective_payment_v1`.

The repository artifact is timestamped `20260918195000`. The historical
`20260918165540` record was preserved unchanged. To prevent the repository
migration from replaying already-active DDL, a metadata-only reconciliation
record was added for `20260918195000` with
`created_by=system-admin-release-reconciliation-629`.

Before and after that metadata reconciliation the effective-object hashes were unchanged:

- reversal pairs view: `4ccf57be0b55a9193aa6dfff39a18fe5`;
- effective operations view: `27f4e72c918d289af8c65ed090ad3665`;
- effective daily view: `a42a44f2caf8ae742103836ce49efb5e`;
- payload v1 function: `431183985411849de43a7fe58d55ef8f`.

## Admin consumption

Admin Cash now consumes Finance semantics directly:

- KPI `Оплачено` reads `periodSummary[].effective_external_payment`;
- period `Оплаты контрагентам` includes only operations with a positive
  `effective_external_payment_amount` and sums that field;
- no reversal matching or netting is recreated in frontend;
- fully reversed attempts remain available in Finance/raw audit data but do not
  increase effective paid;
- raw `Сторно / возвраты` remains a separate section;
- resolved counterparties group by canonical entity only;
- multi-currency entities render separate currency subtotals inside one row;
- `TO_VERIFY` rows remain safely separated by source-operation identity;
- if Finance reports unresolved reversal/effective-payment controls, Cash fails closed.

Production Finance acceptance values used for regression:

- ORIENT: 25,444,800 KZT effective principal / 1 effective operation;
- SG-TRANS: 5,899,358.90 RUB effective principal / 1 effective operation;
- BAKAI: 20,000 KZT and 18,000 RUB effective fees in one entity row;
- KUZMASH: 28,524,960 RUB / 4 effective operations;
- raw reversals: 6 matched / 0 unresolved.
