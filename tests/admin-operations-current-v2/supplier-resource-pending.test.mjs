import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest as adminMain} from '../../functions/portal/admin-main-ui-current.js';
import {patchAdminOperationsEventRuntimeV12} from '../../functions/portal/main-ui/operations-event-runtime-v12.js';
import {patchAdminSupplierResourceV1} from '../../functions/portal/main-ui/operations-resource-pending-v1.js';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261019101700_operations_supplier_resource_pending_kpi.sql');

test('Supplier decision authority precedes client commercial stage',()=>{
  assert.match(migration,/join portal_private\.owner_application_workflow w on w\.application_key=a\.id/);
  assert.match(migration,/w\.business_status='SUPPLIER_PENDING'/);
  assert.match(migration,/w\.supplier_approved_at is null/);
  assert.match(migration,/a\.linked_deal_key is null/);
  assert.match(migration,/needs_stage_semantics_review/);
});

test('Operations V2 read model separates resource queue from technical failures',()=>{
  assert.match(migration,/'supplierResourcePending'/);
  assert.match(migration,/'supplierResourceStageConflict'/);
  assert.match(migration,/'failedPortalEvents'/);
  assert.match(migration,/'supplierResourceQueue'/);
  assert.match(migration,/'supplierResourceAuthority','OWNER_APPLICATION_WORKFLOW'/);
  assert.match(migration,/ev\.event_type='CLIENT_MESSAGE_SUBMIT'/);
});

test('Canonical V10 source is not changed: UI changes only in post-V12 overlay',()=>{
  const canonical=read('functions/portal/admin-operations-command-center-v10-clean.js');
  const middleware=read('functions/portal/main-ui/_middleware.js');
  assert.doesNotMatch(canonical,/supplierPendingN|gauge\('RES-03'/);
  assert.match(canonical,/gauge\('CAUT-03','Требует действия'/);
  assert.match(canonical,/gauge\('WARN-06','Критические события'/);
  assert.match(middleware,/patched=patchAdminOperationsEventRuntimeV12\(patched\)/);
  assert.match(middleware,/patched=patchAdminSupplierResourceV1\(patched\)/);
  assert.match(middleware,/x-rona-resource-kpi/);
});

test('Post-V12 browser script compiles with 5-queue gauge and existing critical gauge',async()=>{
  const original=await(await adminMain()).text();
  assert.throws(()=>patchAdminSupplierResourceV1(original),/OPS_SUPPLIER_RESOURCE_V1_OWNER_SOURCE_REQUIRED/);
  const v12=patchAdminOperationsEventRuntimeV12(original);
  const current=patchAdminSupplierResourceV1(v12);
  new Function(current);
  assert.equal((current.match(/function renderAdminHome\(\)/g)||[]).length,1);
  assert.match(current,/supplierPendingN=num\('supplierResourcePending'\)/);
  assert.match(current,/failedPortalN=num\('failedPortalEvents'\)/);
  assert.match(current,/gauge\('RES-03','Ожидают ресурс',supplierPendingN/);
  assert.match(current,/gauge\('WARN-06','Критические события',criticalN/);
  assert.match(current,/gauge\('CAUT-03','Непросмотренные',unseenN/);
  assert.doesNotMatch(current,/gauge\('CAUT-03','Требует действия'/);
  assert.match(current,/code==='WARN-06'\?ronaOpsV10OpenAttention\(\)/);
  assert.match(current,/Ресурс ожидают: '\+supplierPendingN/);
  assert.match(current,/Сбои отправки клиентских запросов: '\+String\(failedPortalN\)/);
  assert.match(current,/__RONA_ADMIN_OPERATIONS_RESOURCE_PENDING__/);
  assert.throws(()=>patchAdminSupplierResourceV1(current),/OPS_SUPPLIER_RESOURCE_V1_DUPLICATE_PATCH/);
});

test('No business-status, deal or supplier-approval write introduced',()=>{
  assert.doesNotMatch(migration,/update\s+portal_private\.client_applications\s+set/i);
  assert.doesNotMatch(migration,/update\s+portal_private\.owner_application_workflow\s+set/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.staff_tasks/i);
  assert.doesNotMatch(migration,/supplier_approved_at\s*=\s*now\(\)/i);
  assert.doesNotMatch(read('functions/portal/main-ui/operations-resource-pending-v1.js'),/supplierPendingN\s*=\s*5/);
});
