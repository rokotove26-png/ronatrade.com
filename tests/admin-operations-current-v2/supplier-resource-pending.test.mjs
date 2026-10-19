import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui=readFileSync(new URL('../../functions/portal/admin-operations-command-center-v10-clean.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../../supabase/migrations/20261019101700_operations_supplier_resource_pending_kpi.sql',import.meta.url),'utf8');

test('Operations uses supplier authority not accepted client status for pending resource',()=>{
  assert.match(migration,/join portal_private\.owner_application_workflow w on w\.application_key=a\.id/);
  assert.match(migration,/w\.business_status='SUPPLIER_PENDING'/);
  assert.match(migration,/w\.supplier_approved_at is null/);
  assert.match(migration,/a\.linked_deal_key is null/);
  assert.match(migration,/needs_stage_semantics_review/);
});

test('read model delivers separate resource and failed-portal counters',()=>{
  assert.match(migration,/'supplierResourcePending'/);
  assert.match(migration,/'supplierResourceStageConflict'/);
  assert.match(migration,/'failedPortalEvents'/);
  assert.match(migration,/'supplierResourceQueue'/);
  assert.match(migration,/'supplierResourceAuthority','OWNER_APPLICATION_WORKFLOW'/);
  assert.match(migration,/ev\.event_type='CLIENT_MESSAGE_SUBMIT'/);
});

test('Flightdeck displays supplier pending separately from the existing critical KPI',()=>{
  assert.match(ui,/supplierPendingN=num\('supplierResourcePending'\)/);
  assert.match(ui,/supplierConflictN=num\('supplierResourceStageConflict'\)/);
  assert.match(ui,/failedPortalN=num\('failedPortalEvents'\)/);
  assert.match(ui,/gauge\('RES-03','Ожидают ресурс',supplierPendingN/);
  assert.match(ui,/gauge\('WARN-06','Критические события',criticalN/);
  assert.match(ui,/gauge\('CAUT-03','Требует действия',unseenN/);
  assert.match(ui,/code==='WARN-06'\?ronaOpsV10OpenAttention\(\)/);
  assert.match(ui,/Ресурс ожидают: '\+supplierPendingN/);
  assert.match(ui,/Сбои отправки клиентских запросов: '\+String\(failedPortalN\)/);
  assert.match(ui,/__RONA_ADMIN_OPERATIONS_RESOURCE_PENDING__/);
});

test('Source-only update cannot approve resource or rewrite business status',()=>{
  assert.doesNotMatch(migration,/update\s+portal_private\.client_applications\s+set/i);
  assert.doesNotMatch(migration,/update\s+portal_private\.owner_application_workflow\s+set/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.staff_tasks/i);
  assert.doesNotMatch(migration,/supplier_approved_at\s*=\s*now\(\)/i);
  assert.doesNotMatch(ui,/supplierPendingN\s*=\s*5/);
});
