import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSISTANT_ADMIN_TOOLS } from '../supabase/functions/rona-mcp-gateway/assistant-admin-tools.mjs';

const gateway = readFileSync('supabase/functions/rona-mcp-gateway/index.ts','utf8');
const base = readFileSync('supabase/functions/rona-mcp-gateway/gateway-base.mjs','utf8');
const contour = readFileSync('supabase/migrations/20261001181100_assistant_admin_contour_v1.sql','utf8');
const profile = readFileSync('supabase/migrations/20261001181200_assistant_profile_mailbox_v1.sql','utf8');
const config = readFileSync('supabase/migrations/20261001181400_assistant_runtime_config_v1.sql','utf8');

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
