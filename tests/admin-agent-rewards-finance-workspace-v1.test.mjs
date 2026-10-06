import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const baseline=readFileSync('supabase/migrations/20261005200500_admin_agent_rewards_finance_workspace_v1.sql','utf8');
const pnl=readFileSync('supabase/migrations/20261006023000_admin_agent_rewards_pnl_v3.sql','utf8');
const activeScope=readFileSync('supabase/migrations/20261006054500_admin_agent_rewards_active_scope_v4.sql','utf8');
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

test('Owner correction V3 is immutable and accepts only P&L numeric overlay fields',()=>{
  assert.match(pnl,/rona_admin_agent_rewards_correct_v3/);
  assert.match(pnl,/v_allowed text\[\].*'revenue'.*'operatingExpenses'.*'taxesAndPayments'.*'fxDifference'.*'agentReward'/s);
  assert.match(pnl,/agent_reward_owner_corrections_v1/);
  assert.match(pnl,/correction_version/);
  assert.match(pnl,/idempotency_key/);
  assert.doesNotMatch(pnl,/update\s+portal_private\.deal_finance_authority/i);
  assert.doesNotMatch(pnl,/update\s+portal_private\.payments/i);
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
  assert.match(ui,/20261006-agent-rewards-finance-v5/);
  assert.match(ui,/1 · ПЛАН/);
  assert.match(ui,/2 · ФАКТ/);
  assert.match(ui,/3 · OWNER CONTROL/);
  assert.match(ui,/Итого выручка/);
  assert.match(ui,/Расходы постатейно/);
  assert.match(ui,/Итого финансовый результат/);
  assert.match(ui,/Налоги и платежи/);
  assert.match(ui,/Курсовая разница/);
  assert.match(ui,/Итого чистая прибыль/);
  assert.match(ui,/Агентское вознаграждение/);
  assert.match(ui,/Итого прибыль RONA/);
  assert.match(ui,/Выручка = полная плановая выручка сделки, не кассовое поступление/);
  assert.match(ui,/ПРЕДВАРИТЕЛЬНО · налоги TO_VERIFY/);
  assert.match(ui,/Скорректировать данные/);
  assert.match(ui,/Отправить агенту/);
  assert.match(ui,/send\.disabled=true/);
  assert.match(ui,/data-owner-key/);
  assert.match(ui,/revenue:m\.revenue,operatingExpenses:m\.expenses,taxesAndPayments:m\.taxes,fxDifference:m\.fx,agentReward:m\.reward/);
  assert.doesNotMatch(ui,/rona-ar-kpis/);
  assert.match(adminHtml,/data-rona-agent-rewards-canonical-head="1"/);
  assert.match(adminHtml,/<div class="current-loading-title">Вознаграждения агентов<\/div>/);
  assert.match(ui,/function ensureCanonicalLayout\(\)/);
  assert.match(ui,/data-rona-agent-rewards-host/);
  assert.match(ui,/state\.workspacePromise/);
  assert.match(ui,/Date\.now\(\)-state\.loadedAt<15000/);
  assert.doesNotMatch(ui,/p\.replaceChildren\(root\)/);
  assert.match(ui,/\.rona-ar-title\{font-size:26px/);
  assert.match(ui,/\.rona-ar-name\{font-size:12\.5px/);
  assert.match(ui,/\.rona-ar-value\{text-align:right;font-size:15\.5px/);
  assert.match(ui,/minmax\(230px,1fr\)/);
});

test('Owner API routes Agent Rewards to P&L V3 RPCs',()=>{
  assert.match(ownerApi,/\/admin\/agent-rewards-v1/);
  assert.match(ownerApi,/rona_admin_agent_rewards_workspace_v3/);
  assert.match(ownerApi,/rona_admin_agent_rewards_correct_v3/);
  assert.match(ownerApi,/p_assignment_id/);
  assert.match(ownerApi,/p_corrected_payload/);
  assert.match(ownerApi,/p_idempotency_key/);
});

test('Admin shell lazy-loads Agent Rewards P&L and legacy Remaining renderer stays retired',()=>{
  assert.match(shell,/agentRewards:\{src:'\/portal\/agent-rewards-v1-ui\?v=20261006-finance-workspace-v6-singleflight-head'/);
  assert.match(shell,/20261006-agent-rewards-finance-v5/);
  assert.match(shell,/p==='agent-settlements'\)return loadModule\('agentRewards'/);
  assert.doesNotMatch(shell,/\['agent-settlements','messages','market-news'\]\.includes\(p\)/);
  assert.match(remaining,/replaceAll\("'вознаграждения агентов':'rewards'",''\)/);
  assert.match(remaining,/replaceAll\("if\(kind==='rewards'\)return renderRewards\(\)",''\)/);
  assert.match(adminHtml,/portal-admin-shell-fast-v1\.js\?v=20261006-agent-rewards-finance-v6-singleflight-head/);
});

test('Watchdog requires the P&L owner and legacy owners cannot reclaim the page',()=>{
  assert.match(materializer,/STATIC_REMAINING_REWARDS_SOURCE_MISMATCH/);
  assert.match(materializer,/STATIC_REMAINING_COMPETING_OWNER_PRESENT/);
  assert.match(watchdog,/20261006-agent-rewards-finance-v5/);
  assert.match(watchdog,/finance-workspace-v1/);
  assert.match(watchdog,/return'agentRewards'/);
  assert.match(ui,/__RONA_AGENT_REWARDS_FINANCE_REPAIR__/);
  assert.match(ui,/MutationObserver/);
  assert.match(ui,/ronaAgentRewardsOwner='finance-workspace-v1'/);
  assert.match(adminHtml,/portal-admin-runtime-watchdog-v1\.js\?v=20261006-agent-rewards-bootstrap-v4-singleflight-head/);
  assert.match(retiredLegacy,/RETIRED_BY_FINANCE_WORKSPACE_V2/);
  assert.doesNotMatch(retiredLegacy,/MutationObserver|setInterval|Активные агенты|Закреплено клиентов|Реестр|agentRewardsFragment/);
});
