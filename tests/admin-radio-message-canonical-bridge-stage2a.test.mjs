import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gitBlobSha=p=>{const bytes=readFileSync(new URL('../'+p,import.meta.url));return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')};

test('Stage 2A canonical MESSAGE bridge lives in the current Radio single owner',()=>{
  const radio=read('functions/portal/remaining-sections-ui.js');
  assert.match(radio,/RADIO_DIRECT_RENDER/);
  assert.match(radio,/STAGE_2A_MESSAGE_CANONICAL_BRIDGE_V2_CURRENT_OWNER/);
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
  assert.match(radio,/function radioHasRenderedRoot\(\)/);
  assert.match(radio,/syncAndRefreshMessageTargets/);
  assert.match(radio,/scope\.onchange=syncAndRefreshMessageTargets/);
  assert.match(radio,/kind\.onchange=syncAndRefreshMessageTargets/);
  assert.match(radio,/radioLoadCanonical\(true\)\.then\(result=>\{if\(result\.changed\)renderRadio\(\)\}\)/);
  assert.match(radio,/radioLoadCanonical\(false\)\.then\(result=>\{if\(result\.changed\)renderRadio\(\)\}\)/);
  assert.doesNotMatch(radio,/result\.changed&&p\?\.classList\.contains\('active'\)/);
  assert.doesNotMatch(radio,/scope\.value='CLIENT'/);
  assert.doesNotMatch(radio,/owner_radio_items/);
  assert.doesNotMatch(radio,/CREATE TABLE|create table/i);
});

test('Current Radio runtime preserves the established visual DOM while changing MESSAGE transport only',async()=>{
  const radio=read('functions/portal/remaining-sections-ui.js');
  for(const token of [
    "radio-command-bar",
    "radio-kpi-grid",
    "radio-workspace",
    "radio-compose-panel",
    "radio-compose-controls",
    "radio-link-panel",
    "radio-active-panel",
    "radio-active-list",
    "radio-active-row",
    "radio-send",
    "Активные сообщения"
  ]) assert.ok(radio.includes(token),`current Radio visual DOM token missing: ${token}`);

  const mod=await import('../functions/portal/remaining-sections-ui.js?radio-stage2a-current-owner='+Date.now());
  const response=await mod.onRequest();
  const script=await response.text();
  assert.match(script,/STAGE_2A_MESSAGE_CANONICAL_BRIDGE_V2_CURRENT_OWNER/);
  assert.match(script,/CLIENT_MESSAGE_SUBMIT/);
  assert.match(script,/\/v1\/admin\/client-intake\//);
  assert.match(script,/x-rona-client-source/);
  assert.match(script,/await post\('\/admin\/radio',\{kind:kind\.value/);
  assert.match(script,/radio-compose-panel/);
  assert.match(script,/radio-active-panel/);
  new Function(script);
});

test('Non-owner Admin main no longer carries a parallel Radio MESSAGE bridge',()=>{
  const main=read('functions/portal/admin-main-ui-current.js');
  assert.doesNotMatch(main,/patchAdminRadioMessageCanonicalBridgeV1/);
  assert.doesNotMatch(main,/ADMIN_RADIO_MESSAGE_CANONICAL_BRIDGE_VERSION/);
  assert.doesNotMatch(main,/x-rona-admin-radio-message/);
});

test('Backend preserves existing publish function and enforces source event/task + staff role authority',()=>{
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

test('Frozen Admin Radio polish and Client canonical message assets stay byte-for-byte unchanged',()=>{
  assert.equal(
    gitBlobSha('assets/portal-admin-radio-final-v9.js'),
    '89391945e49e49570e22e6cbfecd5a6e7e46b40c'
  );
  assert.equal(
    gitBlobSha('assets/portal-admin-radio-wide-v10.js'),
    '1e32655109534962580e96057def98208f69eaa4'
  );
  assert.equal(
    gitBlobSha('assets/portal-runtime/client-messages-archive-v1.js'),
    'f3c49ac46cc32ee0cd92eefadb905f8ac52778ca'
  );
});

test('MESSAGE cannot fall through to owner radio; NOTIFICATION and ANNOUNCEMENT keep legacy route',()=>{
  const radio=read('functions/portal/remaining-sections-ui.js');
  const branch=radio.indexOf("if(kind.value==='MESSAGE')");
  const legacyPost=radio.indexOf("await post('/admin/radio',{kind:kind.value",branch);
  assert.ok(branch>=0&&legacyPost>branch,'MESSAGE branch / legacy publication ordering missing');
  const segment=radio.slice(branch,legacyPost+120);
  assert.match(segment,/renderRadio\(\);return}await post\('\/admin\/radio'/);
  assert.match(radio,/NOTIFICATION/);
  assert.match(radio,/ANNOUNCEMENT/);
  const comm=read('supabase/functions/rona-portal-api/client-communications.ts');
  assert.doesNotMatch(comm,/owner_radio_items/);
  assert.doesNotMatch(comm,/NOTIFICATION/);
  assert.doesNotMatch(comm,/ANNOUNCEMENT/);
});
