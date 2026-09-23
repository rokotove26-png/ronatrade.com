import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gitBlobSha=p=>{const bytes=readFileSync(new URL('../'+p,import.meta.url));return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')};

test('Stage 2B keeps MESSAGE on the canonical chat path and narrows owner radio writes',()=>{
  const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
  assert.match(owner,/if\(kind==='MESSAGE'\)throw Object\.assign\(new Error\('RADIO_MESSAGE_CANONICAL_ROUTE_REQUIRED'\)/);
  assert.match(owner,/\['NOTIFICATION','ANNOUNCEMENT'\]\.includes\(kind\)/);
  assert.match(owner,/validateRadioPublicationTarget\(scope,targetId\)/);
  assert.match(owner,/RADIO_CLIENT_TARGET_NOT_CURRENT/);
  assert.match(owner,/RADIO_AGENT_TARGET_NOT_CURRENT/);
  assert.match(owner,/delivery_channel,body_text,created_by/);
  assert.match(owner,/'ADMIN_PORTAL_RADIO_STAGE2B'/);
  assert.match(owner,/idempotency_key/);
  assert.match(owner,/OWNER_RADIO_\$\{kind\}_CREATED/);
  assert.doesNotMatch(owner,/\['MESSAGE','NOTIFICATION','ANNOUNCEMENT'\]\.includes\(kind\)/);
});

test('Client and Agent publication reads exclude legacy MESSAGE rows',()=>{
  const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
  const filtered=(owner.match(/item_kind in \('NOTIFICATION','ANNOUNCEMENT'\)/g)||[]).length;
  assert.ok(filtered>=3,`expected Admin, Client, Agent broadcast filters; found ${filtered}`);
  assert.match(owner,/target_scope='ALL_CLIENTS'/);
  assert.match(owner,/target_scope='CLIENT'/);
  assert.match(owner,/target_scope='ALL_AGENTS'/);
  assert.match(owner,/target_scope='AGENT'/);
});

test('Stage 2B provides audit-safe expiry instead of deleting radio evidence',()=>{
  const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
  assert.match(owner,/async function expireRadio/);
  assert.match(owner,/OWNER_RADIO_ITEM_EXPIRED/);
  assert.match(owner,/active_until=case when active_until is null or active_until>now\(\) then now\(\)/);
  assert.ok(owner.includes("m=path.match(/^\\/admin\\/radio\\/([0-9a-f-]+)\\/expire$/i)"),'expire route missing');
  assert.doesNotMatch(owner,/delete\s+from\s+portal_private\.owner_radio_items/i);
});

test('Stage 2B schema adds only publication lineage and idempotency controls',()=>{
  const migration=read('supabase/migrations/20260923164500_admin_radio_stage2b_notification_announcement_v1.sql');
  for(const token of [
    'idempotency_key text null',
    'request_id uuid null',
    'correlation_id uuid null',
    'owner_radio_items_actor_idempotency_uq',
    'owner_radio_items_active_window_check',
    'revoke all on portal_private.owner_radio_items from anon, authenticated'
  ]) assert.ok(migration.includes(token),`migration token missing: ${token}`);
  assert.doesNotMatch(migration,/delete\s+from/i);
  assert.doesNotMatch(migration,/update\s+portal_private\.owner_radio_items/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.owner_radio_items/i);
});

test('Dedicated Radio bootstrap contains chat plus current broadcast/audience projections',()=>{
  const admin=read('supabase/functions/rona-portal-api/admin.ts');
  assert.match(admin,/async function adminRadioAudienceClients\(\)/);
  assert.match(admin,/async function adminRadioAudienceAgents\(\)/);
  assert.match(admin,/async function adminRadioBroadcasts\(\)/);
  assert.match(admin,/item_kind in \('NOTIFICATION','ANNOUNCEMENT'\)/);
  assert.match(admin,/radio_audience_clients:radioAudienceClients/);
  assert.match(admin,/radio_audience_agents:radioAudienceAgents/);
  assert.match(admin,/radio_broadcasts:radioBroadcasts/);
  assert.match(admin,/radio_broadcast_projection_contract:"RADIO_NOTIFICATION_ANNOUNCEMENT_V1"/);
  assert.match(admin,/radio_chat_projection_contract:"RADIO_CHAT_MESSAGE_V1"/);
});

test('Admin Radio static owner uses canonical broadcast projection without changing visual geometry',()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  assert.match(radio,/STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_STATIC_OWNER/);
  assert.match(radio,/STAGE_2B_NOTIFICATION_ANNOUNCEMENT_V1_STATIC_OWNER/);
  assert.match(radio,/ADMIN_RADIO_STAGE2B_STATIC_OWNER_V1/);
  assert.match(radio,/radioCanonicalBroadcasts/);
  assert.match(radio,/radioCanonicalAudienceClients/);
  assert.match(radio,/radioCanonicalAudienceAgents/);
  assert.match(radio,/radio_broadcasts/);
  assert.match(radio,/radio_audience_clients/);
  assert.match(radio,/radio_audience_agents/);
  assert.match(radio,/idempotencyKey/);
  assert.match(radio,/await post\('\/admin\/radio'/);
  assert.match(radio,/activeRows=\[\.\.\.canonicalRows,\.\.\.broadcastRows\]/);
  for(const token of [
    "root('radio','Радиорубка'",
    "el('div','rona-rs-form')",
    "card('Новое сообщение'",
    "card('Активные сообщения'",
    "['Тип','Кому','Сообщение','Дата']"
  ]) assert.ok(radio.includes(token),`Radio visual structure token missing: ${token}`);
});

test('Static materializer cannot silently regress Stage 2B owner',()=>{
  const build=read('scripts/materialize-admin-current-modules.mjs');
  for(const token of [
    'STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_STATIC_OWNER',
    'STAGE_2B_NOTIFICATION_ANNOUNCEMENT_V1_STATIC_OWNER',
    'ADMIN_RADIO_STAGE2B_STATIC_OWNER_V1',
    'radio_broadcasts',
    'radio_audience_clients',
    'radio_audience_agents'
  ]) assert.ok(build.includes(token),`materializer token missing: ${token}`);
  assert.match(build,/STATIC_RADIO_STALE_OWNER_MARKER/);
});

test('Frozen Radio visual assets remain byte-for-byte unchanged',()=>{
  assert.equal(gitBlobSha('assets/portal-admin-radio-final-v9.js'),'89391945e49e49570e22e6cbfecd5a6e7e46b40c');
  assert.equal(gitBlobSha('assets/portal-admin-radio-wide-v10.js'),'1e32655109534962580e96057def98208f69eaa4');
});
