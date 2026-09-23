import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gitBlobSha=p=>{const bytes=readFileSync(new URL('../'+p,import.meta.url));return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')};

test('Stage 2A corrective lives in the actual production Radio owner',()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  assert.match(radio,/STAGE_2A_CORRECTIVE_CLIENT_CHAT_V1_LIVE_OWNER/);
  assert.match(radio,/radio_clients/);
  assert.match(radio,/radio_messages/);
  assert.match(radio,/radioCanonicalClients/);
  assert.match(radio,/legal_name/);
  assert.match(radio,/client_id/);
  assert.match(radio,/\/v1\/admin\/radio\/messages/);
  assert.match(radio,/\/v1\/admin\/client-intake\//);
  assert.match(radio,/source_task_id/);
  assert.doesNotMatch(radio,/radioCanonicalOptionText/);
  assert.doesNotMatch(radio,/new Option\([^)]*\.event_id\s*,/);
  assert.doesNotMatch(radio,/owner_radio_items/);
  assert.doesNotMatch(radio,/CREATE TABLE|create table/i);
});

test('Radio MESSAGE selector is client/company semantic and legacy publication is not used for MESSAGE',()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  assert.match(radio,/radioCanonicalClients\(\)\.forEach/);
  assert.match(radio,/radioCanonicalClientText/);
  assert.match(radio,/String\(x\?\.client_id\|\|''\)/);
  assert.match(radio,/if\(kind\.value==='MESSAGE'\)/);
  const branch=radio.indexOf("if(kind.value==='MESSAGE')");
  const legacyPost=radio.indexOf("await post('/admin/radio',{kind:kind.value",branch);
  assert.ok(branch>=0&&legacyPost>branch,'MESSAGE branch / legacy publication ordering missing');
  assert.match(radio.slice(branch,legacyPost+160),/renderRadio\(\);return}await post\('\/admin\/radio'/);
});

test('Radio history and KPI consume chat-only projection',()=>{
  const admin=read('supabase/functions/rona-portal-api/admin.ts');
  assert.match(admin,/authority_domain='CLIENT_COMMUNICATION'/);
  assert.match(admin,/authority_target_type='MESSAGE'/);
  assert.match(admin,/ADMIN_CLIENT_MESSAGE_SUBMIT/);
  assert.match(admin,/CLIENT_MESSAGE_SUBMIT/);
  assert.match(admin,/radio_chat_projection_contract:"RADIO_CHAT_MESSAGE_V1"/);
  assert.match(admin,/radio_clients:radioClients/);
  assert.match(admin,/radio_messages:radioMessages/);
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  assert.match(radio,/const legacy=Array\.isArray\(d\.radio\)/);
  assert.match(radio,/filter\(x=>String\(x\?\.item_kind\|\|''\)\.toUpperCase\(\)!=='MESSAGE'\)/);
  assert.match(radio,/kpi\('Сообщения',count\('MESSAGE'\)/);
});

test('Client chat is company-scoped, positive-discriminator based, and keeps existing response authority',()=>{
  const source=read('supabase/functions/rona-portal-api/client-communications.ts');
  assert.match(source,/authority_domain='CLIENT_COMMUNICATION'/);
  assert.match(source,/authority_target_type='MESSAGE'/);
  assert.match(source,/event_type in \('CLIENT_MESSAGE_SUBMIT','ADMIN_CLIENT_MESSAGE_SUBMIT'\)/);
  assert.doesNotMatch(source,/and e\.actor_user_id=\$\{c\.user\}::uuid[\s\S]*?and e\.event_type in \('CLIENT_MESSAGE_SUBMIT','ADMIN_CLIENT_MESSAGE_SUBMIT'\)/);
  assert.match(source,/client_user_has_archive_contract_access/);
  assert.match(source,/server_admin_radio_prepare_client_response_v1/);
  assert.match(source,/server_admin_publish_client_response/);
  assert.match(source,/server_admin_submit_radio_message_v1/);
  assert.match(source,/server_admin_retire_radio_qa_artifacts_v1/);
});

test('Corrective migration creates no third message store and preserves audit history',()=>{
  const migration=read('supabase/migrations/20260923124000_admin_radio_stage2a_corrective_client_semantics_v1.sql');
  assert.match(migration,/server_admin_submit_radio_message_v1/);
  assert.match(migration,/ADMIN_CLIENT_MESSAGE_SUBMIT/);
  assert.match(migration,/CLIENT_COMMUNICATION/);
  assert.match(migration,/thread_scope','CLIENT_COMPANY'/);
  assert.match(migration,/server_admin_retire_radio_qa_artifacts_v1/);
  assert.match(migration,/lifecycle_state='ARCHIVED'/);
  assert.match(migration,/qa_only=true/);
  assert.match(migration,/source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'/);
  assert.doesNotMatch(migration,/delete\s+from\s+portal_private\.portal_reverse_events/i);
  assert.doesNotMatch(migration,/create\s+table/i);
  assert.match(migration,/revoke all on function portal_private\.server_admin_submit_radio_message_v1/);
  assert.match(migration,/revoke all on function portal_private\.server_admin_retire_radio_qa_artifacts_v1/);
});

test('Server-side recipient authority rejects non-current/non-deliverable contexts',()=>{
  const migration=read('supabase/migrations/20260923124000_admin_radio_stage2a_corrective_client_semantics_v1.sql');
  for(const token of [
    "cl.lifecycle_state='ACTIVE'",
    "cl.authority_state in",
    "ct.contract_status='ACTIVE'",
    "ct.lifecycle_state='ACTIVE'",
    "ct.signed_contract_confirmed_at is not null",
    "b.status='ACTIVE'",
    "pu.status='ACTIVE'",
    "pr.role='CLIENT'"
  ]) assert.ok(migration.includes(token),`recipient authority token missing: ${token}`);
  assert.match(migration,/reply target is not an active client radio message/);
});

test('Live Radio visual DOM geometry tokens remain unchanged',async()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  for(const token of [
    "root('radio','Радиорубка'",
    "rona-rs-form",
    "card('Новое сообщение'",
    "card('Активные сообщения'",
    "['Тип','Кому','Сообщение','Дата']"
  ]) assert.ok(radio.includes(token),`live Radio visual DOM token missing: ${token}`);
  const mod=await import('../functions/portal/remaining-sections-r2-base.js?radio-stage2a-corrective='+Date.now());
  const response=await mod.onRequest();
  const script=await response.text();
  assert.match(script,/STAGE_2A_CORRECTIVE_CLIENT_CHAT_V1_LIVE_OWNER/);
  assert.match(script,/rona-rs-form/);
  assert.match(script,/Активные сообщения/);
  new Function(script);
});

test('Frozen Admin Radio polish assets remain byte-for-byte unchanged',()=>{
  assert.equal(gitBlobSha('assets/portal-admin-radio-final-v9.js'),'89391945e49e49570e22e6cbfecd5a6e7e46b40c');
  assert.equal(gitBlobSha('assets/portal-admin-radio-wide-v10.js'),'1e32655109534962580e96057def98208f69eaa4');
});

test('Frozen Client Messages visual/runtime asset remains byte-for-byte unchanged',()=>{
  assert.equal(gitBlobSha('assets/portal-runtime/client-messages-archive-v1.js'),'f3c49ac46cc32ee0cd92eefadb905f8ac52778ca');
});
