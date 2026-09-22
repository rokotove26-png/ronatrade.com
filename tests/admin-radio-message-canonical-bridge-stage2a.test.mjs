import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sha256=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');

test('Stage 2A bridges only MESSAGE to canonical Client intake and response routes',()=>{
  const bridge=read('functions/portal/admin-radio-message-canonical-bridge-v1.js');
  assert.match(bridge,/CLIENT_MESSAGE_SUBMIT/);
  assert.match(bridge,/\/v1\/admin\/bootstrap/);
  assert.match(bridge,/\/v1\/admin\/client-intake\//);
  assert.match(bridge,/\/respond/);
  assert.match(bridge,/source_task_id/);
  assert.match(bridge,/if\(kind\.value==='MESSAGE'\)/);
  assert.match(bridge,/await post\('\/admin\/radio',\{kind:kind\.value/);
  assert.match(bridge,/\['MESSAGE','Сообщение'\],\['NOTIFICATION','Уведомление'\],\['ANNOUNCEMENT','Объявление'\]/);
  assert.doesNotMatch(bridge,/document\.createElement\(['"]style/);
  assert.doesNotMatch(bridge,/owner_radio_items/);
  assert.doesNotMatch(bridge,/CREATE TABLE|create table/i);
});

test('Admin runtime activates the MESSAGE bridge without changing Radio visual asset',async()=>{
  const main=read('functions/portal/admin-main-ui-current.js');
  assert.match(main,/patchAdminRadioMessageCanonicalBridgeV1/);
  assert.match(main,/x-rona-admin-radio-message/);
  const mod=await import('../functions/portal/admin-main-ui-current.js?radio-stage2a='+Date.now());
  const response=await mod.onRequest();
  const script=await response.text();
  assert.match(script,/STAGE_2A_MESSAGE_CANONICAL_BRIDGE_V1/);
  assert.match(script,/CLIENT_MESSAGE_SUBMIT/);
  assert.match(script,/\/v1\/admin\/client-intake\//);
  assert.match(script,/await post\('\/admin\/radio',\{kind:kind\.value/);
  assert.match(script,/class:'rona-owner-form'/);
  assert.match(script,/class:'rona-owner-section-title',text:'Активные сообщения'/);
  assert.match(script,/tbl\(\['Тип','Кому','Сообщение','Дата'\]/);
  new Function(script);
});

test('Backend preserves existing publish function and enforces source event/task + staff role authority',()=>{
  const source=read('supabase/functions/rona-portal-api/client-communications.ts');
  assert.match(source,/ensureAdminCanonicalStaffResponse/);
  assert.match(source,/e\.event_type='CLIENT_MESSAGE_SUBMIT'/);
  assert.match(source,/t\.task_id=\$\{sourceTaskId\}/);
  assert.match(source,/r\.user_id=\$\{c\.user\}::uuid/);
  assert.match(source,/r\.functional_role::text=\$\{role\}/);
  assert.match(source,/r\.status='ACTIVE'/);
  assert.match(source,/insert into portal_private\.staff_task_messages/);
  assert.match(source,/server_admin_publish_client_response/);
  assert.match(source,/client response already published|already published/);
});

test('Client canonical message runtime stays byte-for-byte frozen',()=>{
  assert.equal(
    sha256('assets/portal-runtime/client-messages-archive-v1.js'),
    'f3c49ac46cc32ee0cd92eefadb905f8ac52778ca'
  );
});

test('Stage 2A contains no NOTIFICATION or ANNOUNCEMENT backend rewrite',()=>{
  const bridge=read('functions/portal/admin-radio-message-canonical-bridge-v1.js');
  const comm=read('supabase/functions/rona-portal-api/client-communications.ts');
  assert.match(bridge,/NOTIFICATION/);
  assert.match(bridge,/ANNOUNCEMENT/);
  assert.doesNotMatch(comm,/owner_radio_items/);
  assert.doesNotMatch(comm,/NOTIFICATION/);
  assert.doesNotMatch(comm,/ANNOUNCEMENT/);
});
