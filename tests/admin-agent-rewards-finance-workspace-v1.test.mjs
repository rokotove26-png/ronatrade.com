import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const baseline=readFileSync('supabase/migrations/20261005200500_admin_agent_rewards_finance_workspace_v1.sql','utf8');
const pnl=readFileSync('supabase/migrations/20261006023000_admin_agent_rewards_pnl_v3.sql','utf8');
const activeScope=readFileSync('supabase/migrations/20261006054500_admin_agent_rewards_active_scope_v4.sql','utf8');
const approvedPlan=readFileSync('supabase/migrations/20261006151000_admin_agent_rewards_plan_authority_v5.sql','utf8');
const transportBreakdown=readFileSync('supabase/migrations/20261006172500_admin_agent_rewards_transport_breakdown_v6.sql','utf8');
const ownerCorrections=readFileSync('supabase/migrations/20261006181500_admin_agent_rewards_owner_correction_v7.sql','utf8');
const accrualFact=readFileSync('supabase/migrations/20261006190000_admin_agent_rewards_accrual_fact_v8.sql','utf8');
const cashFact=readFileSync('supabase/migrations/20261006192500_admin_agent_rewards_cash_fact_compact_v9.sql','utf8');
const cashPaymentLines=readFileSync('supabase/migrations/20261006194000_admin_agent_rewards_cash_payment_lines_v10.sql','utf8');
const ownerMirror=readFileSync('supabase/migrations/20261006210500_admin_agent_rewards_owner_mirror_dds_v11.sql','utf8');
const ownerMirrorHotfix=readFileSync('supabase/migrations/20261006213200_admin_agent_rewards_jsonb_object_length_hotfix_v12.sql','utf8');
const itemizedOwner=readFileSync('supabase/migrations/20261006214500_admin_agent_rewards_itemized_owner_corrections_v13.sql','utf8');
const ui=readFileSync('functions/portal/agent-rewards-v1-ui.js','utf8');
const ownerApi=readFileSync('functions/portal/owner-api.js','utf8');
const shell=readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
const remaining=readFileSync('functions/portal/remaining-sections-ui.js','utf8');
const adminHtml=readFileSync('portal-src/current/admin.html','utf8');
const watchdog=readFileSync('assets/portal-admin-runtime-watchdog-v1.js','utf8');
const materializer=readFileSync('scripts/materialize-admin-current-modules.mjs','utf8');
const retiredLegacy=readFileSync('functions/portal/owner-ui-chunks/chunk18-base.js','utf8');

test('Baseline Agent Rewards stays source-locked and Finance-authoritative',()=>{
  assert.match(baseline,/rona_admin_agent_rewards_workspace_v1/);
  assert.match(baseline,/owner_r1_actor\('ADMIN'\)/);
  assert.match(baseline,/deal_finance_authority_payments_v8_read_v1/);
  assert.match(baseline,/payment_resource_chains_effective_v8/);
  assert.match(baseline,/agent_reward_owner_corrections_v1/);
  assert.doesNotMatch(baseline,/update\s+portal_private\.deal_finance_authority/i);
  assert.doesNotMatch(baseline,/update\s+portal_private\.payments/i);
});

test('P&L V3 projects three-column plan/fact/owner without creating business facts',()=>{
  assert.match(pnl,/rona_admin_agent_rewards_workspace_v2/);
  assert.match(pnl,/ADMIN_AGENT_REWARDS_PNL_V3/);
  assert.match(pnl,/THREE_COLUMN_PLAN_FACT_OWNER/);
  assert.match(pnl,/FINANCE_AUTHORITY_TOTAL_TO_RECEIVE/);
  assert.match(pnl,/OWNER_PAYMENT_EXPECTATION/);
  assert.match(pnl,/DEAL_APPLICATION_PARAMETERS|CLIENT_APPLICATION_ACCEPTED/);
  assert.match(pnl,/TO_VERIFY_PLAN_COST_SOURCE/);
  assert.match(pnl,/'taxesAndPaymentsStatus','TO_VERIFY'/);
  assert.match(pnl,/REVENUE','OPERATING_EXPENSES','FINANCIAL_RESULT','TAXES_AND_PAYMENTS'/);
  assert.match(pnl,/NET_PROFIT','AGENT_REWARD','RONA_PROFIT/);
  assert.match(pnl,/factInputs/);
  assert.match(pnl,/cashReceived/);
  assert.doesNotMatch(pnl,/insert\s+into\s+portal_private\.deal_finance_authority/i);
  assert.doesNotMatch(pnl,/update\s+portal_private\.deal_finance_authority/i);
});

test('P&L V4 active scope excludes cancelled deals without hiding non-cancelled settlement history',()=>{
  assert.match(activeScope,/rona_admin_agent_rewards_workspace_v3/);
  assert.match(activeScope,/business_status::text <> 'CANCELLED'/);
  assert.match(activeScope,/lifecycle_state::text not in \('ARCHIVED','SUPERSEDED'\)/);
  assert.match(activeScope,/ADMIN_AGENT_REWARDS_PNL_V4/);
  assert.match(activeScope,/NON_CANCELLED_CURRENT/);
  assert.doesNotMatch(activeScope,/update\s+portal_private\.deals/i);
  assert.doesNotMatch(activeScope,/delete\s+from\s+portal_private\.deals/i);
});

test('Approved PLAN projection requires Finance proposal plus matching Operations approval and stays read-only',()=>{
  assert.match(approvedPlan,/rona_admin_agent_rewards_workspace_v4/);
  assert.match(approvedPlan,/management_plan_financial_basis/);
  assert.match(approvedPlan,/MATERIALIZE_AGENT_REWARDS_PLAN/);
  assert.match(approvedPlan,/OPERATIONS_INTERNAL_DECISION/);
  assert.match(approvedPlan,/APPROVE_FOR_NEXT_STAGE/);
  assert.match(approvedPlan,/o\.payload->>'record_id'=p\.record_id::text/);
  assert.match(approvedPlan,/Закупочная стоимость товара/);
  assert.match(approvedPlan,/Транспортировка/);
  assert.match(approvedPlan,/EXACTLY_TWO_LINES_PURCHASE_PLUS_TRANSPORT/);
  assert.match(approvedPlan,/NOT_APPLICABLE_IN_PLAN/);
  assert.match(approvedPlan,/APPROVED_FINANCE_MANAGEMENT_PLAN/);
  assert.match(approvedPlan,/READ_ONLY_PROJECTION/);
  assert.doesNotMatch(approvedPlan,/insert\s+into\s+portal_private\.deal_finance_authority/i);
  assert.doesNotMatch(approvedPlan,/update\s+portal_private\.(payments|deal_finance_authority|agent_settlements)/i);
  assert.doesNotMatch(approvedPlan,/delete\s+from\s+portal_private/i);
});

test('PLAN transport breakdown requires Rail proposal plus Operations approval and preserves Finance total',()=>{
  assert.match(transportBreakdown,/rona_admin_agent_rewards_workspace_v5/);
  assert.match(transportBreakdown,/management_plan_transport_breakdown/);
  assert.match(transportBreakdown,/MATERIALIZE_AGENT_REWARDS_PLAN_TRANSPORT_BREAKDOWN/);
  assert.match(transportBreakdown,/functional_role::text='RAIL_LOGISTICS'/);
  assert.match(transportBreakdown,/OPERATIONS_INTERNAL_DECISION/);
  assert.match(transportBreakdown,/APPROVE_FOR_NEXT_STAGE/);
  assert.match(transportBreakdown,/o\.payload->>'record_id'=p\.record_id::text/);
  assert.match(transportBreakdown,/transportBreakdown/);
  assert.match(transportBreakdown,/APPROVED_BREAKDOWN_WITH_TARIFF_CONFLICT/);
  assert.match(transportBreakdown,/APPROVED_BREAKDOWN_WITH_TO_VERIFY/);
  assert.match(transportBreakdown,/FINANCE_APPROVED_PLAN_TOTAL_UNCHANGED/);
  assert.match(transportBreakdown,/VISIBLE_FAIL_CLOSED_NO_AUTO_RECONCILIATION/);
  assert.doesNotMatch(transportBreakdown,/insert\s+into\s+portal_private/i);
  assert.doesNotMatch(transportBreakdown,/update\s+portal_private/i);
  assert.doesNotMatch(transportBreakdown,/delete\s+from\s+portal_private/i);
});

test('FACT FX v7 uses approved realized economic effect and never synthetic conversion residual',()=>{
  assert.match(ownerCorrections,/rona_admin_agent_rewards_workspace_v6/);
  assert.match(ownerCorrections,/agent_rewards\.fact\.realized_fx_economic_effect/);
  assert.match(ownerCorrections,/MATERIALIZE_AGENT_REWARDS_FACT_FX_ECONOMIC_SIGN/);
  assert.match(ownerCorrections,/APPROVE_FOR_NEXT_STAGE/);
  assert.match(ownerCorrections,/POSITIVE_IS_ECONOMIC_BENEFIT__NEGATIVE_IS_ECONOMIC_LOSS/);
  assert.match(ownerCorrections,/unusedConvertedBalanceIsRealizedFx',false/);
  assert.match(ownerCorrections,/legacyResidualFxSuppressed',true/);
  assert.match(ownerCorrections,/APPROVED_REALIZED_FX_ECONOMIC_EFFECT/);
  assert.match(ownerCorrections,/AUTHORITATIVE_RESOURCE_CHAIN_CONSUMPTION_V6/);
  assert.doesNotMatch(ownerCorrections,/update\s+portal_private\.(payments|deal_finance_authority)/i);
});

test('Owner correction V4 is immutable and accepts only exact expense-line overrides plus FX',()=>{
  assert.match(ownerCorrections,/rona_admin_agent_rewards_correct_v4/);
  assert.match(ownerCorrections,/v_key not in \('expenseLines','fxDifference'\)/);
  assert.match(ownerCorrections,/payment_kind::text='COUNTERPARTY_PAYMENT'/);
  assert.match(ownerCorrections,/CORRECTION_EXPENSE_LINE_NOT_ALLOWED/);
  assert.match(ownerCorrections,/agent_reward_owner_corrections_v1/);
  assert.match(ownerCorrections,/correction_version/);
  assert.match(ownerCorrections,/idempotency_key/);
  assert.doesNotMatch(ownerCorrections,/update\s+portal_private\.deal_finance_authority/i);
  assert.doesNotMatch(ownerCorrections,/update\s+portal_private\.payments/i);
});

test('Operational accrual FACT v8 requires Finance proposal plus Operations approval and separates cash from P&L',()=>{
  assert.match(accrualFact,/rona_admin_agent_rewards_workspace_v7/);
  assert.match(accrualFact,/agent_rewards\.fact\.accrual_basis_v1/);
  assert.match(accrualFact,/MATERIALIZE_AGENT_REWARDS_ACCRUAL_FACT/);
  assert.match(accrualFact,/functional_role::text='FINANCE'/);
  assert.match(accrualFact,/OPERATIONS_INTERNAL_DECISION/);
  assert.match(accrualFact,/APPROVE_FOR_NEXT_STAGE/);
  assert.match(accrualFact,/o\.payload->>'record_id'=p\.record_id::text/);
  assert.match(accrualFact,/APPROVED_OPERATIONAL_ACCRUAL_FACT/);
  assert.match(accrualFact,/OPERATIONAL_ACCRUAL_NOT_CASH/);
  assert.match(accrualFact,/SEPARATE_SETTLEMENT_LAYER/);
  assert.match(accrualFact,/ACCRUED_VS_SETTLED_BALANCE/);
  assert.match(accrualFact,/NO_PERFORMANCE_AUTHORITY__NO_FACT_PNL/);
  assert.match(accrualFact,/TO_VERIFY_NO_AUTHORITATIVE_PERFORMANCE_FACT/);
  assert.match(accrualFact,/settlementPositions/);
  assert.match(accrualFact,/conditionalPositions/);
  assert.match(accrualFact,/ownerCorrectionLegacy/);
  assert.doesNotMatch(accrualFact,/update\s+portal_private\.(payments|deal_finance_authority|shipments)/i);
  assert.doesNotMatch(accrualFact,/delete\s+from\s+portal_private/i);
});

test('Owner correction V5 is gated by approved accrual FACT and only accepts accrued expense keys plus FX',()=>{
  assert.match(accrualFact,/rona_admin_agent_rewards_correct_v5/);
  assert.match(accrualFact,/OWNER_CORRECTION_REQUIRES_APPROVED_OPERATIONAL_FACT/);
  assert.match(accrualFact,/v_key not in \('expenseLines','fxDifference'\)/);
  assert.match(accrualFact,/jsonb_array_elements\(coalesce\(v_accrual_value->'expense_lines'/);
  assert.match(accrualFact,/where e->>'key'=v_key/);
  assert.match(accrualFact,/CORRECTION_EXPENSE_LINE_NOT_ALLOWED/);
  assert.match(accrualFact,/APPROVED_ACCRUAL_EXPENSE_LINES_PLUS_FX_ONLY/);
  assert.match(accrualFact,/agent_reward_owner_corrections_v1/);
  assert.doesNotMatch(accrualFact,/update\s+portal_private\.payments/i);
  assert.doesNotMatch(accrualFact,/update\s+portal_private\.deal_finance_authority/i);
});

test('Compact FACT v9 is DDS-only and requires Finance plus Operations presentation authority',()=>{
  assert.match(cashFact,/rona_admin_agent_rewards_workspace_v8/);
  assert.match(cashFact,/agent_rewards\.fact\.presentation_semantics_v2/);
  assert.match(cashFact,/MATERIALIZE_AGENT_REWARDS_CASH_FACT_SEPARATE_AR_AP/);
  assert.match(cashFact,/fact_mode'='CASH_FLOW_DDS/);
  assert.match(cashFact,/OPERATIONS_INTERNAL_DECISION/);
  assert.match(cashFact,/APPROVE_FOR_NEXT_STAGE/);
  assert.match(cashFact,/o\.payload->>'record_id'=p\.record_id::text/);
  assert.match(cashFact,/cashReceived/);
  assert.match(cashFact,/counterpartyCashOut/);
  assert.match(cashFact,/bankFees/);
  assert.match(cashFact,/netCashFlow/);
  assert.match(cashFact,/DDS_ONLY__CASH_IS_NOT_ACCRUAL_REVENUE/);
  assert.match(cashFact,/AR_AP_ADVANCES_OUTSIDE_FACT/);
  assert.match(cashFact,/SEPARATE_COMPACT_AR_AP_ADVANCE_BLOCK/);
  assert.doesNotMatch(cashFact,/update\s+portal_private\.(payments|deal_finance_authority|shipments)/i);
  assert.doesNotMatch(cashFact,/delete\s+from\s+portal_private/i);
});

test('DDS FACT v10 exposes source-locked counterparty payment lines without changing the approved cash total',()=>{
  assert.match(cashPaymentLines,/rona_admin_agent_rewards_workspace_v9/);
  assert.match(cashPaymentLines,/cashPaymentLines/);
  assert.match(cashPaymentLines,/COUNTERPARTY_PAYMENT_ONLY/);
  assert.match(cashPaymentLines,/SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN/);
  assert.match(cashPaymentLines,/cashFlow\.counterpartyCashOut/);
  assert.match(cashPaymentLines,/UI_GROUP_BY_PAYMENT_ID_AND_COUNTERPARTY/);
  assert.match(cashPaymentLines,/bankFeesRemainSeparate',true/);
  assert.match(cashPaymentLines,/READ_ONLY_PROJECTION/);
  assert.doesNotMatch(cashPaymentLines,/update\s+portal_private/i);
  assert.doesNotMatch(cashPaymentLines,/delete\s+from\s+portal_private/i);
});

test('Owner mirror v11 requires Finance plus Operations bridge and never re-adds FX to result',()=>{
  assert.match(ownerMirror,/rona_admin_agent_rewards_workspace_v10/);
  assert.match(ownerMirror,/agent_rewards\.owner\.actual_result_bridge_v1/);
  assert.match(ownerMirror,/MATERIALIZE_OWNER_MIRROR_DDS_PLUS_OPEN_SETTLEMENTS/);
  assert.match(ownerMirror,/APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE/);
  assert.match(ownerMirror,/MIRROR_FACT_DDS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT/);
  assert.match(ownerMirror,/NET_CASH_FLOW_PLUS_OPEN_SETTLEMENT_ADJUSTMENT/);
  assert.match(ownerMirror,/REFERENCE_ONLY__DO_NOT_ADD_TO_RESULT/);
  assert.match(ownerMirror,/ownerCorrectionLegacy/);
  assert.match(ownerMirror,/OPEN_SETTLEMENT_ADJUSTMENT_ONLY/);
  assert.match(ownerMirrorHotfix,/rona_admin_agent_rewards_workspace_v10/);
  assert.match(ownerMirrorHotfix,/rona_admin_agent_rewards_correct_v6/);
  assert.doesNotMatch(ownerMirrorHotfix,/jsonb_object_length/);
  assert.match(ownerMirrorHotfix,/jsonb_build_object\('openSettlementAdjustment'/);

  assert.doesNotMatch(ownerMirror,/update\s+portal_private\.(payments|deal_finance_authority|shipments)/i);
  assert.doesNotMatch(ownerMirror,/delete\s+from\s+portal_private/i);
});

test('Owner correction v6 accepts only aggregate open-settlement adjustment',()=>{
  assert.match(ownerMirror,/rona_admin_agent_rewards_correct_v6/);
  assert.match(ownerMirror,/CORRECTION_CONTRACT_OPEN_SETTLEMENT_ONLY/);
  assert.match(ownerMirror,/openSettlementAdjustment/);
  assert.match(ownerMirror,/OWNER_CORRECTION_REQUIRES_APPROVED_RESULT_BRIDGE/);
  assert.match(ownerMirror,/agent_reward_owner_corrections_v1/);
  assert.doesNotMatch(ownerMirror,/expenseLines','fxDifference/);
  assert.doesNotMatch(ownerMirror,/update\s+portal_private\.payments/i);
});

test('Owner correction v13 allows only source-locked payment-line overlays plus open settlements',()=>{
  assert.match(itemizedOwner,/rona_admin_agent_rewards_workspace_v11/);
  assert.match(itemizedOwner,/rona_admin_agent_rewards_correct_v7/);
  assert.match(itemizedOwner,/PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT/);
  assert.match(itemizedOwner,/agent_rewards\.owner\.correction_contract_v2/);
  assert.match(itemizedOwner,/ALLOW_SOURCE_LOCKED_PAYMENT_LINE_OVERLAYS_PLUS_OPEN_SETTLEMENT/);
  assert.match(itemizedOwner,/PAYMENT_LINE_NOT_SOURCE_LOCKED/);
  assert.match(itemizedOwner,/SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN/);
  assert.match(itemizedOwner,/round\(v_line_numeric,1\)/);
  assert.match(itemizedOwner,/round\(\(v_open_value#>>'\{\}'\)::numeric,1\)/);
  assert.match(itemizedOwner,/FACT_TOTAL_PLUS_SUM_OWNER_LINE_DELTAS/);
  assert.match(itemizedOwner,/REFERENCE_ONLY__DO_NOT_ADD_TO_RESULT/);
  assert.doesNotMatch(itemizedOwner,/update\s+portal_private\.(payments|deal_finance_authority|shipments)/i);
  assert.doesNotMatch(itemizedOwner,/delete\s+from\s+portal_private/i);
});

test('Agent reward remains fail-closed without a calculable confirmed basis',()=>{
  assert.match(baseline,/TERM_MISSING/);
  assert.match(baseline,/CALCULATION_BASIS_REQUIRED/);
  assert.match(baseline,/SETTLEMENT_AUTHORITY/);
  assert.match(baseline,/FIXED_TERM/);
  assert.match(ui,/PER_TONNE_TERM/);
  assert.match(ui,/CALCULATION_BASIS_REQUIRED/);
  assert.match(ui,/PERCENT_TERM_BASE_EXCLUDING_FX/);
  assert.match(ui,/CLOSING_CONDITIONS_REQUIRED/);
  assert.match(ui,/Math\.max\(0,basis\)\*num\(t\.rate\)/);
  assert.match(ui,/basisValue:financialResult/);
});

test('Agent Rewards runtime serialization ships its transform helper',()=>{
  assert.match(ui,/const SCRIPT='var __name=\(target,value\)=>target;/);
});

test('Dedicated UI is P&L-first with PLAN, FACT and OWNER CONTROL in owner-defined order',()=>{
  assert.match(ui,/20261007-agent-rewards-finance-v16-itemized-owner-corrections/);
  assert.match(ui,/1 · ПЛАН/);
  assert.match(ui,/2 · ФАКТ/);
  assert.match(ui,/3 · OWNER \/ АГЕНТ/);
  assert.match(ui,/Итого выручка/);
  assert.match(ui,/Расходы постатейно/);
  assert.match(ui,/Итого финансовый результат/);
  assert.match(ui,/Налоги и платежи/);
  assert.match(ui,/Курсовая разница/);
  assert.match(ui,/Итого чистая прибыль/);
  assert.match(ui,/Агентское вознаграждение/);
  assert.match(ui,/Итого прибыль RONA/);
  assert.match(ui,/Только реальные поступления и выплаты/);
  assert.match(ui,/Поступило/);
  assert.match(ui,/approvedReward!==null/);
  assert.match(ui,/taxStatus:p\.taxesAndPaymentsStatus/);
  assert.match(ui,/fxStatus:p\.fxStatus/);
  assert.match(ui,/Сохранить корректировку/);
  assert.match(ui,/Отправить агенту/);
  assert.match(ui,/send\.disabled=true/);
  assert.doesNotMatch(ui,/data-owner-expense-key/);
  assert.match(ui,/data-owner-payment-key/);
  assert.match(ui,/data-owner-key/);
  assert.match(ui,/paymentLineAmounts:m\.paymentLineAmounts/);
  assert.match(ui,/openSettlementAdjustment:m\.openSettlementAdjustment/);
  assert.doesNotMatch(ui,/rona-ar-kpis/);
  assert.match(adminHtml,/data-rona-agent-rewards-canonical-head="1"/);
  assert.match(adminHtml,/<h1 class="rona-visual-title">Вознаграждения агентов<\/h1>/);
  assert.match(adminHtml,/Агентская компания → клиент → сделка → подтверждённое право на выплату\./);
  assert.match(ui,/function ensureCanonicalLayout\(\)/);
  assert.match(ui,/data-rona-agent-rewards-host/);
  assert.match(ui,/state\.workspacePromise/);
  assert.match(ui,/Date\.now\(\)-state\.loadedAt<15000/);
  assert.doesNotMatch(ui,/p\.replaceChildren\(root\)/);
  assert.match(ui,/\.rona-ar-canonical-head \.rona-visual-title/);
  assert.match(ui,/font-size:clamp\(31px,3\.25vw,48px\)/);
  assert.match(ui,/Агентская компания → клиент → сделка → подтверждённое право на выплату\./);
  assert.doesNotMatch(ui,/rona-ar-title','Вознаграждения агентов/);
  assert.match(ui,/\.rona-ar-name\{font-size:12\.25px/);
  assert.match(ui,/\.rona-ar-value\{text-align:right;font-size:15\.25px/);
  assert.match(ui,/minmax\(230px,1fr\)/);
  assert.match(ui,/__RONA_AGENT_REWARDS_VISUAL__='digital-finance-v1'/);
  assert.match(ui,/data-rona-agent-rewards-visual|ronaAgentRewardsVisual/);
  assert.match(ui,/Digital finance · Agent rewards/);
  assert.match(ui,/ПРАВО НА ВЫПЛАТУ/);
  assert.match(ui,/function renderDealPulse\(root,deal\)/);
  assert.match(ui,/PLAN · выручка/);
  assert.match(ui,/PLAN · прибыль RONA/);
  assert.match(ui,/FACT · чистый ДДС/);
  assert.match(ui,/PLAN · агентское вознаграждение/);
  assert.match(ui,/\.rona-ar-flow\{/);
  assert.match(ui,/\.rona-ar-pulse\{/);
  assert.match(ui,/\.rona-ar-metric\{/);
  assert.match(ui,/linear-gradient\(rgba\(84,205,236,.045\) 1px,transparent 1px\)/);
  assert.match(ui,/function transportBreakdownView\(breakdown,status\)/);
  assert.match(ui,/Транспортировка · тарифный состав/);
  assert.match(ui,/Тарифное расхождение/);
  assert.match(ui,/transportBreakdown:p\.transportBreakdown/);
  assert.match(ui,/table\.append\(transportBreakdownView\(m\.transportBreakdown,m\.transportBreakdownStatus\)\)/);
  assert.match(ui,/\.rona-ar-transport\{/);
  assert.match(ui,/function balancesView\(deal\)/);
  assert.match(ui,/Незакрытые расчёты/);
  assert.match(ui,/Условные претензии и HOLD-позиции в ДЗ\/КЗ не включены/);
  assert.match(ui,/Чистый ДДС/);
  assert.doesNotMatch(ui,/actualFinancialResult[^\n]*\+[^\n]*realizedFxReference/);
  assert.match(ui,/managementReward\(deal,financialResult\)/);
  assert.match(ui,/ФАКТ ДДС → постатейные корректировки → фактический результат/);
  assert.match(ui,/корректировки TO_VERIFY/);
  assert.match(ui,/\.rona-ar-balances\{/);
  assert.match(ui,/function cashFactModel\(deal\)/);
  assert.match(ui,/function cashPaymentLinesModel\(deal,cur\)/);
  assert.match(ui,/Оплачено контрагентам/);
  assert.match(ui,/m\.paymentLines\.map/);
  assert.match(ui,/Подтверждённых выплат контрагентам нет/);
  assert.match(ui,/function ownerBridgeApproved\(deal\)/);
  assert.match(ui,/function ownerAgentReward\(deal,actualResult,fxReference\)/);
  assert.match(ui,/Незакрытые расчёты/);
  assert.match(ui,/Фактический финансовый результат/);
  assert.match(ui,/База агентского вознаграждения/);
  assert.match(ui,/Уже отражён в фактических платежах · повторно в результат не прибавляется/);
  assert.match(ui,/netCashFlow\+openSettlementAdjustment/);
  assert.match(ui,/basis=result-fx/);
  assert.match(ui,/actualFinancialResult-reward\.value/);
  assert.match(ui,/minimumFractionDigits:1,maximumFractionDigits:1/);
  assert.match(ui,/inp\.step='0\.1'/);
  assert.match(ui,/toFixed\(1\)/);
  assert.match(ui,/function ownerPaymentLines\(lines,enabled\)/);
  assert.match(ui,/fact\.counterpartyCashOut\+paymentDelta/);
  assert.match(ui,/fact\.cashReceived-counterpartyCashOut-fact\.bankFees/);


});

test('Owner API routes Agent Rewards to itemized Owner V11 read RPC and correction V7',()=>{
  assert.match(ownerApi,/\/admin\/agent-rewards-v1/);
  assert.match(ownerApi,/rona_admin_agent_rewards_workspace_v11/);
  assert.match(ownerApi,/rona_admin_agent_rewards_correct_v7/);
  assert.match(ownerApi,/p_assignment_id/);
  assert.match(ownerApi,/p_corrected_payload/);
  assert.match(ownerApi,/p_idempotency_key/);
});

test('Admin shell lazy-loads Agent Rewards P&L and legacy Remaining renderer stays retired',()=>{
  assert.match(shell,/agentRewards:\{src:'\/portal\/agent-rewards-v1-ui\?v=20261007-finance-workspace-v17-itemized-owner-corrections'/);
  assert.match(shell,/20261007-agent-rewards-finance-v16-itemized-owner-corrections/);
  assert.match(shell,/p==='agent-settlements'\)return loadModule\('agentRewards'/);
  assert.doesNotMatch(shell,/\['agent-settlements','messages','market-news'\]\.includes\(p\)/);
  assert.match(remaining,/replaceAll\("'вознаграждения агентов':'rewards'",''\)/);
  assert.match(remaining,/replaceAll\("if\(kind==='rewards'\)return renderRewards\(\)",''\)/);
  assert.match(adminHtml,/portal-admin-shell-fast-v1\.js\?v=20261007-agent-rewards-finance-v17-itemized-owner-corrections/);
});

test('Watchdog requires the P&L owner and legacy owners cannot reclaim the page',()=>{
  assert.match(materializer,/STATIC_REMAINING_REWARDS_SOURCE_MISMATCH/);
  assert.match(materializer,/STATIC_REMAINING_COMPETING_OWNER_PRESENT/);
  assert.match(watchdog,/20261007-agent-rewards-finance-v16-itemized-owner-corrections/);
  assert.match(watchdog,/finance-workspace-v1/);
  assert.match(watchdog,/return'agentRewards'/);
  assert.match(ui,/__RONA_AGENT_REWARDS_FINANCE_REPAIR__/);
  assert.match(ui,/MutationObserver/);
  assert.match(ui,/ronaAgentRewardsOwner='finance-workspace-v1'/);
  assert.match(adminHtml,/portal-admin-runtime-watchdog-v1\.js\?v=20261007-agent-rewards-bootstrap-v15-itemized-owner-corrections/);
  assert.match(retiredLegacy,/RETIRED_BY_FINANCE_WORKSPACE_V2/);
  assert.doesNotMatch(retiredLegacy,/MutationObserver|setInterval|Активные агенты|Закреплено клиентов|Реестр|agentRewardsFragment/);
});
