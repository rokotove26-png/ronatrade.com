# Payments V7 — Finance-authoritative settlement funding allocation

Status: candidate / exact-head QA required. Finance records, Finance V2, bank facts, actual settlement and the main Payments board remain unchanged.

## Source contract

Payments consumes only a structured Finance `BUSINESS_CHANGE_PROPOSAL` whose `proposed_action` is `MATERIALIZE_TO_PAYMENTS_PROJECTION`, whose `proposed_value.finance_conclusion_id` resolves to a current approved Finance `FUNCTIONAL_CONCLUSION`, and which has an Operations `APPROVE_FOR_NEXT_STAGE` decision.

The proposal must provide exact `allocations`, `funding_currency`, `conversion_events`, `actual_rates`, `calculation_method=ACTUAL_SETTLEMENT_DIV_ACTUAL_BANK_FX`, and `authority_status=CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS`. Payments copies those values. It does not derive them.

Before materialization, every settlement payment must already be an active `BANK_CONFIRMED` / Finance-verified bank fact with one current source-locked exact Finance attribution to the target Deal. The referenced funding conversion event must already be an accepted Finance funding-side debit in the same funding currency and acquired settlement currency.

## Payments-side materialization

`portal_private.materialize_payment_passport_finance_allocations_v7` writes only the append-only Payments projection table `payment_passport_finance_allocations_v7`. The migration backfills already-approved structured proposals generically; it contains no Deal IDs, payment IDs, Finance conclusion IDs, expected amounts or reverse-FX formulas.

`payment_passport_finance_allocations_current_v7` exposes the latest authoritative row per Deal/payment to the existing read-only Payments reader role.

Projection version:

`ADMIN_PAYMENTS_V7_PROJECTION_FINANCE_SETTLEMENT_ALLOCATION_V1`

## Projection behavior

The server projection enriches only Payment Passport settlement rows with:

- `allocated_funding_amount`;
- `funding_currency`;
- `funding_allocation_status=AUTHORITATIVE`;
- Finance conclusion/proposal/approval provenance;
- exact conversion event, actual rate and calculation method supplied by Finance.

Settlement `amount`, `currency`, status and bank facts are not changed. `actual_spend`, `remaining_execution`, Finance V2 semantics and main Payments aggregates are not changed.

The Owner-table UI already consumes `allocated_funding_amount` for the middle column and preserves the actual bank settlement independently. No browser FX calculation is introduced.
