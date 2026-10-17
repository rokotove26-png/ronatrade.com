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
const authoritativeDds=readFileSync('supabase/migrations/20261007002500_admin_agent_rewards_authoritative_dds_v14.sql','utf8');
const correctionAuthority=readFileSync('supabase/migrations/20261007091500_admin_agent_rewards_correction_authority_parity_v15.sql','utf8');
const reconciledRead=readFileSync('supabase/migrations/20261014113000_agent_rewards_current_finance_reconciled_v16.sql','utf8');
const reconciledCorrection=readFileSync('supabase/migrations/20261014114500_agent_rewards_reconciled_owner_correction_v17.sql','utf8');
const jsonbScalarGuard=readFileSync('supabase/migrations/20261014145000_agent_rewards_source_current_jsonb_scalar_guard_v20.sql','utf8');
const bnkIdentityV21=readFileSync('supabase/migrations/20261014153000_agent_rewards_source_locked_payment_identity_v21.sql','utf8');
const bnkIdentityFixture=readFileSync('tests/fixtures/agent-rewards-bnk-identity-v21-integration.sql','utf8');
const ui=readFileSync('functions/portal/agent-rewards-v1-ui.js','utf8');
const agentActMigration=readFileSync('supabase/migrations/20261014190500_agent_rewards_deal_addenda_act_workflow_v1.sql','utf8');
const agentActEdge=readFileSync('supabase/functions/rona-agent-reward-workflow/index.ts','utf8');
const agentActStages=readFileSync('supabase/functions/rona-agent-reward-workflow/acts.ts','utf8');
const agentActProxy=readFileSync('functions/portal/agent-reward-workflow.js','utf8');
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

test('Authoritative DDS v14 uses approved existing Finance facts instead of stale blanket TO_VERIFY',()=>{
  assert.match(authoritativeDds,/rona_admin_agent_rewards_workspace_v12/);
  assert.match(authoritativeDds,/agent_rewards\.fact\.dds_authority_v3/);
  assert.match(authoritativeDds,/MATERIALIZE_EXISTING_FINANCE_AUTHORITY_AS_DDS_FACT/);
  assert.match(authoritativeDds,/APPROVED_FINANCE_DDS_FACT/);
  assert.match(authoritativeDds,/OWNER_CONFIRMED_OR_BANK_CONFIRMED_FINANCE_AUTHORITY/);
  assert.match(authoritativeDds,/CONFIRMED_ZERO_IS_FACT_NOT_TO_VERIFY/);
  assert.match(authoritativeDds,/counterpartyCashOut/);
  assert.match(authoritativeDds,/bankFees/);
  assert.match(authoritativeDds,/netCashFlow/);
  assert.match(authoritativeDds,/DEFAULT_ZERO_IS_EDITABLE_OVERLAY_NOT_ZERO_EXTERNAL_BALANCE_ASSERTION/);
  assert.match(authoritativeDds,/APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE/);
  assert.match(authoritativeDds,/HIDE_WITHOUT_SEPARATE_APPROVED_REFERENCE__NEVER_ADD_TO_RESULT/);
  assert.doesNotMatch(authoritativeDds,/update\s+portal_private\.(payments|payment_allocations|deal_finance_authority|shipments)/i);
  assert.doesNotMatch(authoritativeDds,/delete\s+from\s+portal_private/i);
});

test('Correction authority v15 exposes the same Finance to Operations gate enforced by correction v7',()=>{
  assert.match(correctionAuthority,/rona_admin_agent_rewards_workspace_v13/);
  assert.match(correctionAuthority,/agent_rewards\.owner\.correction_contract_v2/);
  assert.match(correctionAuthority,/ALLOW_SOURCE_LOCKED_PAYMENT_LINE_OVERLAYS_PLUS_OPEN_SETTLEMENT/);
  assert.match(correctionAuthority,/APPROVED_FOR_OWNER_CORRECTION/);
  assert.match(correctionAuthority,/PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT/);
  assert.match(correctionAuthority,/OPERATIONS_INTERNAL_DECISION/);
  assert.match(correctionAuthority,/APPROVE_FOR_NEXT_STAGE/);
  assert.match(correctionAuthority,/o\.payload->>'record_id'=p\.record_id::text/);
  assert.doesNotMatch(correctionAuthority,/update\s+portal_private/i);
  assert.doesNotMatch(correctionAuthority,/delete\s+from\s+portal_private/i);
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
  assert.match(ui,/if\(pendingClosing&&!managementPreview\)return\{value:null,status:'CLOSING_CONDITIONS_REQUIRED'\}/);
  assert.match(ui,/termReward\(deal,\{preferSettlement:false,basisValue:basis,managementPreview:true\}\)/);
  assert.match(ui,/MANAGEMENT_FORECAST_PENDING_CONTRACTUAL_CLOSING/);
  assert.match(ui,/function planModel\(deal\)/);
  assert.match(ui,/Boolean\(deal\?\.planAuthority\?\.financeProposalRecordId\)/);
  assert.match(ui,/Boolean\(deal\?\.planAuthority\?\.operationsApprovalRecordId\)/);
  assert.match(ui,/FINANCE_APPROVED_MANAGEMENT_PLAN_FORECAST_ONLY/);
  assert.match(ui,/FINANCE_APPROVED_PLAN_NO_CURRENT_TERM/);
  assert.match(ui,/MANAGEMENT_PLAN_MODEL_ONLY_NOT_EXTERNAL_PAYABLE_AUTHORITY/);
  assert.match(ui,/DS4_INVALIDATED_BY_CURRENT_DS5/);
  assert.match(ui,/function validTerm\(deal\)/);
  assert.match(ui,/Math\.max\(0,basis\)\*num\(t\.rate\)/);
  assert.match(ui,/basisValue:basis/);
  assert.match(ui,/const reward=managementAgentReward\(deal,managementAgentBasis\(deal,pnl\)/);
  assert.match(ui,/const basis=num\(netProfit\)/);
});

test('Agent Rewards runtime serialization ships its transform helper',()=>{
  assert.match(ui,/const SCRIPT='var __name=\(target,value\)=>target;/);
});

test('Dedicated UI is P&L-first with PLAN, FACT and OWNER CONTROL in owner-defined order',()=>{
  assert.match(ui,/20261017-agent-rewards-spectrum-v3/);
  assert.match(ui,/1 · ПЛАН/);
  assert.match(ui,/2 · ФАКТ/);
  assert.match(ui,/3 · OWNER \/ АГЕНТ/);
  assert.match(ui,/function managementProfitModel\(income,expenses\)/);
  assert.match(ui,/MANAGEMENT_TAX_RATE=0\.10/);
  assert.match(ui,/const taxes=Math\.max\(0,preTaxProfit\)\*MANAGEMENT_TAX_RATE/);
  assert.match(ui,/netProfit:preTaxProfit-taxes,status:'MANAGEMENT_TAX_10_PERCENT'/);
  assert.match(ui,/Доходы/);
  assert.match(ui,/pnlRow\('Расходы',m\.expTotal,m\.cur/);
  assert.match(ui,/Прибыль до налогообложения/);
  assert.match(ui,/Налоги и платежи/);
  assert.doesNotMatch(ui,/Курсовая разница/);
  assert.match(ui,/Управленческое начисление · 10% от положительной прибыли/);
  assert.match(ui,/sourceFx:num\(p\.fxDifference\)/);
  assert.match(ui,/sourceTaxes:num\(p\.taxesAndPayments\)/);
  assert.match(ui,/return\{\.\.\.pnl,reward,ronaProfit/);
  assert.match(ui,/Чистая прибыль/);
  assert.match(ui,/Агентское вознаграждение/);
  assert.match(ui,/Прибыль RONA/);
  assert.match(ui,/Подтверждённые денежные операции/);
  assert.match(ui,/Подтверждённые денежные поступления/);
  assert.match(ui,/factManagementModel\(deal,m\)/);
  assert.match(ui,/managementAgentReward\(deal,managementAgentBasis\(deal,pnl\)/);
  assert.match(ui,/taxStatus:pnl\.status/);
  assert.match(ui,/sourceAgentReward:num\(p\.agentReward\)/);
  assert.match(ui,/Сохранить корректировку/);
  assert.match(ui,/function issueFromSavedOwnerCorrection/);
  assert.doesNotMatch(ui,/Акт сверки · СГ-Транс/);
  assert.doesNotMatch(ui,/ДС загружено · условия сверяются/);
  assert.match(ui,/DS1_50_PERCENT_SHIPMENT_MARGIN_RUB/);
  assert.match(ui,/Отправить агенту/);
  assert.match(ui,/send\.disabled=true/);
  assert.doesNotMatch(ui,/data-owner-expense-key/);
  assert.match(ui,/data-owner-payment-group-key/);
  assert.doesNotMatch(ui,/data-owner-payment-key/);
  assert.match(ui,/function distributeCounterpartyTotal\(parts,amount\)/);
  assert.match(ui,/CANONICAL_COUNTERPARTY_ID_ONLY|canonicalCounterpartyId/);
  assert.match(ui,/data-owner-key/);
  assert.match(ui,/paymentLineAmounts:m\.paymentLineAmounts/);
  assert.match(ui,/openSettlementAdjustment:m\.openSettlementAdjustment/);
  assert.doesNotMatch(ui,/rona-ar-kpis/);
  assert.match(adminHtml,/data-rona-agent-rewards-canonical-head="1"/);
  assert.match(adminHtml,/<h1 class="rona-visual-title">Вознаграждения агентов<\/h1>/);
  assert.doesNotMatch(adminHtml,/<h1 class="rona-visual-title">[^<]*Premium/i);
  assert.match(ui,/\.rona-ar-canonical-head \.rona-visual-title\{position:relative;margin:0;color:#f7fbff;font-size:clamp\(31px,3\.25vw,48px\)/);

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
  assert.match(ui,/__RONA_AGENT_REWARDS_VISUAL__='premium-fintech-v2'/);
  assert.match(ui,/data-rona-agent-rewards-visual|ronaAgentRewardsVisual/);
  assert.match(ui,/premium-fintech-v2/);
  assert.match(ui,/premium-fintech-v2 — presentation only; canonical heading intentionally untouched/);
  assert.match(ui,/function rowVisualIcon\(label\)/);
  assert.match(ui,/status-good/);
  assert.match(ui,/status-warn/);
  assert.match(ui,/status-danger/);
  assert.match(ui,/status-info/);
  assert.match(ui,/\.rona-ar-deal\.positive/);
  assert.match(ui,/\.rona-ar-deal\.negative/);
  assert.match(ui,/\.rona-ar-metric::before/);
  assert.match(ui,/\.rona-ar-col\.plan\{border-color:rgba\(97,183,255,.3\)/);
  assert.match(ui,/\.rona-ar-col\.fact\{border-color:rgba\(73,231,180,.3\)/);
  assert.match(ui,/\.rona-ar-col\.owner\{border-color:rgba\(198,167,255,.34\)/);
  assert.match(ui,/\.rona-ar-input:not\(:disabled\):focus/);
  assert.match(ui,/\.rona-ar-row\[data-row-icon\]/);

  assert.match(ui,/Digital finance · Agent rewards/);
  assert.match(ui,/ПРАВО НА ВЫПЛАТУ/);
  assert.match(ui,/function renderDealPulse\(root,deal\)/);
  assert.match(ui,/База агента — чистая прибыль после расчётных 10%/);
  assert.match(ui,/PLAN · прибыль RONA/);
  assert.match(ui,/ФАКТИЧЕСКИЙ РЕЗУЛЬТАТ · чистая прибыль/);
  assert.match(ui,/PLAN · агентское вознаграждение/);
  assert.match(ui,/\.rona-ar-flow\{/);
  assert.match(ui,/\.rona-ar-pulse\{/);
  assert.match(ui,/\.rona-ar-metric\{/);
  assert.match(ui,/linear-gradient\(rgba\(84,205,236,.045\) 1px,transparent 1px\)/);
  assert.doesNotMatch(ui,/function transportBreakdownView\(breakdown,status\)/);
  assert.doesNotMatch(ui,/Транспортировка · тарифный состав/);
  assert.match(ui,/transportBreakdown:p\.transportBreakdown/);
  assert.match(ui,/m\.transportBreakdown\?\.conflict\|\|upper\(m\.transportBreakdownStatus\)\.includes\('CONFLICT'\)/);
  assert.match(ui,/chip\('Тарифное расхождение','warn'\)/);
  assert.doesNotMatch(ui,/table\.append\(transportBreakdownView\(/);
  assert.doesNotMatch(ui,/left\.append\(financeMetaNode\(hint\)/);
  assert.doesNotMatch(ui,/name\.append\(financeMetaNode\(sub/);
  assert.match(ui,/if\(hint\)labelNode\.title=String\(hint\)/);
  assert.match(ui,/if\(sub\)labelNode\.title=sub/);
  assert.match(ui,/function balancesView\(deal\)/);
  assert.match(ui,/function balanceKind\(x\)/);
  assert.match(ui,/if\(type\.includes\('ADVANCE'\)\)return'Аванс'/);
  assert.match(ui,/if\(type\.includes\('RECEIVABLE'\)\)return'ДЗ'/);
  assert.match(ui,/if\(type\.includes\('PAYABLE'\)\)return'КЗ'/);
  assert.match(ui,/if\(!kind\)continue/);
  assert.doesNotMatch(ui,/return'ПРОВЕРИТЬ'/);
  assert.doesNotMatch(ui,/return'САЛЬДО'/);
  assert.doesNotMatch(ui,/rona-ar-balance-status','Требует проверки/);
  assert.match(ui,/Расчёт по фактическому ДДС/);
  assert.doesNotMatch(ui,/Расчёт по фактическим платежам/);
  assert.match(ui,/metricCard\('ФАКТИЧЕСКИЙ РЕЗУЛЬТАТ · чистая прибыль',o\.netProfit/);
  assert.match(ui,/const fm=cashFactModel\(d\),actual=ownerModel\(d,fm\)/);
  assert.match(ui,/function updateOwnerKpiPreview\(col,netProfit,agentReward,cur,rewardStatus\)/);
  assert.match(ui,/updateOwnerKpiPreview\(col,pnl\.netProfit,reward\.value,cur,reward\.status\)/);
  assert.doesNotMatch(ui,/Задолженность и авансы по контрагентам/);
  assert.doesNotMatch(ui,/if\(settlements\)table\.append\(settlements\)/);
  assert.match(ui,/function settlementDetailsDialog\(deal,trigger\)/);
  assert.match(ui,/trigger\.onclick=\(\)=>dialog\.showModal\(\)/);
  assert.match(ui,/col\.append\(table,settlementDetailsDialog\(deal,detailsButton\)\)/);
  assert.match(ui,/const detailsButton=el\('button','rona-ar-details-btn','Детали'\)/);
  // Existing signed source contract remains unchanged; only UI expense-first notation.
  assert.match(ui,/function expenseDeltaFromSource\(value\)/);
  assert.match(ui,/function sourceDeltaFromExpenseInput\(value\)/);
  assert.match(ui,/sourceDeltaFromExpenseInput\(q\('/);
  assert.match(ui,/expenseDeltaFromSource\(base\.openSettlementAdjustment\)/);
  assert.match(ui,/v===null\?null:-v/);
  assert.doesNotMatch(ui,/Плюс — дополнительный расход, минус — дополнительный доход/);
  assert.doesNotMatch(ui,/const openSettlementAdjustment=round1\(q\('/);
  assert.doesNotMatch(ui,/root\.append\(balances\)/);
  assert.match(ui,/Корректировка расходов \(доходов\)/);
  assert.doesNotMatch(ui,/Условные претензии и HOLD-позиции в ДЗ\/КЗ не включены/);
  assert.match(ui,/function managementProfitModel\(income,expenses\)/);
  assert.doesNotMatch(ui,/actualFinancialResult[^\n]*\+[^\n]*realizedFxReference/);
  assert.match(ui,/function factManagementModel\(deal,fact\)/);
  assert.match(ui,/Сверенный ФАКТ → корректировки → единый налог 10% → чистая прибыль/);
  assert.match(ui,/Корректировка не подтверждена Finance → Operations/);
  assert.match(ui,/\.rona-ar-balances\{/);
  assert.doesNotMatch(ui,/el\('div','rona-ar-summary-note'/);
  assert.doesNotMatch(ui,/el\('div','rona-ar-finance-banner'/);
  assert.doesNotMatch(ui,/financeMetaNode\(/);
  assert.doesNotMatch(ui,/el\('div','rona-ar-owner-adjustment-note'/);
  assert.doesNotMatch(ui,/const note=el\('div','rona-ar-owner-note'\)/);
  assert.match(ui,/await saveCorrection\(deal\.dealId,deal\.assignmentId,payload,''\)/);
  assert.match(ui,/function cashFactModel\(deal\)/);
  assert.match(ui,/function cashPaymentLinesModel\(deal,cur\)/);
  assert.match(ui,/Оплачено контрагентам/);
  assert.match(ui,/m\.paymentLines\.map/);
  assert.match(ui,/Подтверждённых выплат контрагентам нет/);
  assert.match(ui,/function ownerBridgeApproved\(deal\)/);
  assert.match(ui,/function ownerCorrectionApproved\(deal\)/);
  assert.match(ui,/APPROVED_FOR_OWNER_CORRECTION/);
  assert.match(ui,/base\.bridgeApproved&&fact\.approved&&correctionApproved/);
  assert.match(ui,/function ownerAgentReward\(deal,netProfit\)/);
  assert.match(ui,/const basis=num\(netProfit\)/);
  assert.match(ui,/ownerAgentReward\(deal,managementAgentBasis\(deal,pnl\)/);
  assert.match(ui,/INTERNAL_NET_PROFIT_BASIS_EXTERNAL_FX_TERM_REVIEW_REQUIRED/);
  assert.match(ui,/Корректировка расходов \(доходов\)/);
  assert.match(ui,/Прибыль до налогообложения/);
  assert.doesNotMatch(ui,/База агентского вознаграждения/);
  assert.doesNotMatch(ui,/data-owner-computed="agentBasis"/);
  assert.match(ui,/function renderFxReference\(root,deal\)/);
  assert.match(ui,/if\(!fact\.approved\|\|fact\.realizedFxReference===null\)return/);
  assert.doesNotMatch(ui,/Уже отражён в фактических платежах\. Повторно к Чистому ДДС и финансовому результату не прибавляется/);
  assert.doesNotMatch(ui,/Реализованный FX · справочно/);
  assert.match(ui,/renderDealPulse\(root,deal\);\s*renderFxReference\(root,deal\);/);
  assert.match(ui,/Math\.max\(0,openSettlementAdjustment\)/);
  assert.match(ui,/Math\.max\(0,-openSettlementAdjustment\)/);
  assert.doesNotMatch(ui,/basis=result-fx/);
  assert.match(ui,/const externalFxTermConflict=!ownerApprovedManagementPolicy\(deal\)/);
  assert.doesNotMatch(ui,/Условие FX · сверить договор/);
  // Legal FX-exclusion condition remains in the internal source model, not a UI badge.
  assert.match(ui,/const externalFxTermConflict=!ownerApprovedManagementPolicy\(deal\)/);
  assert.match(ui,/pnl\.netProfit-reward\.value/);
  assert.match(ui,/function agentStatusText\(status\)/);
  assert.doesNotMatch(ui,/ДС не привязано/);
  assert.match(ui,/ДС загружено и привязано к сделке/);
  assert.match(ui,/SHIPMENT_MARGIN_SOURCE_REQUIRED/);
  assert.doesNotMatch(ui,/OWNER_DS1_AFTER_TAX_MANAGEMENT_PREVIEW_ONLY/);
  assert.match(ui,/e12c2e1f7527ed58a07e081396be9d2b51401d42558be8b3ba7c7be5e9431bab/);
  assert.match(ui,/documentTermMismatch\(deal\)/);
  assert.doesNotMatch(ui,/Нет действующего условия/);
  assert.doesNotMatch(ui,/Расчёт после закрытия/);
  assert.match(ui,/После расчёта агента/);
  assert.match(ui,/minimumFractionDigits:1,maximumFractionDigits:1/);
  assert.match(ui,/inp\.step='0\.1'/);
  assert.match(ui,/toFixed\(1\)/);
  assert.match(ui,/function ownerPaymentLines\(lines,enabled\)/);
  assert.match(ui,/fact\.counterpartyCashOut\+paymentDelta/);
  assert.match(ui,/fact\.cashReceived-counterpartyCashOut-fact\.bankFees/);


});

test('Owner API routes Agent Rewards to correction-authority V13 read RPC and correction V7',()=>{
  assert.match(ownerApi,/\/admin\/agent-rewards-v1/);
  assert.match(ownerApi,/rona_admin_agent_rewards_workspace_v15/);
  assert.match(ownerApi,/rona_admin_agent_rewards_correct_v9/);
  assert.match(reconciledRead,/create or replace function public\.rona_admin_agent_rewards_workspace_v14\(\)/);
  assert.match(reconciledRead,/payment_resource_chains_effective_v8/);
  assert.match(reconciledRead,/deal_finance_authority_payments_v8_read_v1/);
  assert.match(reconciledRead,/FINANCE_V8_CURRENT_RECONCILED/);
  assert.match(reconciledRead,/HOLD_CURRENT_FINANCE_SOURCE_MISMATCH/);
  assert.match(reconciledRead,/LEGACY_APPROVED_PAYMENT_SCOPE_RECONCILED/);
  assert.match(reconciledRead,/approved_dds_authority|agent_rewards\.fact\.dds_authority_v3/);
  assert.match(reconciledRead,/CANONICAL_COUNTERPARTY_ID_ONLY/);
  assert.doesNotMatch(reconciledRead,/\bupdate\s+portal_private\.|\bdelete\s+from\s+portal_private\.|\binsert\s+into\s+portal_private\./i);
  assert.match(reconciledCorrection,/create or replace function public\.rona_admin_agent_rewards_correct_v8\(/);
  assert.match(reconciledCorrection,/rona_admin_agent_rewards_correct_v7/);
  assert.match(reconciledCorrection,/PAYMENT_LINE_NOT_IN_RECONCILED_FINANCE_SOURCE/);
  assert.match(ownerApi,/p_assignment_id/);
  assert.match(ownerApi,/p_corrected_payload/);
  assert.match(ownerApi,/p_idempotency_key/);
});

test('Admin shell lazy-loads Agent Rewards P&L and legacy Remaining renderer stays retired',()=>{
  assert.match(shell,/agentRewards:\{src:'\/portal\/agent-rewards-v1-ui\?v=20261016-owner-direct-generic-act-v1'/);
  assert.match(shell,/const agentRewardsReady=/);
  assert.match(shell,/ready:agentRewardsReady/);
  assert.doesNotMatch(shell,/__RONA_AGENT_REWARDS_FINANCE_V1__===['"]20261007-/);
  assert.match(shell,/p==='agent-settlements'\)return loadModule\('agentRewards'/);
  assert.doesNotMatch(shell,/\['agent-settlements','messages','market-news'\]\.includes\(p\)/);
  assert.match(remaining,/replaceAll\("'вознаграждения агентов':'rewards'",''\)/);
  assert.match(remaining,/replaceAll\("if\(kind==='rewards'\)return renderRewards\(\)",''\)/);
  assert.match(adminHtml,/portal-admin-shell-fast-v1\.js\?v=20261009-term-curve-v3/);
});

test('Watchdog requires the P&L owner and legacy owners cannot reclaim the page',()=>{
  assert.match(materializer,/STATIC_REMAINING_REWARDS_SOURCE_MISMATCH/);
  assert.match(materializer,/STATIC_REMAINING_COMPETING_OWNER_PRESENT/);
  assert.match(watchdog,/page-aware-v24-agent-rewards-content-readiness-v1/);
  assert.match(watchdog,/typeof window\.__RONA_AGENT_REWARDS_FINANCE_REPAIR__==='function'/);
  assert.doesNotMatch(watchdog,/__RONA_AGENT_REWARDS_FINANCE_V1__===['"]20261007-/);
  assert.match(watchdog,/finance-workspace-v1/);
  assert.match(watchdog,/return'agentRewards'/);
  assert.match(ui,/__RONA_AGENT_REWARDS_FINANCE_REPAIR__/);
  assert.match(ui,/MutationObserver/);
  assert.match(ui,/ronaAgentRewardsOwner='finance-workspace-v1'/);
  assert.match(adminHtml,/portal-admin-runtime-watchdog-v1\.js\?v=20261007-agent-rewards-bootstrap-v18-correction-gate-v3/);
  assert.match(retiredLegacy,/RETIRED_BY_FINANCE_WORKSPACE_V2/);
  assert.doesNotMatch(retiredLegacy,/MutationObserver|setInterval|Активные агенты|Закреплено клиентов|Реестр|agentRewardsFragment/);
});

test('Live Agent Rewards v15 guards JSON null and scalar owner corrections without changing Finance or payable authority',()=>{
  assert.match(jsonbScalarGuard,/CREATE OR REPLACE FUNCTION public\.rona_admin_agent_rewards_workspace_v15\(\)/);
  assert.match(jsonbScalarGuard,/jsonb_typeof\(s\.item->'ownerCorrection'\) = 'object'\s+and jsonb_typeof\(s\.item->'ownerCorrection'->'payload'\) = 'object'/);
  assert.doesNotMatch(jsonbScalarGuard,/and s\.item->'ownerCorrection' is not null/);
  assert.match(jsonbScalarGuard,/then jsonb_set\([\s\S]*?\{payload,openSettlementAdjustment\}/);
  assert.match(jsonbScalarGuard,/ownerCorrectionRaw',s\.item->'ownerCorrection'/);
  assert.match(jsonbScalarGuard,/FINANCE_OPEN_SETTLEMENT_FROM_DOCUMENTED_EXPENSE_V1/);
  assert.match(jsonbScalarGuard,/AUTHORITY|sourceCurrentness|sourceCreatedAt|source_created_at/i);
  assert.match(jsonbScalarGuard,/md5\(pg_get_functiondef\('public\.rona_admin_agent_rewards_workspace_v15\(\)'::regprocedure\)\)/);
  assert.doesNotMatch(jsonbScalarGuard,/\b(?:update|delete\s+from|insert\s+into)\s+portal_private\./i);
  assert.match(ownerApi,/rona_admin_agent_rewards_workspace_v15/);
  assert.match(ownerApi,/rona_admin_agent_rewards_correct_v9/);
  assert.match(jsonbScalarGuard,/SECURITY DEFINER/);
  assert.match(jsonbScalarGuard,/SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'/);
});

test('BNK v21 resolves verified PAYMENT evidence but preserves canonical ambiguity and authorization',()=>{
  const functionSource=bnkIdentityV21.slice(
    bnkIdentityV21.indexOf('CREATE OR REPLACE FUNCTION public.rona_admin_agent_rewards_workspace_v15_legacy_source_v1()'));
  assert.match(bnkIdentityV21,/RONA_BNK_LEGACY_SOURCE_CHANGED/);
  assert.match(bnkIdentityV21,/RONA_BNK_V15_SOURCE_CHANGED/);
  assert.match(bnkIdentityV21,/b57df00f3d5fa819e736e482b0417468/);
  assert.match(bnkIdentityV21,/6eed7c3b37fbc92d989b62d0e83ed540/);
  assert.match(functionSource,/v_actor := portal_private\.owner_r1_actor\('ADMIN'\)/);
  assert.match(functionSource,/v_base := public\.rona_admin_agent_rewards_workspace_v13\(\)/);
  assert.match(functionSource,/i\.source_locked=true and i\.lifecycle_state='ACTIVE'/);
  assert.match(functionSource,/count\(distinct (?:i\.)?canonical_counterparty_id\)=1/);
  assert.equal((functionSource.match(/i\.evidence_refs @> jsonb_build_array\('PAYMENT:'/g)||[]).length,2,
    'current and legacy DDS projections must verify exact payment evidence');
  assert.match(functionSource,/p\.payment_id/);
  assert.match(functionSource,/x\.value->>'paymentId'/);
  assert.doesNotMatch(functionSource,/\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+portal_private\./i);
  assert.doesNotMatch(functionSource,/CREATE OR REPLACE FUNCTION public\.rona_admin_agent_rewards_workspace_v15\(\)/);
  assert.match(bnkIdentityFixture,/TWO_EVIDENCE_IDS/);
  assert.match(bnkIdentityFixture,/NAME_VS_EVIDENCE_AMBIGUITY/);
  assert.match(bnkIdentityFixture,/INVALID_SOURCE_LOCK/);
  assert.match(bnkIdentityFixture,/SGTRANS_EXACT/);
  assert.match(bnkIdentityFixture,/ORIENT_EXACT/);
  assert.match(bnkIdentityFixture,/BNK_PAYMENT_EVIDENCE/);
  assert.match(ui,/inp\.disabled=!enabled\|\|!x\.resolved/);
  assert.match(ui,/canonicalCounterpartyId/);
  assert.match(ownerApi,/rona_admin_agent_rewards_correct_v9/);
});

test('Agent Rewards document workflow binds signed DS, source Owner version and protected services acts without payout mutation',()=>{
  assert.match(agentActMigration,/agent_reward_deal_addenda_v1/);
  assert.match(agentActMigration,/agent_reward_act_requests_v1/);
  assert.match(agentActMigration,/agent_reward_act_documents_v1/);
  assert.match(agentActMigration,/owner_correction_key uuid not null references portal_private\.agent_reward_owner_corrections_v1/);
  assert.match(agentActMigration,/agency_document_key uuid not null references portal_private\.agent_agency_contract_documents/);
  assert.match(agentActMigration,/addendum_key uuid not null references portal_private\.agent_reward_deal_addenda_v1/);
  assert.match(agentActMigration,/finance_review_record_id uuid references portal_private\.ai_coordination_records/);
  assert.match(agentActMigration,/legal_review_record_id uuid references portal_private\.ai_coordination_records/);
  assert.match(agentActMigration,/alter table portal_private\.agent_reward_act_requests_v1 enable row level security/);
  assert.match(agentActMigration,/revoke all on portal_private\.agent_reward_act_documents_v1 from public,anon,authenticated/);
  assert.match(agentActEdge,/resolve_portal_auth/);
  assert.match(agentActEdge,/ADMIN_IMPERSONATION_DENIED/);
  assert.match(agentActEdge,/SIGNED_ADDENDUM_WRONG_AGENT/);
  // Deal-scoped singleton: one signed DS, no company archive projection or silent replacement.
  assert.doesNotMatch(agentActEdge,/signedAddenda:existing\.map|const existing=await sql/);
  assert.match(agentActEdge,/DEAL_SIGNED_ADDENDUM_ALREADY_LINKED/);
  assert.match(agentActEdge,/from portal_private\.deals where id=\$\{s\.deal_key\}::uuid for update/);
  assert.match(agentActEdge,/if\(old\?\.document_id===docId\)return\{bindingId:old.id,status:"ALREADY_LINKED"\}/);
  assert.doesNotMatch(agentActEdge,/set is_current=false,evidence_status='SUPERSEDED'/);
  assert.doesNotMatch(ui,/Привязать архивное ДС|Архив подписанных ДС|ДС из архива агентской компании/);
  assert.match(agentActEdge,/SAVE_OWNER_CORRECTION_FIRST/);
  assert.match(agentActEdge,/LINK_SIGNED_DEAL_ADDENDUM_FIRST/);
  assert.match(agentActEdge,/AGENT_SERVICES_ACT_REVIEW_REQUESTED/);
  assert.match(agentActEdge,/ownerApprovedByUpload/);
  assert.match(agentActEdge,/FINANCE_TERM_NOT_ALIGNED_WITH_SIGNED_DS/);
  assert.match(agentActEdge,/OWNER_SECTION_SAVED_CALCULATION_V1/);
  assert.match(agentActEdge,/ACT_OWNER_CORRECTION_SNAPSHOT_MISMATCH/);
  assert.match(agentActEdge,/ACT_OWNER_DISPLAYED_ARITHMETIC_MISMATCH/);
  assert.match(agentActStages,/ACT_OWNER_SAVED_REWARD_FINANCE_MISMATCH/);
  assert.match(agentActEdge,/SIGNED_SHIPMENT_MARGIN_AND_CLOSING_DOCUMENTS_REQUIRED/);
  assert.match(agentActEdge,/DS1_AGENCY_CONTRACT_REFERENCE_DISCREPANCY/);
  assert.doesNotMatch(agentActEdge,/VERIFIED_AFTER_TAX_NET_PROFIT_REQUIRED/);
  assert.match(agentActEdge,/externalPayableApproved:false/);

  assert.match(agentActStages,/ACT_OWNER_DIRECT_ISSUE_NOT_AUTHORIZED/);
  assert.match(agentActStages,/ownerActCandidate/);
  assert.match(ui,/OWNER_DS1_SHIPMENT_MARGIN_SAVED_SECTION/);
  assert.match(agentActEdge,/ownerSignReady/);
  assert.match(agentActStages,/FINANCE_LEGAL_ACT_REVIEW_REQUIRED/);
  assert.match(agentActStages,/AGENT_PORTAL_RECIPIENT_NOT_ACTIVE/);
  assert.match(agentActStages,/ACT_CORRECTION_OUTDATED|OWNER_CORRECTION_SUPERSEDED/);
  assert.match(agentActStages,/AGENT_ACT_ACCESS_DENIED/);
  assert.match(agentActStages,/BOTH_SIGNED/);
  assert.match(agentActStages,/AGENT_PORTAL_INBOX/);
  // Owner 2026-10-15: Agent LK/delivery deferred; Admin draft and offline signed return only.
  assert.match(agentActStages,/stage!=='FINANCE_LEGAL_DRAFT'\&\&!ownerDirect\&\&!reviews\.approved/);
  assert.match(agentActStages,/\['OWNER_SIGNED','AWAITING_AGENT_SIGNATURE'\]\.includes\(row\.request_status\)/);
  assert.match(agentActStages,/ACT_STAGE_CHANGED/);
  assert.match(agentActStages,/AGENT_PORTAL_INBOX_UI_NOT_DEPLOYED/);
  assert.doesNotMatch(ui,/Открыть проект акта · печать в PDF/);
  assert.match(ui,/Документы и акт/);
  assert.match(ui,/RONA-DOC-STANDARD v2/);
  assert.match(ui,/Подтверждаю, что PDF содержит подписи обеих сторон/);
  assert.doesNotMatch(ui,/Отправить агенту на подписание/);
  assert.match(agentActProxy,/action==='canonical-letterhead'\&\&request\.method==='GET'/);
  assert.match(agentActEdge,/CANONICAL_LETTERHEAD_HASH_MISMATCH/);
  assert.match(agentActEdge,/await context\(req\)/);
  assert.match(agentActProxy,/originAllowed\(request\)/);
  assert.match(agentActProxy,/action==='agent-inbox'&&request.method==='GET'/);
  assert.match(ui,/Загрузить ДС/);
  assert.match(ui,/Акт выполненных работ/);
  assert.match(ui,/await saveCorrection\(deal\.dealId,deal\.assignmentId,payload,''\)/);
  assert.match(ui,/send\.disabled=true/);
  for(const source of [agentActMigration,agentActEdge,agentActStages]){
    assert.doesNotMatch(source,/\b(?:update|insert into|delete from)\s+portal_private\.(?:agent_settlements|payments|agent_deal_terms)\b/i);
  }
});

test('Owner 2026-10-17 InKom 50%-net management rule is independent from historical DS terms',()=>{
  assert.match(ui,/source:'OWNER_DIRECTIVE_2026-10-17'/);
  assert.match(ui,/agentLegalEntityId:'S-005',rate:0\.5/);
  assert.match(ui,/basis:'POSITIVE_AFTER_TAX_MANAGEMENT_NET_PROFIT',createsPayable:false/);
  assert.match(ui,/value:Math\.max\(0,basis\)\*policy.rate/);
  assert.match(ui,/return ownerApprovedManagementPolicy\(deal\)\?pnl.netProfit/);
  assert.match(ui,/const signedDs1=ownerSignedDs1ForManagement\(deal\)/);
  assert.match(ui,/const actReward=signedDs1\?round1\(Math\.max\(0,signedMargin\)\*0\.5\):round1\(model.reward\)/);
});
