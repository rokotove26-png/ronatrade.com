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

## Effective payment hold

System Admin comment `5733149859` requires Finance-owned source-locked reversal matching and effective-payment fields.

As of this reconciliation there is no newer Finance handoff comment in issue #629 and the production Finance projection exposes gross `external_payment`, but no effective-payment/status/reversal-match fields.

Therefore:

- KPI `Оплачено` remains unchanged for now;
- `Оплаты контрагентам` remains on the existing Finance gross field for now;
- no reversal netting is implemented in frontend;
- the separate raw `Сторно / возвраты` audit section remains.

The effective-payment UI delta must be implemented only after Finance posts a new handoff after comment `5733149859` and the exact effective fields are verified in the production Finance contract.
