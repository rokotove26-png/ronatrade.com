import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { patchAdminOperationsCommandCenterV6 } from '../functions/portal/admin-operations-command-center-v6.js';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Operational Center action KPIs exclude historical technical backlog and passive payment monitoring', () => {
  const ui = patchAdminOperationsCommandCenterV6('function renderAdminHome(){}\nfunction renderPrices(){}');

  assert.doesNotMatch(ui, /queueRows\.length\+Number\(opsMetrics\.attention_total/);
  assert.match(ui, /if\(t==='AI_RUNTIME'\)return false/);
  assert.match(ui, /t==='FINANCE_MATERIALIZER'&&!\['CRITICAL','ERROR'\]\.includes\(sev\)/);
  assert.match(ui, /ronaFdV5Key\(r\?\.mode\)!=='DISABLED'/);
  assert.match(ui, /const dealActionRows=activeDeals\.filter\(x=>x\?\.current_action_required===true\)/);
  assert.match(ui, /const attentionCount=conflicts\.length\+attentionApps\.length\+dealActionRows\.length\+waitingWagons\.length\+uncheckedDocs\.length\+opsTasks\.length\+actionableReverse\.length\+materializerIssueCount\+railIssueCount/);
  assert.doesNotMatch(ui, /const attentionCount=.*paymentControl\.length/);
});

test('Admin bootstrap compatibility boundary publishes current-actionable KPI scope', () => {
  const boundary = read('supabase/functions/rona-owner-acceptance/application-owner-boundary-bootstrap-v3.ts');

  assert.match(boundary, /CURRENT_ACTIONABLE_V1/);
  assert.match(boundary, /ai_history_excluded_from_action_kpi: true/);
  assert.match(boundary, /terminal_denials_excluded_from_action_kpi: true/);
  assert.match(boundary, /intentional_disabled_providers_excluded_from_action_kpi: true/);
  assert.match(boundary, /if \(type === "AI_RUNTIME"\) return false/);
  assert.match(boundary, /if \(upper\(runtime\?\.mode\) === "DISABLED"\) return false/);
});
