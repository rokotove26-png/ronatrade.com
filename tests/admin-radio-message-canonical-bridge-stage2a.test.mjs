import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const gitBlobSha=p=>{const bytes=readFileSync(new URL('../'+p,import.meta.url));return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')};

test('Stage 2A production Radio owner is the static materialized R2 base and uses dedicated chat bootstrap',()=>{
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  const materializer=read('scripts/materialize-admin-current-modules.mjs');
  assert.match(materializer,/extractRawScript\(await read\('functions\/portal\/remaining-sections-r2-base\.js'/);
  assert.match(materializer,/writeFile\(join\(OUT,'remaining-sections-ui'\),remaining\)/);
  assert.match(materializer,/STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_STATIC_OWNER/);
  assert.match(radio,/STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_STATIC_OWNER/);
  assert.match(radio,/radio_clients/);
  assert.match(radio,/radio_messages/);
  assert.match(radio,/radio_agents/);
  assert.match(radio,/radioCanonicalClients/);
  assert.match(radio,/radioCanonicalAgents/);
  assert.match(radio,/STAGE_2A_OPERATIONAL_CLIENT_AGENT_MESSAGE_V1/);
  assert.match(radio,/legal_name/);
  assert.match(radio,/client_id/);
  assert.match(radio,/\/v1\/admin\/radio\/bootstrap/);
  assert.match(radio,/\/v1\/admin\/radio\/messages/);
  assert.match(radio,/attempt<=3/);
  assert.match(radio,/Number\(error\?\.status\)>=500/);
  assert.match(radio,/\/v1\/admin\/client-intake\//);
  assert.match(radio,/source_task_id/);
  assert.doesNotMatch(radio,/radioCanonicalRequest\('\/v1\/admin\/bootstrap'\)/);
  assert.doesNotMatch(radio,/STAGE_2A_CORRECTIVE_CLIENT_CHAT_V1_LIVE_OWNER/);
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
  const canonicalSubmit=radio.indexOf("radioCanonicalRequest('/v1/admin/radio/messages'",branch);
  const broadcastPost=radio.indexOf("await post('/admin/radio',{kind:kind.value",branch);
  assert.ok(branch>=0&&canonicalSubmit>branch&&broadcastPost>canonicalSubmit,'MESSAGE canonical branch / broadcast publication ordering missing');
  const messageBlock=radio.slice(branch,broadcastPost);
  assert.match(messageBlock,/radioCanonicalRequest\('\/v1\/admin\/radio\/messages'/);
  assert.match(messageBlock,/renderRadio\(\);return/);
});

test('Radio read path uses a dedicated lightweight server projection',()=>{
  const admin=read('supabase/functions/rona-portal-api/admin.ts');
  const index=read('supabase/functions/rona-portal-api/index.ts');
  const radio=read('functions/portal/remaining-sections-ui.js');
  assert.match(admin,/export async function adminRadioBootstrap\(\)/);
  assert.match(admin,/Promise\.all\(\[\s*adminRadioClients\(\),\s*adminRadioAgents\(\),\s*adminRadioMessages\(\)/);
  assert.match(index,/adminBootstrap, adminRadioBootstrap/);
  assert.match(index,/route==="\/v1\/admin\/radio\/bootstrap"/);
  assert.match(radio,/radioCanonicalRequest\('\/v1\/admin\/radio\/bootstrap'\)/);
  const directBlock=radio.slice(radio.indexOf('async function radioLoadCanonical'),radio.indexOf('function radioCaptureDraft'));
  assert.doesNotMatch(directBlock,/radioCanonicalRequest\('\/v1\/admin\/bootstrap'\)/);
});

test('Radio history and KPI consume chat-only projection',()=>{
  const admin=read('supabase/functions/rona-portal-api/admin.ts');
  assert.match(admin,/authority_domain='CLIENT_COMMUNICATION'/);
  assert.match(admin,/authority_target_type='MESSAGE'/);
  assert.match(admin,/ADMIN_CLIENT_MESSAGE_SUBMIT/);
  assert.match(admin,/CLIENT_MESSAGE_SUBMIT/);
  assert.match(admin,/radio_chat_projection_contract:"RADIO_CHAT_MESSAGE_V2_CLIENT_AGENT"/);
  assert.match(admin,/radio_clients:radioClients/);
  assert.match(admin,/radio_messages:radioMessages/);
  const radio=read('functions/portal/remaining-sections-r2-base.js');
  assert.match(radio,/const canonical=radioCanonicalItems\(\),broadcasts=radioCanonicalBroadcasts\(\)/);
  assert.match(radio,/const count=k=>k==='MESSAGE'\?canonical\.length:broadcasts\.filter/);
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

test('Operational MESSAGE directories are entity-authoritative and delivery readiness is non-filtering metadata',()=>{
  const admin=read('supabase/functions/rona-portal-api/admin.ts');
  const clients=admin.slice(admin.indexOf('async function adminRadioClients(){'),admin.indexOf('async function adminRadioAgents(){'));
  const agents=admin.slice(admin.indexOf('async function adminRadioAgents(){'),admin.indexOf('async function adminRadioAudienceClients(){'));
  assert.match(clients,/from portal_private\.clients cl/);
  assert.match(clients,/left join lateral/);
  assert.match(clients,/has_active_portal_recipient/);
  assert.doesNotMatch(clients,/join portal_private\.client_user_bindings b\s+on/i);
  assert.doesNotMatch(clients,/signed_contract_confirmed_at/);
  assert.doesNotMatch(clients,/contract_status='ACTIVE'/);
  assert.match(agents,/SOURCE_RECEIVED/);
  assert.match(agents,/has_active_portal_recipient/);
  assert.match(admin,/radio_agents:radioAgents/);
});

test('Canonical Agent chat uses Agent Person scope without fake Client scope',()=>{
  const migration=read('supabase/migrations/20260923173735_admin_radio_stage2a_operational_recipient_agent_message_v1.sql');
  const agent=read('supabase/functions/rona-portal-api/agent.ts');
  const index=read('supabase/functions/rona-portal-api/index.ts');
  assert.match(migration,/add column if not exists agent_person_key uuid/);
  assert.match(migration,/ADMIN_AGENT_MESSAGE_SUBMIT/);
  assert.match(migration,/AGENT_MESSAGE_SUBMIT/);
  assert.match(migration,/AGENT_COMMUNICATION/);
  assert.match(migration,/thread_scope','AGENT_PERSON'/);
  assert.match(migration,/server_admin_submit_agent_radio_message_v1/);
  assert.match(migration,/server_agent_submit_radio_message_v1/);
  assert.match(migration,/agent_person_key is null\s+or \(client_key is null and contract_key is null and deal_key is null\)/);
  assert.match(agent,/e\.agent_person_key=/);
  assert.match(agent,/AGENT_COMMUNICATION/);
  assert.match(agent,/server_agent_submit_radio_message_v1/);
  assert.match(index,/\/v1\/agent\/messages/);
  assert.match(index,/\/v1\/admin\/radio\/agent-messages/);
});

test('Client company MESSAGE target no longer depends on Portal identity or signed PDF',()=>{
  const migration=read('supabase/migrations/20260923173735_admin_radio_stage2a_operational_recipient_agent_message_v1.sql');
  const fn=migration.slice(migration.indexOf('create or replace function portal_private.server_admin_submit_radio_message_v1'),migration.indexOf('create or replace function portal_private.server_admin_submit_agent_radio_message_v1'));
  assert.match(fn,/cl\.lifecycle_state='ACTIVE'/);
  assert.match(fn,/cl\.authority_state in/);
  assert.doesNotMatch(fn,/client target has no active portal recipient/);
  assert.doesNotMatch(fn,/signed_contract_confirmed_at/);
  assert.doesNotMatch(fn,/contract_status='ACTIVE'/);
  assert.match(fn,/v_client,v_contract,null,null,'ADMIN_CLIENT_MESSAGE_SUBMIT'/);
});

test('Same-origin Agent bootstrap sanitizer preserves canonical identity, scope, and message projection',()=>{
  const proxy=read('functions/portal/api/[[path]].js');
  const start=proxy.indexOf('function safeAgentBootstrap(data)');
  const end=proxy.indexOf('function safeAgentPayment',start);
  assert.ok(start>=0&&end>start,'safeAgentBootstrap block missing');
  const block=proxy.slice(start,end);
  for(const token of [
    'userId:data?.userId',
    'agentPersonId:data?.agentPersonId',
    'displayAlias:data?.displayAlias',
    'legalEntity:legal',
    'dataUpdatedAt:data?.dataUpdatedAt',
    'clients,',
    'deals,',
    'applications,',
    'safeAgentSettlement',
    'safeAgentDocument',
    'safeAgentMessage'
  ])assert.ok(block.includes(token),`Agent bootstrap canonical field missing: ${token}`);
  assert.match(block,/messages:\(Array\.isArray\(data\?\.messages\)\?data\.messages:\[\]\)\.map\(safeAgentMessage\)\.filter\(Boolean\)/);
  assert.doesNotMatch(block,/\bmessages\s*:\s*\[\]\s*[,}]/);
  assert.doesNotMatch(block,/assignedClients:/);
  assert.match(proxy,/path==='\/v1\/agent\/bootstrap'\)payload\.data=safeAgentBootstrap\(payload\.data\)/);
});

test('Production /portal/api Agent bootstrap owner and direct/proxy parity gate are source-locked',()=>{
  const proxy=read('functions/portal/api/[[path]].js');
  const helpers=read('scripts/qa-admin-radio-stage2a-operational-helpers.mjs');
  const scenarios=read('scripts/qa-admin-radio-stage2a-operational-scenarios.mjs');
  const main=read('scripts/qa-admin-radio-stage2a-operational-main.mjs');

  assert.match(proxy,/const prefix='\/portal\/api'/);
  assert.match(proxy,/path=url\.pathname\.startsWith\(prefix\)\?url\.pathname\.slice\(prefix\.length\):''/);
  assert.match(proxy,/const PORTAL_API=\`\$\{SUPABASE_URL\}\/functions\/v1\/rona-portal-api\`/);
  assert.match(proxy,/path==='\/v1\/agent\/bootstrap'\)payload\.data=safeAgentBootstrap\(payload\.data\)/);

  assert.match(helpers,/DIRECT_PORTAL_API='https:\/\/sxawrwzeobaqwwmlkzws\.supabase\.co\/functions\/v1\/rona-portal-api'/);
  assert.match(helpers,/directAgentBootstrap\(session\)/);
  assert.match(helpers,/authorization:\`Bearer \$\{session\.accessToken\}\`/);
  assert.match(helpers,/proxyAgentBootstrap=c=>api\(c,'\/portal\/api\/v1\/agent\/bootstrap'/);

  for(const token of [
    "d.agentPersonId===p.agentPersonId",
    "d.userId===p.userId",
    "d.displayAlias===p.displayAlias",
    "d.legalEntity.id===p.legalEntity.id",
    "MESSAGE_PROJECTION_PARITY",
    "MESSAGE_SENSITIVE_FIELD_EXPOSED",
    "STALE_ASSIGNED_CLIENTS_PRESENT"
  ]) assert.ok(scenarios.includes(token),`Agent direct/proxy parity guard missing: ${token}`);

  assert.match(main,/AGENT_A_BOOT=PASS/);
  assert.match(main,/AGENT_B_BOOT=PASS/);
  assert.match(main,/AGENT_BOOTSTRAP_DIRECT_PROXY_PARITY=PASS/);
});

test('Stage 2A production deploy gate permits only exact head or fail-closed QA-only runtime equivalence',()=>{
  const workflow=read('.github/workflows/admin-radio-message-stage2a-production-qa.yml');
  const gate=read('scripts/qa-admin-radio-stage2a-deployment-equivalence.mjs');

  assert.match(workflow,/Prove exact or QA-only runtime-equivalent Cloudflare deployment/);
  assert.match(workflow,/node scripts\/qa-admin-radio-stage2a-deployment-equivalence\.mjs/);
  assert.doesNotMatch(workflow,/run: node scripts\/wait-cloudflare-commit\.mjs/);

  assert.match(gate,/CLOUDFLARE_DEPLOYMENT_AUTHORITY=EXACT_HEAD/);
  assert.match(gate,/CLOUDFLARE_DEPLOYMENT_AUTHORITY=QA_ONLY_RUNTIME_EQUIVALENCE/);
  assert.match(gate,/Workers Builds: ronatrade-com/);
  assert.match(gate,/Cloudflare Pages/);
  assert.match(gate,/forbidden=changed\.filter\(path=>!qaOnlyPaths\.has\(path\)\)/);
  assert.match(gate,/PAGES_NOT_EXACT_AND_RUNTIME_DELTA_PRESENT/);
  assert.match(gate,/NO_SUCCESSFUL_PAGES_ANCESTOR/);
  assert.match(gate,/git',\['diff','--name-only'/);

  for(const forbidden of [
    "functions/portal/api/[[path]].js",
    "functions/portal/[[path]].js",
    "supabase/functions/rona-portal-api/agent.ts",
    "portal-src/canonical-transfer-v1_1/agent_externalized.html",
    "assets/portal-admin-radio-final-v9.js"
  ]) assert.ok(!gate.includes(`'${forbidden}'`),`Runtime path must not be allow-listed for deployment equivalence: ${forbidden}`);
});

test('Stage 2A QA issuer is transient-resilient and performs stale-identity cleanup without touching business identities',()=>{
  const helpers=read('scripts/qa-admin-radio-stage2a-operational-helpers.mjs');
  const main=read('scripts/qa-admin-radio-stage2a-operational-main.mjs');

  assert.match(helpers,/const maxAttempts=waitForActive\?60:6/);
  assert.match(helpers,/\[429,500,502,503,504,520,522,524,546\]\.includes\(r\.status\)/);
  assert.match(helpers,/RESOURCE_LIMIT/);
  assert.match(helpers,/AbortSignal\.timeout\(20000\)/);
  assert.match(helpers,/export async function cleanupQa\(\)\{return issuerCall\('\/cleanup'\)\}/);

  assert.match(main,/const preflightCleanup=await cleanupQa\(\)/);
  assert.match(main,/preflightQaCleanup:true/);
  assert.match(main,/globalQaCleanup:true/);
  assert.match(main,/PREEXISTING_QA_ACTIVE_USERS/);
  assert.match(main,/PREEXISTING_QA_CLIENT_BINDINGS/);
  assert.match(main,/PREEXISTING_QA_AGENT_BINDINGS/);
});

test('Stage 2A Admin browser proof is fail-closed behind healthy canonical Admin bootstrap with bounded reloads',()=>{
  const main=read('scripts/qa-admin-radio-stage2a-operational-main.mjs');
  assert.match(main,/api\(c,'\/portal\/api\/v1\/admin\/bootstrap'/);
  assert.match(main,/\[401,403\]\.includes\(r\.status\)/);
  assert.match(main,/Date\.now\(\)-started<120000/);
  assert.match(main,/\[500,502,503,504,520,522,524,546\]\.includes\(r\.status\)/);
  assert.match(main,/setTimeout\(resolve,5000\)/);
  assert.match(main,/BACKEND_HEALTH_TIMEOUT_/);
  assert.match(main,/for\(let attempt=1;attempt<=3;attempt\+\+\)/);
  assert.match(main,/window\.__RONA_OWNER_ADMIN_READY__===true/);
  assert.match(main,/__RONA_REMAINING_SECTIONS_READY__/);
  assert.match(main,/adminRuntimeAttempts/);
  assert.match(main,/await loadAdminReady\(adminPage,adminContext,'ADMIN_INITIAL_READY'\)/);
  assert.match(main,/await loadAdminReady\(adminPage,adminContext,'ADMIN_POST_CLEANUP_READY'/);
});

test('Agent Portal frozen page is functionally bound by the server bridge without visual source mutation',()=>{
  const bridge=read('functions/portal/[[path]].js');
  assert.match(bridge,/AGENT_ADMIN_CANONICAL_MESSAGE_V1/);
  assert.match(bridge,/\/portal\/api\/v1\/agent\/messages/);
  assert.match(bridge,/#page-messages \.actions \.btn/);
  const canonical=read('portal-src/canonical-transfer-v1_1/agent_externalized.html');
  assert.match(canonical,/Фактическая отправка станет доступна после серверного подключения\./);
});

test('Admin static materializer cannot silently emit the stale full-bootstrap Radio owner',()=>{
  const build=read('scripts/materialize-admin-current-modules.mjs');
  assert.match(build,/materialized Radio owner/);
  assert.match(build,/STATIC_RADIO_STALE_OWNER_MARKER/);
  assert.match(build,/radioMessageOwner=STAGE_2A_OPERATIONAL_CLIENT_AGENT_MESSAGE_V1/);
  assert.match(build,/radioRead=\/v1\/admin\/radio\/bootstrap/);
  assert.match(build,/radio_agents/);
  assert.match(build,/radio\/agent-messages/);
});

test('Dynamic Radio wrapper remains source-compatible with the frozen visual geometry',async()=>{
  const radio=read('functions/portal/remaining-sections-ui.js');
  for(const token of [
    "radio-workspace",
    "radio-compose-panel",
    "radio-link-panel",
    "radio-active-panel",
    "radio-compose-controls",
    "radio-send",
    "Активные сообщения"
  ]) assert.ok(radio.includes(token),`live Radio visual DOM token missing: ${token}`);
  const mod=await import('../functions/portal/remaining-sections-ui.js?radio-stage2a-corrective='+Date.now());
  const response=await mod.onRequest();
  const script=await response.text();
  assert.match(script,/STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_DEDICATED_BOOTSTRAP/);
  assert.match(script,/radio-workspace/);
  assert.match(script,/radio-compose-panel/);
  assert.match(script,/radio-active-panel/);
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

test('Frozen Agent Portal visual source remains byte-for-byte unchanged',()=>{
  assert.equal(gitBlobSha('portal-src/canonical-transfer-v1_1/agent_externalized.html'),'6fefc0cc53d21b94855800b7fbde249214e41b95');
});
