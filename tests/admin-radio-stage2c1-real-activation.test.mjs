import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gitBlobSha=p=>{const bytes=readFileSync(new URL('../'+p,import.meta.url));return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')};

test('Stage 2C.1 keeps MESSAGE canonical and restricts NOTIFICATION to client audiences',()=>{
  const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
  assert.match(owner,/if\(kind==='MESSAGE'\)throw Object\.assign\(new Error\('RADIO_MESSAGE_CANONICAL_ROUTE_REQUIRED'\)/);
  assert.match(owner,/kind==='NOTIFICATION'&&!\['CLIENT','ALL_CLIENTS'\]\.includes\(scope\)/);
  assert.match(owner,/RADIO_NOTIFICATION_CLIENT_SCOPE_REQUIRED/);
  assert.match(owner,/\['NOTIFICATION','ANNOUNCEMENT'\]\.includes\(kind\)/);
});

test('Recipient broadcast projections are lightweight, binding-scoped and PORTAL-only',()=>{
  const owner=read('supabase/functions/rona-owner-acceptance/index.ts');
  const clientStart=owner.indexOf('async function clientRadio(ctx');
  const agentStart=owner.indexOf('async function agentRadio(ctx)');
  const bootstrapStart=owner.indexOf('async function clientBootstrap(ctx)');
  assert.ok(clientStart>=0&&agentStart>clientStart&&bootstrapStart>agentStart,'radio projection helpers missing');
  const clientBlock=owner.slice(clientStart,agentStart);
  const agentBlock=owner.slice(agentStart,bootstrapStart);
  assert.match(clientBlock,/delivery_channel='PORTAL'/);
  assert.match(clientBlock,/item_kind in \('NOTIFICATION','ANNOUNCEMENT'\)/);
  assert.match(agentBlock,/from portal_private\.agent_user_bindings aub/);
  assert.match(agentBlock,/delivery_channel='PORTAL'/);
  assert.match(agentBlock,/item_kind='ANNOUNCEMENT'/);
  assert.match(agentBlock,/target_scope='ALL_AGENTS'/);
  assert.match(agentBlock,/target_scope='AGENT'/);
  assert.match(owner,/path==='\/client\/radio'/);
  assert.match(owner,/path==='\/agent\/radio'/);
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
    "root('radio','Радиорубка'",
    "el('div','rona-rs-form')",
    "card('Новое сообщение'",
    "card('Активные сообщения'"
  ]) assert.ok(radio.includes(token),'Stage 2C.1 canonical Radio marker missing: '+token);
  assert.doesNotMatch(wrapper,/RADIO_DIRECT_RENDER/);
  assert.doesNotMatch(wrapper,/RADIO_DIRECT_RENDER_SOURCE_MISMATCH/);
  assert.doesNotMatch(radio,/radioRoot\(\)|radio-command-bar|radio-kpi-grid|radio-workspace|radio-compose-panel|radio-link-panel|radio-active-panel/);
  assert.match(radio,/broadcastProjectionAvailable=Array\.isArray\(payload\?\.data\?\.radio_broadcasts\)/);
  assert.match(radio,/fallback=snap\(\)\|\|\{\}/);
});

test('Client and Agent portal runtime presents central notification modal and top running ticker from server-isolated owner projection',()=>{
  const runtime=read('assets/portal-runtime/portal-radio-broadcast-v1.js');
  for(const token of [
    "role=location.pathname==='/portal/agent'?'AGENT':(location.pathname==='/portal/client'?'CLIENT':'')",
    "role==='CLIENT'?'/client/radio':'/agent/radio'",
    "id='ronaRadioAnnouncementTicker'",
    "id='ronaRadioNotificationOverlay'",
    "animation:ronaRadioTickerRun",
    "if(role!=='CLIENT')",
    "upper(x?.item_kind)==='ANNOUNCEMENT'",
    "upper(x?.item_kind)==='NOTIFICATION'",
    "credentials:'same-origin'",
    'POLL_MS=60000',
    'MAX_POLLS=10'
  ]) assert.ok(runtime.includes(token),'Portal runtime marker missing: '+token);
  assert.doesNotMatch(runtime,/\/client\/bootstrap|\/agent\/bootstrap/);
  assert.match(runtime,/window\.addEventListener\('rona:radio-refresh'/);
  assert.doesNotMatch(runtime,/DELETE|delete\s+from/i);
});

test('Portal shell injects Stage 2C.1 broadcast runtime for real and impersonated Client plus Agent sessions',()=>{
  const shell=read('functions/portal/[[path]].js');
  assert.match(shell,/const RADIO_BROADCAST_RUNTIME = '<script id="rona-portal-radio-broadcast-v1"/);
  assert.match(shell,/clientPresence\+RADIO_BROADCAST_RUNTIME/);
  assert.match(shell,/AGENT_BRIDGE\+agentPresence\+RADIO_BROADCAST_RUNTIME/);
  assert.match(shell,/AGENT_BRIDGE\+RADIO_BROADCAST_RUNTIME/);
  assert.match(shell,/x-rona-client-impersonation-shell/);
  assert.match(shell,/static-plus-radio-runtime-v1/);
  assert.match(shell,/if\(impersonation\?\.data\)\{\s*const transformed=new HTMLRewriter\(\)\s*\.on\('body',new BodyAppend\(RADIO_BROADCAST_RUNTIME\)\)/);
  assert.doesNotMatch(shell,/static-unmodified-v1/);
});

test('Stage 2C.1 does not mutate frozen Client message or Admin Radio visual assets',()=>{
  assert.equal(gitBlobSha('assets/portal-runtime/client-messages-archive-v1.js'),'f3c49ac46cc32ee0cd92eefadb905f8ac52778ca');
  assert.equal(gitBlobSha('assets/portal-admin-radio-final-v9.js'),'89391945e49e49570e22e6cbfecd5a6e7e46b40c');
  assert.equal(gitBlobSha('assets/portal-admin-radio-wide-v10.js'),'1e32655109534962580e96057def98208f69eaa4');
});
