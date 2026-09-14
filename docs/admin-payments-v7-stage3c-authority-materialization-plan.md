# Admin Payments V7 — Stage 3C authority materialization plan

Status: `PLAN_ONLY / NO_PRODUCTION_WRITE`.

Stage 3D addendum: the Owner high-level truth for PAYEV-2026-000008/000009 is now source-addressable as `OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION`, captured in `docs/admin-payments-v7-stage3d-owner-source-record.md` by commit `84eb1d04f9a00145ce603ca1612cb3c35a935831`. This supersedes the prior `OWNER_FACT_REQUIRED` blocker only for the high-level non-exact business assertion. It does **not** establish any exact Deal/amount split.

This is the exact source-lock manifest for future normalized V7 authority persistence. It is not a migration execution record and it does not authorize production DDL, DML, deployment, UI work, or lifecycle changes.

## Governing rules

1. Business truth is field-specific and follows current/effective authority, explicit supersession and source-lock before materialization.
2. `owner_deal_finance_summary` is not copied mechanically. Newer Finance/Owner authority controls any superseded field.
3. Existing active VERIFIED `PAYMENT_ALLOCATION` remains authoritative client-receipt attribution and does not require a duplicate V7 attribution row.
4. Shared scope is not an exact split. Arithmetic/proportional/residual allocation is prohibited.
5. FX conversion facts do not establish a Deal resource chain by themselves.
6. `TO_VERIFY` is a valid current output. Missing documentary/attribution/resource-chain truth is never inferred.
7. A source-locked `SCOPE_ONLY` authority may express known high-level business truth without a fake Deal only when it has a known Deal scope, a non-empty authoritative `business_scope_refs`, or (for an associated fee) an authoritative `principal_payment_key`. Such authority always has `lines_snapshot=[]` and cannot feed exact Deal spend.

## Finance authority manifest

The proposed normalized rows below are the only Finance rows classified `materializable=YES` for the Stage-3C/3D preview.

| Entity | Field | Proposed current value | Source authority | Current / supersession basis | Provenance | Materializable | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEAL-2026-004 | obligation/accounting currency | USD | Finance canon v23 `eabba23f-70b9-4d40-86ef-3d0578c71d4a` | v23 supersedes v22 only where the Owner currency rule changed; v23 explicitly retains 004 in USD because authoritative inbound receipt is USD | `PAYEV-2026-000001` + current VERIFIED allocation; Finance v23 | YES | — |
| DEAL-2026-004 | total_to_receive | 236250 USD | Finance conclusion v22 `7737fdb2-ec00-47e1-b3e9-a45823ab6fd5` economic field, unchanged by v23 currency delta | field-specific value is not contradicted by v23; v23 preserves 004 current USD semantics | Finance v22 summary + v23 current currency rule | YES | — |
| DEAL-2026-004 | due_now | 0 USD | same | current Finance schedule/canon states no due remainder after full receipt | Finance v22 + current receipt | YES | — |
| DEAL-2026-004 | expected_not_due | 0 USD | same | no remaining client obligation after verified receipt equals total | Finance v22 + current receipt | YES | — |
| DEAL-2026-004 | future_conditional | 0 USD | same | no remaining conditional bucket | Finance v22 | YES | — |
| DEAL-2026-004 | finance_status | PAID | Finance conclusion `0c9953cd-da6a-45f4-9764-1e7fa71aba8f`, reinforced by current verified receipt/allocation | no later source contradicts the Finance PAID field | current bank fact + VERIFIED allocation | YES | — |
| DEAL-2026-004 | documentary_status | TO_VERIFY | no current source-lock proving a stronger normalized documentary status | fail closed | absence of current field authority | YES | field is intentionally `TO_VERIFY` |
| DEAL-2026-005 | obligation/accounting currency | USD | Finance v23 `eabba23f-70b9-4d40-86ef-3d0578c71d4a` | v23 explicitly retains 005 USD from inbound receipt | `PAYEV-2026-000002` + VERIFIED allocation | YES | — |
| DEAL-2026-005 | total_to_receive | 672500 USD | Finance payment-schedule conclusion `6d1cac49-e5b6-49f6-8282-9bc37f6e8e97` | current dedicated schedule; no newer contradiction | current invoice/addendum refs embedded in Finance conclusion | YES | — |
| DEAL-2026-005 | due_now | 0 USD | `6d1cac49-e5b6-49f6-8282-9bc37f6e8e97` | current GU trigger not authoritative | same | YES | — |
| DEAL-2026-005 | expected_not_due | 470750 USD | `6d1cac49-e5b6-49f6-8282-9bc37f6e8e97` | 70% remains deferred/not due until authoritative GU trigger | same | YES | — |
| DEAL-2026-005 | future_conditional | 0 USD | current Finance schedule has the remaining 470750 entirely in deferred/not-due bucket | no separate additional future bucket source-locked | same | YES | — |
| DEAL-2026-005 | finance_status | NOT_DUE | `6d1cac49-e5b6-49f6-8282-9bc37f6e8e97` | derived directly from current schedule state, not UI arithmetic | same | YES | — |
| DEAL-2026-005 | documentary_status | TO_VERIFY | no stronger current normalized documentary field authority | fail closed | current schedule evidence does not establish a separate normalized documentary status | YES | field intentionally `TO_VERIFY` |
| DEAL-2026-006 | obligation/accounting currency | USD | Finance v23 `eabba23f-70b9-4d40-86ef-3d0578c71d4a` | v23 explicitly retains 006 USD from inbound receipt | `PAYEV-2026-000003` + VERIFIED allocation | YES | — |
| DEAL-2026-006 | total_to_receive | 164400 USD | Finance payment-schedule conclusion `e72308be-3b07-4033-812a-329db4682404` | current dedicated schedule | current invoice/addendum refs embedded in Finance conclusion | YES | — |
| DEAL-2026-006 | due_now | 0 USD | `e72308be-3b07-4033-812a-329db4682404` | current GU trigger not authoritative | same | YES | — |
| DEAL-2026-006 | expected_not_due | 115080 USD | `e72308be-3b07-4033-812a-329db4682404` | 70% remains deferred/not due | same | YES | — |
| DEAL-2026-006 | future_conditional | 0 USD | current Finance schedule has the remaining 115080 entirely in deferred/not-due bucket | no separate additional future bucket source-locked | same | YES | — |
| DEAL-2026-006 | finance_status | NOT_DUE | `e72308be-3b07-4033-812a-329db4682404` | current schedule state | same | YES | — |
| DEAL-2026-006 | documentary_status | TO_VERIFY | no stronger current normalized documentary field authority | fail closed | current schedule evidence does not establish a separate normalized documentary status | YES | field intentionally `TO_VERIFY` |
| DEAL-2026-009 | obligation/accounting/payment currency | RUB | direct Stage-3C Owner command + Finance canon v23 `eabba23f-70b9-4d40-86ef-3d0578c71d4a` | v23 supersedes the old universal-USD Owner view and explicitly establishes GazOne RUB accounting | `OWNER_CONFIRMATION_2026-09-13_GAZONE_RUB_ACCOUNTING`; v23 | YES | — |
| DEAL-2026-009 | total_to_receive | 31002300 RUB | direct Stage-3C Owner command + Finance v23 | current RUB basis; old 362600 USD is historical provenance only | v23 mandatory conditions; proposal `49205d6f-4b63-473e-b596-5813ddeb966a` as schema/provenance support | YES | — |
| DEAL-2026-009 | due_now | 0 RUB | direct Stage-3C Owner command; Finance current proposal `49205d6f-4b63-473e-b596-5813ddeb966a` | current payment is not due | same | YES | — |
| DEAL-2026-009 | expected_not_due | 9300690 RUB | direct Stage-3C Owner command + Finance v23 | current next expected 30% | v23 + `49205d6f-4b63-473e-b596-5813ddeb966a` | YES | — |
| DEAL-2026-009 | future_conditional | 21701610 RUB | direct Stage-3C Owner command + Finance v23 | nominal future 70% remains conditional | v23 + corrected schema proposal `49205d6f-4b63-473e-b596-5813ddeb966a` | YES | — |
| DEAL-2026-009 | finance_status | NOT_DUE | direct Stage-3C Owner command + current Finance proposal | current bucket state | same | YES | — |
| DEAL-2026-009 | documentary_status | TO_VERIFY | Finance v23/current proposal | latest RUB document remains not source-locked as sent/confirmed | v23 + `49205d6f-4b63-473e-b596-5813ddeb966a` | YES | intentionally `TO_VERIFY` |

Historical GazOne values `362600 USD / 108780 USD / 253820 USD` are audit provenance only and are explicitly **not** materializable as current normalized Finance authority.

## Receipt/payment attribution manifest

| Payment/entity | Business truth known | Exact Deal attribution known | Proposed normalized representation | Source authority | Materializable | Blocker |
| --- | --- | --- | --- | --- | --- | --- |
| PAYEV-2026-000001 | yes | DEAL-2026-004 exact, 236250 USD | no duplicate V7 row | current active VERIFIED `PAYMENT_ALLOCATION`; Finance governance `81609307-26e7-4366-874f-b882df88656d` | NO — NOT_REQUIRED | existing field-specific authority already sufficient |
| PAYEV-2026-000002 | yes | DEAL-2026-005 exact, 201750 USD | no duplicate V7 row | current active VERIFIED `PAYMENT_ALLOCATION`; current Finance schedule | NO — NOT_REQUIRED | existing field-specific authority already sufficient |
| PAYEV-2026-000003 | yes | DEAL-2026-006 exact, 49320 USD | no duplicate V7 row | current active VERIFIED `PAYMENT_ALLOCATION`; current Finance schedule | NO — NOT_REQUIRED | existing field-specific authority already sufficient |
| OUT-2026-005006-KUZMASH | shared 005/006 business scope is known | **NO** exact split | retain existing `SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY`; do not create exact lines | current `owner_outgoing_payment_facts`: 16536960 RUB, deal_ids 005/006, `deal_allocation_status=TO_VERIFY`, BANK_CONFIRMED | NO — DUPLICATE_NOT_REQUIRED | exact split remains `TO_VERIFY`; no later/current superseding exact authority found |
| OUT-2026-005006-KUZMASH-FEE | associated 005/006 transaction scope known | **NO** exact fee split | retain associated fee/shared scope; no exact lines | current `owner_outgoing_payment_facts`: 3000 RUB fee, deal_ids 005/006, `TO_VERIFY` | NO — DUPLICATE_NOT_REQUIRED | exact fee attribution missing |
| PAYEV-2026-000008 | high-level business allocation fact is known | **NO** Deal/amount binding | `SCOPE_ONLY`; `classification=OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED`; `business_scope_refs=[OWNER_ASSERTION:PAYEV-2026-000008:BUSINESS_ALLOCATION_KNOWN]`; `scope_deal_keys=[]`; `lines_snapshot=[]` | `OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION`; source record commit `84eb1d04f9a00145ce603ca1612cb3c35a935831`; BANK_CONFIRMED `PAYEV-2026-000008` / BAKAI doc 2539516 | **YES — HIGH_LEVEL_ONLY** | exact Deal attribution remains `TO_VERIFY`; no fake Deal permitted |
| PAYEV-2026-000009 | fee is associated with PAYEV-2026-000008 | **NO** Deal/amount attribution | `SCOPE_ONLY`; `classification=ASSOCIATED_BANK_FEE`; `principal_payment_key=9fda9905-e782-42f3-8441-71ca866bee0d`; `scope_deal_keys=[]`; `lines_snapshot=[]` | same Owner source ref; BANK_CONFIRMED `PAYEV-2026-000009` / BAKAI doc 2539518 | **YES — HIGH_LEVEL_ONLY** | exact fee Deal attribution remains `TO_VERIFY`; no proportional split |

The Stage-1 audit markdown is not a runtime authority. The Stage-3D Owner source record above is the current source-addressable basis for only the high-level 000008/000009 assertions. Exact Deal attribution still requires a later source-lock.

## Resource-chain manifest

| Scope | Proposed value | Materializable | Blocker |
| --- | --- | --- | --- |
| DEAL-2026-004 cross-currency outgoings | no `payment_resource_chains_v7` row | NO | `EXACT_RESOURCE_CHAIN_REQUIRED`; known RUB/KZT bank outgoings and FX facts do not prove the exact USD resource chain for each Deal spend |
| DEAL-2026-005 / 006 KUZMASH | no resource-chain row | NO | exact per-Deal outgoing attribution is already missing; no resource chain can be asserted before attribution |
| PAYEV-2026-000006 / 000007 FX legs | keep as FX conversion facts only | NO | conversion rate/equivalent/reference proves conversion event, not Deal-resource linkage |
| DEAL-2026-009 | no resource-chain row | NO | no exact Deal-attributed BANK_CONFIRMED spend/resource chain |

Accordingly `actual_spend` remains `TO_VERIFY` wherever a cross-currency attributed spend lacks exact Bank/Treasury resource-chain authority. No current/CBR/market/contractual rate may fill that gap.

## Materialization preview input

The Stage-3D QA preview uses only:

- existing authoritative bank facts and active VERIFIED receipt allocations;
- current shared 005/006 outgoing scope exactly as stored (`TO_VERIFY`, no split);
- the four Finance authority rows marked `YES` above;
- the two high-level, non-exact 000008/000009 rows described above;
- zero proposed resource-chain rows;
- zero proposed exact payment-attribution rows for 000008/000009 or 005/006.

Acceptance snapshot is calculated by the canonical projection, not stored as constants in runtime logic:

| Deal | Total | Verified received | Expected/not due | Future conditional | Calculated progress |
| --- | ---: | ---: | ---: | ---: | ---: |
| DEAL-2026-004 | 236250 USD | 236250 USD | 0 | 0 | 100% |
| DEAL-2026-005 | 672500 USD | 201750 USD | 470750 USD | 0 | 30% |
| DEAL-2026-006 | 164400 USD | 49320 USD | 115080 USD | 0 | 30% |
| DEAL-2026-009 | 31002300 RUB | 0 RUB | 9300690 RUB | 21701610 RUB | 0% |

## Remaining blockers before production materialization

1. Production DDL is still HOLD; normalized relations are not present in production.
2. Production business-data mutation is still HOLD; the four Finance rows and two high-level 000008/000009 rows have not been written.
3. OUT-2026-005006-KUZMASH principal and fee remain shared-scope `TO_VERIFY`; no exact split may be materialized.
4. PAYEV-2026-000008/000009 exact Deal attribution remains `TO_VERIFY`; the high-level rows must never be promoted to exact lines without new source evidence.
5. No exact Deal resource-chain authority is available for the cross-currency spend gaps.
6. Documentary status stronger than `TO_VERIFY` is not materialized where a current source does not prove it.

Gates remain `PRODUCTION_DDL=HOLD`, `PRODUCTION_BUSINESS_DATA_MUTATION=HOLD`, `PRODUCTION_DEPLOY=HOLD`, `UI_IMPLEMENTATION=HOLD`, `MERGE=HOLD`.
