import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Stage 2C.1 keeps MESSAGE canonical and restricts NOTIFICATION to client audiences',()=>{
  const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
  assert.match(owner,/if\(kind==='MESSAGE'\)throw Object\.assign\(new Error\('RADIO_MESSAGE_CANONICAL_ROUTE_REQUIRED'\)/);
  assert.match(owner,/kind==='NOTIFICATION'&&!\['CLIENT','ALL_CLIENTS'\]\.includes\(scope\)/);
  assert.match(owner,/RADIO_NOTIFICATION_CLIENT_SCOPE_REQUIRED/);
  assert.match(owner,/\['NOTIFICATION','ANNOUNCEMENT'\]\.includes\(kind\)/);
});

test('Agent broadcast projection is binding-scoped and supports ALL_AGENTS without requiring a client assignment',()=>{
  const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
  const start=owner.indexOf('async function agentBootstrap(ctx)');
  const end=owner.indexOf('function ascii(',start);
  assert.ok(start>=0&&end>start,'agentBootstrap block missing');
  const block=owner.slice(start,end);
  assert.match(block,/from portal_private\.agent_user_bindings aub/);
  assert.match(block,/const identities=await sql/);
  assert.match(block,/const radio=ids\.length\?await sql/);
  assert.match(block,/item_kind='ANNOUNCEMENT'/);
  assert.match(block,/target_scope='ALL_AGENTS'/);
  assert.match(block,/target_scope='AGENT'/);
  assert.ok(block.indexOf('const radio=')<block.indexOf("if(!keys.length)return"),'ALL_AGENTS projection must be resolved before empty client-assignment return');
});

test('Admin Radio has one canonical owner with frozen visual geometry and Stage 2C.1 broadcast data',()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  const wrapper=read('functions/portal/remaining-sections-ui.js');
  for(const token of [
    "STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_STATIC_OWNER",
    "STAGE_2A_OPERATIONAL_CLIENT_AGENT_MESSAGE_V1",
    "STAGE_2B_NOTIFICATION_ANNOUNCEMENT_V1_STATIC_OWNER",
    "NOTIFICATION_MODAL_ANNOUNCEMENT_TICKER_V1",
    'radioCanonicalBroadcasts',
    'radioCanonicalAudienceClients',
    'radioCanonicalAudienceAgents',
    'radio_broadcasts',
    'radio_audience_clients',
    'radio_audience_agents',
    "radioCanonicalRequest('/v1/admin/radio/agent-messages'",
    "await post('/admin/radio',{kind:kind.value,scope:scope.value,targetId,body:body.value.trim(),idempotencyKey})",
    "kind.value==='NOTIFICATION'?['CLIENT','ALL_CLIENTS']",
    "classList.add('radio-kpi-grid')",
    "el('div','radio-workspace')",
    "el('section','radio-active-panel')"
  ]) assert.ok(radio.includes(token),'Stage 2C.1 canonical Radio marker missing: '+token);
  assert.doesNotMatch(wrapper,/RADIO_DIRECT_RENDER/);
  assert.doesNotMatch(wrapper,/RADIO_DIRECT_RENDER_SOURCE_MISMATCH/);
  assert.doesNotMatch(radio,/const legacy=Array\.isArray\(d\.radio\)/);
});

test('Client and Agent portal runtime presents central notification modal and top running ticker from server-isolated owner projection',()=>{
  const runtime=read('assets/portal-runtime/portal-radio-broadcast-v1.js');
  for(const token of [
    "role=location.pathname==='/portal/agent'?'AGENT':(location.pathname==='/portal/client'?'CLIENT':'')",
    "role==='CLIENT'?'/client/bootstrap':'/agent/bootstrap'",
    "id='ronaRadioAnnouncementTicker'",
    "id='ronaRadioNotificationOverlay'",
    "animation:ronaRadioTickerRun",
    "if(role!=='CLIENT')",
    "upper(x?.item_kind)==='ANNOUNCEMENT'",
    "upper(x?.item_kind)==='NOTIFICATION'",
    "credentials:'same-origin'",
    'POLL_MS=30000'
  ]) assert.ok(runtime.includes(token),'Portal runtime marker missing: '+token);
  assert.doesNotMatch(runtime,/\/portal\/api\/v1\/client\/bootstrap/);
  assert.doesNotMatch(runtime,/DELETE|delete\s+from/i);
});

test('Portal shell injects Stage 2C.1 broadcast runtime for real Client and Agent sessions without rewriting the canonical Client artifact',()=>{
  const shell=read('functions/portal/[[path]].js');
  assert.match(shell,/const RADIO_BROADCAST_RUNTIME = '<script id="rona-portal-radio-broadcast-v1"/);
  assert.match(shell,/clientPresence\+RADIO_BROADCAST_RUNTIME/);
  assert.match(shell,/AGENT_BRIDGE\+agentPresence\+RADIO_BROADCAST_RUNTIME/);
  assert.match(shell,/AGENT_BRIDGE\+RADIO_BROADCAST_RUNTIME/);
  assert.match(shell,/x-rona-client-impersonation-shell/);
  assert.match(shell,/static-unmodified-v1/);
});

test('Stage 2C.1 does not mutate frozen Client message or Admin Radio visual assets',()=>{
  const stage2b=read('tests/admin-radio-stage2b-notification-announcement.test.mjs');
  assert.match(stage2b,/client-messages-archive-v1\.js/);
  assert.match(stage2b,/portal-admin-radio-final-v9\.js/);
  assert.match(stage2b,/portal-admin-radio-wide-v10\.js/);
});
