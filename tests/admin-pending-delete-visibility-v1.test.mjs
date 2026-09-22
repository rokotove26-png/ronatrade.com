import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('functions/portal/clients-agents-current-ui.js','utf8');
const control=fs.readFileSync('supabase/functions/rona-admin-control-plane/index.ts','utf8');

test('Access tab survives reload for users and history views',()=>{
  assert.ok(ui.includes("new Set(['companies','agents','users','history'])"));
  assert.ok(ui.includes("u.searchParams.set('accessView',v)"));
  assert.ok(ui.includes("history.replaceState(history.state,'',u)"));
});

test('failed Auth deletion remains visible and retryable',()=>{
  for(const marker of [
    "u?.deletionPending===true",
    "'Повторить удаление'",
    "'Удаление не завершено'",
    "operation will delete remaining Auth"
  ]) {
    if(marker==='operation will delete remaining Auth') continue;
    assert.ok(ui.includes(marker),marker);
  }
  assert.ok(ui.includes("Доступ уже отозван; операция удалит оставшуюся Auth-учётную запись"));
});

test('control-plane fallback read model includes deletion-pending tombstones',()=>{
  for(const marker of [
    "PORTAL_USER_DELETE_AUTH_FAILED_BY_ADMIN",
    "PORTAL_USER_DELETED_BY_ADMIN",
    "deletion_pending",
    "deletionPending: u.deletion_pending === true",
    "coalesce(pd.deletion_pending,false)"
  ]) assert.ok(control.includes(marker),marker);
});
