import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gitBlobSha=p=>{const bytes=readFileSync(new URL('../'+p,import.meta.url));return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')};

test('Stage 2A canonical MESSAGE bridge lives in the actual production Radio owner',()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  assert.match(radio,/STAGE_2A_MESSAGE_CANONICAL_BRIDGE_V3_LIVE_OWNER/);
  assert.match(radio,/CLIENT_MESSAGE_SUBMIT/);
  assert.match(radio,/\/v1\/admin\/bootstrap/);
  assert.match(radio,/\/v1\/admin\/client-intake\//);
  assert.match(radio,/\/respond/);
  assert.match(radio,/source_task_id/);
  assert.match(radio,/if\(kind\.value==='MESSAGE'\)/);
  assert.match(radio,/await post\('\/admin\/radio',\{kind:kind\.value/);
  assert.match(radio,/\['MESSAGE','Сообщение'\],\['NOTIFICATION','Уведомление'\],\['ANNOUNCEMENT','Объявление'\]/);
  assert.match(radio,/\['ALL_CLIENTS','Все клиенты'\],\['CLIENT','Клиент'\],\['ALL_AGENTS','Все агенты'\],\['AGENT','Агент'\]/);
  assert.match(radio,/target\.disabled=scope\.value!=='CLIENT'/);
  assert.match(radio,/syncAndRefresh/);
  assert.match(radio,/radioLoadCanonical\(true\)/);
  assert.match(radio,/radioLoadCanonical\(false\)/);
  assert.doesNotMatch(radio,/scope\.value='CLIENT'/);
  assert.doesNotMatch(radio,/owner_radio_items/);
  assert.doesNotMatch(radio,/CREATE TABLE|create table/i);
});

test('Live Radio owner preserves the existing visual DOM and geometry',async()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  for(const token of [
    "root('radio','Радиорубка'",
    "rona-rs-form",
    "card('Новое сообщение'",
    "card('Активные сообщения'",
    "['Тип','Кому','Сообщение','Дата']"
  ]) assert.ok(radio.includes(token),`live Radio visual DOM token missing: ${token}`);

  const mod=await import('../functions/portal/remaining-sections-r2-base.js?radio-stage2a-live-owner='+Date.now());
  const response=await mod.onRequest();
  const script=await response.text();
  assert.match(script,/STAGE_2A_MESSAGE_CANONICAL_BRIDGE_V3_LIVE_OWNER/);
  assert.match(script,/CLIENT_MESSAGE_SUBMIT/);
  assert.match(script,/\/v1\/admin\/client-intake\//);
  assert.match(script,/ADMIN_RADIO_MESSAGE_STAGE2A_LIVE_OWNER/);
  assert.match(script,/await post\('\/admin\/radio',\{kind:kind\.value/);
  assert.match(script,/rona-rs-form/);
  assert.match(script,/Активные сообщения/);
  new Function(script);
});

test('Non-live wrappers do not define the production authority for this test',()=>{
  const main=read('functions/portal/admin-main-ui-current.js');
  assert.doesNotMatch(main,/patchAdminRadioMessageCanonicalBridgeV1/);
  assert.doesNotMatch(main,/ADMIN_RADIO_MESSAGE_CANONICAL_BRIDGE_VERSION/);
  assert.doesNotMatch(main,/x-rona-admin-radio-message/);
});

test('Backend preserves existing publish function and exact event task staff authority',()=>{
  const source=read('supabase/functions/rona-portal-api/client-communications.ts');
  const migration=read('supabase/migrations/20260922211500_admin_radio_message_response_prepare_v1.sql');
  assert.match(source,/server_admin_radio_prepare_client_response_v1/);
  assert.match(source,/server_admin_publish_client_response/);
  assert.doesNotMatch(source,/staff_task_messages/);
  assert.match(migration,/ev\.event_type\s*<>\s*'CLIENT_MESSAGE_SUBMIT'/);
  assert.match(migration,/t\.task_id=p_source_task_id/);
  assert.match(migration,/r\.user_id=p_actor/);
  assert.match(migration,/r\.functional_role=v_role/);
  assert.match(migration,/r\.status='ACTIVE'/);
  assert.match(migration,/task\.assigned_user_id is not null and task\.assigned_user_id<>p_actor/);
  assert.match(migration,/insert into portal_private\.staff_task_messages/);
  assert.match(migration,/revoke all on function portal_private\.server_admin_radio_prepare_client_response_v1/);
  assert.match(migration,/to service_role/);
});

test('Frozen Admin Radio polish and Client canonical assets remain byte-for-byte unchanged',()=>{
  assert.equal(gitBlobSha('assets/portal-admin-radio-final-v9.js'),'89391945e49e49570e22e6cbfecd5a6e7e46b40c');
  assert.equal(gitBlobSha('assets/portal-admin-radio-wide-v10.js'),'1e32655109534962580e96057def98208f69eaa4');
  assert.equal(gitBlobSha('assets/portal-runtime/client-messages-archive-v1.js'),'f3c49ac46cc32ee0cd92eefadb905f8ac52778ca');
});

test('MESSAGE cannot fall through to owner radio; NOTIFICATION and ANNOUNCEMENT keep legacy route',()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  const branch=radio.indexOf("if(kind.value==='MESSAGE')");
  const legacyPost=radio.indexOf("await post('/admin/radio',{kind:kind.value",branch);
  assert.ok(branch>=0&&legacyPost>branch,'MESSAGE branch / legacy publication ordering missing');
  const segment=radio.slice(branch,legacyPost+140);
  assert.match(segment,/renderRadio\(\);return}await post\('\/admin\/radio'/);
  assert.match(radio,/NOTIFICATION/);
  assert.match(radio,/ANNOUNCEMENT/);
  const comm=read('supabase/functions/rona-portal-api/client-communications.ts');
  assert.doesNotMatch(comm,/owner_radio_items/);
  assert.doesNotMatch(comm,/NOTIFICATION/);
  assert.doesNotMatch(comm,/ANNOUNCEMENT/);
});
