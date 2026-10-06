import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync('supabase/migrations/20261005200500_admin_agent_rewards_finance_workspace_v1.sql','utf8');
const ui=readFileSync('functions/portal/agent-rewards-v1-ui.js','utf8');
const ownerApi=readFileSync('functions/portal/owner-api.js','utf8');
const shell=readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
const remaining=readFileSync('functions/portal/remaining-sections-ui.js','utf8');
const adminHtml=readFileSync('portal-src/current/admin.html','utf8');
const watchdog=readFileSync('assets/portal-admin-runtime-watchdog-v1.js','utf8');
const materializer=readFileSync('scripts/materialize-admin-current-modules.mjs','utf8');
const retiredLegacy=readFileSync('functions/portal/owner-ui-chunks/chunk18-base.js','utf8');

test('Agent Rewards read model is Admin-only, Finance-authoritative and receipt-currency based',()=>{
  assert.match(migration,/rona_admin_agent_rewards_workspace_v1/);
  assert.match(migration,/owner_r1_actor\('ADMIN'\)/);
  assert.match(migration,/deal_finance_authority_payments_v8_read_v1/);
  assert.match(migration,/payment_resource_chains_effective_v8/);
  assert.match(migration,/conversion_source_basis/);
  assert.match(migration,/ALL_PRIMARY_VALUES_IN_RECEIPT_CURRENCY/);
  assert.match(migration,/receivedAmount/);
  assert.match(migration,/totalSpend/);
  assert.match(migration,/financialResult/);
  assert.match(migration,/fxDifference/);
  assert.match(migration,/conversionCost/);
  assert.match(migration,/bankFees/);
  assert.match(migration,/agentReward/);
  assert.match(migration,/AI-FINANCE/);
});

test('Owner correction is immutable overlay and cannot mutate Finance authority facts',()=>{
  assert.match(migration,/agent_reward_owner_corrections_v1/);
  assert.match(migration,/correction_version/);
  assert.match(migration,/unique\(assignment_id,deal_key,correction_version\)/);
  assert.match(migration,/idempotency_key text not null unique/);
  assert.match(migration,/rona_admin_agent_rewards_correct_v2/);
  assert.match(migration,/v_allowed text\[\].*receivedAmount.*agentReward/s);
  assert.doesNotMatch(migration,/update\s+portal_private\.deal_finance_authority/i);
  assert.doesNotMatch(migration,/update\s+portal_private\.payments/i);
  assert.doesNotMatch(migration,/delete\s+from\s+portal_private\.deal_finance/i);
});

test('Agent reward fails closed without a confirmed calculable basis',()=>{
  assert.match(migration,/TERM_MISSING/);
  assert.match(migration,/CALCULATION_BASIS_REQUIRED/);
  assert.match(migration,/SETTLEMENT_AUTHORITY/);
  assert.match(migration,/FIXED_TERM/);
  assert.match(migration,/term_status='ACTIVE'/);
  assert.match(migration,/term_authority_state in \('CONFIRMED','VERIFIED','AUTHORITATIVE'\)/);
  assert.match(migration,/d\.valid_from<=now\(\)/);
  assert.match(migration,/settlement_state in \('APPROVED','PAYABLE_CONFIRMED','PAID'\)/);
});

test('Dedicated premium UI has AS IS, Owner control, correction and future send button',()=>{
  assert.match(ui,/20261005-agent-rewards-finance-v2/);
  assert.match(ui,/AS IS/);
  assert.match(ui,/AI Финансовый директор/);
  assert.match(ui,/OWNER CONTROL/);
  assert.match(ui,/Скорректировать данные/);
  assert.match(ui,/Отправить агенту/);
  assert.match(ui,/send\.disabled=true/);
  assert.match(ui,/Курсовая разница/);
  assert.match(ui,/Затраты на конвертацию/);
  assert.match(ui,/оригинальная валюта → валюта поступления/);
  assert.match(ui,/FINANCE LIVE/);
  assert.match(ui,/Выберите сделку на дашборде для открытия финансового паспорта/);
  assert.doesNotMatch(ui,/selectedDealId/);
  assert.match(ui,/assignmentId/);
  assert.match(ui,/--ar-cyan:#22d3ee/);
  assert.match(ui,/--ar-green:#34d399/);
  assert.match(ui,/--ar-violet:#a78bfa/);
});

test('Owner API exposes only the dedicated read/correction RPCs',()=>{
  assert.match(ownerApi,/\/admin\/agent-rewards-v1/);
  assert.match(ownerApi,/rona_admin_agent_rewards_workspace_v1/);
  assert.match(ownerApi,/rona_admin_agent_rewards_correct_v2/);
  assert.match(ownerApi,/p_assignment_id/);
  assert.match(ownerApi,/p_corrected_payload/);
  assert.match(ownerApi,/p_idempotency_key/);
});

test('Admin shell lazy-loads Agent Rewards and legacy Remaining renderer no longer owns it',()=>{
  assert.match(shell,/agentRewards:\{src:'\/portal\/agent-rewards-v1-ui\?v=20261006-finance-workspace-v3-legacy-retired'/);
  assert.match(shell,/p==='agent-settlements'\)return loadModule\('agentRewards'/);
  assert.doesNotMatch(shell,/\['agent-settlements','messages','market-news'\]\.includes\(p\)/);
  assert.match(remaining,/replaceAll\("'вознаграждения агентов':'rewards'",''\)/);
  assert.match(remaining,/replaceAll\("if\(kind==='rewards'\)return renderRewards\(\)",''\)/);
  assert.match(adminHtml,/portal-admin-shell-fast-v1\.js\?v=20261006-agent-rewards-finance-v3/);
});

test('Legacy Remaining runtime cannot reclaim Agent Rewards',()=>{
  assert.match(materializer,/replaceAll\("'вознаграждения агентов':'rewards'",''\)/);
  assert.match(materializer,/STATIC_REMAINING_REWARDS_SOURCE_MISMATCH/);
  assert.match(materializer,/function renderRewards\(\)\{/);
  assert.match(materializer,/STATIC_REMAINING_COMPETING_OWNER_PRESENT/);
  assert.match(watchdog,/agent-settlements'\)return window\.__RONA_AGENT_REWARDS_FINANCE_V1__/);
  assert.match(watchdog,/return'agentRewards'/);
  assert.doesNotMatch(watchdog,/\['agent-settlements','messages'\]\.includes\(p\)\)return'remaining'/);
  assert.match(ui,/__RONA_AGENT_REWARDS_FINANCE_REPAIR__/);
  assert.match(ui,/MutationObserver/);
  assert.match(ui,/ronaAgentRewardsOwner='finance-workspace-v1'/);
  assert.match(shell,/agent-rewards-v1-ui\?v=20261006-finance-workspace-v3-legacy-retired/);
  assert.match(adminHtml,/portal-admin-runtime-watchdog-v1\.js\?v=20261005-agent-rewards-owner-v1/);
  assert.match(retiredLegacy,/RETIRED_BY_FINANCE_WORKSPACE_V2/);
  assert.doesNotMatch(retiredLegacy,/MutationObserver|setInterval|Активные агенты|Закреплено клиентов|Реестр|agentRewardsFragment/);
});

test('Agent identity and reward authority are assignment-scoped',()=>{
  assert.match(migration,/join portal_private\.agent_persons ap/);
  assert.match(migration,/left join portal_private\.agent_legal_entities ale/);
  assert.match(migration,/distinct on \(t\.assignment_id,t\.deal_key\)/);
  assert.match(migration,/t\.assignment_id=s\.assignment_id and t\.deal_key=s\.deal_key/);
  assert.match(migration,/st\.agent_deal_term_key=t\.term_key/);
  assert.match(migration,/c\.assignment_id=s\.assignment_id and c\.deal_key=s\.deal_key/);
  assert.match(migration,/'assignmentId',x\.assignment_id/);
  assert.match(migration,/agent_reward_owner_corrections_v1\(\s*deal_key,assignment_id/s);
});
