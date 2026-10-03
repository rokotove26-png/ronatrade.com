import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSISTANT_ADMIN_TOOLS } from '../supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs';
import { compactState } from '../supabase/functions/rona-mcp-gateway/state-projection.mjs';

const gateway = readFileSync('supabase/functions/rona-mcp-gateway/index.ts','utf8');
const base = readFileSync('supabase/functions/rona-mcp-gateway/gateway-base.mjs','utf8');
const contour = readFileSync('supabase/migrations/20261001181100_assistant_admin_contour_v1.sql','utf8');
const profile = readFileSync('supabase/migrations/20261001181200_assistant_profile_mailbox_v1.sql','utf8');
const config = readFileSync('supabase/migrations/20261001181400_assistant_runtime_config_v1.sql','utf8');
const tokenBridge = readFileSync('supabase/functions/rona-mcp-oauth-token/index.js','utf8');

test('Assistant MCP route is coordinate-enabled and fixed to AI-ASSISTANT', () => {
  assert.match(gateway, /"assistant"/);
  assert.match(gateway, /segment === "assistant"/);
  assert.match(base, /'rona-mcp-assistant':\['ASSISTANT','AI-ASSISTANT'\]/);
  assert.match(base, /'rona-mcp-assistant':'assistant'/);
  assert.match(base, /ASSISTANT:new Set\(\['DOCUMENT','TASK'\]\)/);
});

test('Assistant current_state and history bypass the legacy read-only role whitelist', () => {
  assert.match(gateway, /async function assistantCurrentState/);
  assert.match(gateway, /async function assistantHistory/);
  assert.match(gateway, /ctx\?\.role === "ASSISTANT" && name === "current_state"/);
  assert.match(gateway, /ctx\?\.role === "ASSISTANT" && name === "history"/);
});

test('Assistant custom administrative tool surface is bounded', () => {
  const names = ASSISTANT_ADMIN_TOOLS.map(t => t.name).sort();
  assert.deepEqual(names, [
    'assistant_correspondence_recent',
    'assistant_correspondence_update',
    'assistant_document_register',
    'assistant_document_registry_read',
    'assistant_document_registry_recent',
    'assistant_document_version_add',
    'assistant_route_submit',
  ]);
  assert.ok(ASSISTANT_ADMIN_TOOLS.filter(t => t.annotations?.readOnlyHint === false).length === 4);
});

test('Assistant mail calls are intercepted by the administrative runtime', () => {
  assert.match(gateway, /name\.startsWith\("mail_"\)/);
  assert.match(base, /ASSISTANT_MAILBOX='office_kg@ronaoil\.com'/);
  assert.match(base, /role==='ASSISTANT'\?\['documents','tasks','audit'\]/);
});

test('Assistant authority remains administrative and non-domain-decisional', () => {
  assert.match(contour, /'ADMIN_DOCUMENT_FLOW','ASSISTANT'/);
  assert.match(contour, /'CORRESPONDENCE','ASSISTANT'/);
  assert.match(contour, /'DOCUMENT_REGISTRY','ASSISTANT'/);
  assert.match(contour, /'OFFICE_ADMIN','ASSISTANT'/);
  assert.match(contour, /'business_decision_owner',false/);
  assert.match(contour, /'DOMAIN_DECISION'/);
  assert.match(contour, /'SYSTEM_ADMIN_AUTHORITY'/);
});

test('Assistant profile, mailbox and Drive provenance are materialized', () => {
  assert.match(profile, /staff_key='ASSISTANT'/);
  assert.match(contour, /office_kg@ronaoil\.com/);
  assert.match(config, /assistant_runtime_config_v1/);
  assert.match(config, /GOOGLE_DRIVE/);
  assert.match(config, /RONA Trade — Канонические документы/);
});


test('Generic cross-role handoff cannot target the administrative Assistant', () => {
  assert.match(base, /const CANONICAL_AI_HANDOFF_ROLES=Object\.freeze\(\['OPERATIONS_DIRECTOR','FINANCE','LEGAL','MARKET_ANALYST','COMMERCIAL_DIRECTOR','RAIL_LOGISTICS','SYSTEM_ADMIN'\]\)/);
  assert.match(base, /target_role:\{type:'string',enum:CANONICAL_AI_HANDOFF_ROLES\}/);
  assert.match(base, /!CANONICAL_AI_HANDOFF_ROLES\.includes\(targetRole\)/);
});

test('Inbound correspondence dedupe survives IMAP UIDVALIDITY changes', () => {
  const admin = readFileSync('supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs','utf8');
  const identity = readFileSync('supabase/migrations/20261001181500_assistant_correspondence_identity_v1.sql','utf8');
  assert.match(admin, /'imap:'\|\|m\.uid_validity::text\|\|':'\|\|m\.imap_uid::text/);
  assert.match(admin, /r\.source_message_id=coalesce\(m\.rfc_message_id/);
  assert.match(identity, /rona_correspondence_inbound_message_identity_uq/);
});

test('Document register rejects years outside sequence bounds', () => {
  const admin = readFileSync('supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs','utf8');
  assert.match(admin, /Number\(date\.slice\(0,4\)\)<2020/);
  assert.match(admin, /Number\(date\.slice\(0,4\)\)>2100/);
});


test('Assistant mail identity is epoch-aware end to end', () => {
  const admin = readFileSync('supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs','utf8');
  assert.match(gateway, /required:\["uid_validity","uid"\]/);
  assert.match(admin, /select uid_validity,imap_uid/);
  assert.match(admin, /uid_validity=\$2 and imap_uid=\$3/);
  assert.match(admin, /MAIL_MESSAGE_BODY_UNAVAILABLE_FOR_HISTORICAL_UIDVALIDITY/);
});

test('Mail idempotency includes reply-thread headers', () => {
  const admin = readFileSync('supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs','utf8');
  assert.match(admin, /String\(r\.reply_to\?\?""\)===String\(replyTo\?\?""\)/);
  assert.match(admin, /String\(r\.in_reply_to\?\?""\)===String\(inReplyTo\?\?""\)/);
  assert.match(admin, /String\(r\.references_header\?\?""\)===String\(refsHead\?\?""\)/);
});

test('response_required rejects non-booleans', () => {
  const admin = readFileSync('supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs','utf8');
  assert.match(admin, /typeof args\.response_required!==["']boolean["']/);
});


test('Assistant OAuth canonical origin matches the existing public RONA role pattern', () => {
  assert.doesNotMatch(gateway, /ASSISTANT_DIRECT_ORIGIN/);
  assert.match(gateway, /function publicRoleBase\(segment\) \{\s*return `\$\{PUBLIC_ORIGIN\}\/\$\{segment\}`;\s*\}/);
  assert.match(base, /function publicBaseFor\(slug\)\{return `\$\{PUBLIC_ORIGIN\}\/\$\{segmentFor\(slug\)\}`;\}/);
});

test('Assistant OAuth discovery supports ChatGPT MCP-relative metadata probes', () => {
  assert.match(gateway, /\$\{segment\}\/mcp\/\.well-known\/oauth-protected-resource/);
  assert.match(gateway, /\$\{segment\}\/mcp\/\.well-known\/oauth-authorization-server/);
});


test('Assistant remains wired into the shared token bridge', () => {
  assert.match(tokenBridge, /assistant:'rona-mcp-assistant'/);
  assert.match(tokenBridge, /COORDINATE_PILOT_SLUGS=new Set\([^\n]*'rona-mcp-assistant'/);
});

test('Assistant authorization uses the same native gateway POST form as working roles', () => {
  assert.match(base, /<form method="post" action="authorize">/);
  assert.match(base, /if\(ctx\.path==='\/authorize'&&req\.method==='POST'\)return await authorizePost\(req,cfg\)/);
  assert.doesNotMatch(base, /action="authorize\/prepare"/);
  assert.doesNotMatch(base, /authorize\/complete\?nonce=/);
  assert.doesNotMatch(base, /AUTH_PREPARE_FAILED/);
});


test('Assistant administrative writes preserve JSONB object and array shapes', () => {
  const admin = readFileSync('supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs','utf8');
  assert.match(admin, /ids\.correlationId,core,idemHash,payloadHash,data\]/);
  assert.match(admin, /payloadHash,sourceRefs,payload,ids\.correlationId/);
  assert.doesNotMatch(admin, /ids\.correlationId,JSON\.stringify\(core\),idemHash,payloadHash,JSON\.stringify\(data\)/);
  assert.doesNotMatch(admin, /payloadHash,JSON\.stringify\(sourceRefs\),JSON\.stringify\(payload\),ids\.correlationId/);
});

test('Assistant token and revoke endpoints are routed through the shared token bridge', () => {
  assert.match(base, /rona-mcp-oauth-token','assistant','token'/);
  assert.match(base, /rona-mcp-oauth-token','assistant','revoke'/);
});


test('current_state bounds execution recovery workstreams to metadata summaries', () => {
  const large = 'x'.repeat(5000);
  const data = {
    functional_role:'SYSTEM_ADMIN',
    generated_at:'2026-10-03T00:00:00Z',
    identity_profile:{identity_id:'AI-SYSTEM-ADMIN'},
    checkpoint:{state_version:103},
    active_tasks:[],
    competence_contract:{contract:'RONA_AI_COMPETENCE_GATE_V1',canonical_role:'SYSTEM_ADMIN'},
    routing_capabilities:{},
    state_conflicts:[],
    global_role_policies:[{scope:'GLOBAL_SYSTEM_ADMIN_ROLE',policy_id:'P1'}],
    coordination:{records:[]},
    bootstrap:{procedure:['READ_CURRENT_STATE']},
    execution_recovery:{
      contract:'RONA_AI_OFFICE_EXECUTION_RECOVERY_V3',
      execution_resume:{
        contract:'RONA_AI_EXECUTION_RESUME_V1',
        workstreams:Array.from({length:12},(_,i)=>({
          workstream_id:'WS-'+i,title:'Workstream '+i,status:'ACTIVE',task_id:null,
          updated_at:'2026-10-03T00:00:00Z',objective:large,last_completed:large,next_action:large,
          blockers:[large],source_refs:[large]
        }))
      }
    }
  };
  const out = compactState(data,{role:'SYSTEM_ADMIN',identity_id:'AI-SYSTEM-ADMIN',server_slug:'rona-mcp-system-admin-pilot'},null);
  assert.equal(out.execution_recovery.execution_resume.source_workstream_count,12);
  assert.equal(out.execution_recovery.execution_resume.workstreams.length,10);
  assert.equal(out.execution_recovery.execution_resume.workstreams_truncated,true);
  assert.equal(out.execution_recovery.execution_resume.full_detail_tool,'execution_checkpoint_read');
  assert.equal(out.execution_recovery.execution_resume.workstreams[0].detail_required,true);
  assert.equal('objective' in out.execution_recovery.execution_resume.workstreams[0],false);
  assert.ok(Buffer.byteLength(JSON.stringify(out),'utf8') < 24000);
});
