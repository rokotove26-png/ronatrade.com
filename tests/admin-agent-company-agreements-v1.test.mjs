import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ui = load('functions/portal/clients-agents-current-ui.js');
const owner = load('supabase/functions/rona-owner-acceptance/index.ts');
const admin = load('supabase/functions/rona-admin-control-plane/index.ts');
const archive = load('supabase/functions/rona-admin-control-plane/agent-company-documents-v1.ts');
const migration = load('supabase/migrations/20261014091500_agent_company_documents_v1.sql');

test('agent tab and client assignment use legal companies, not person labels',()=>{
  const view = ui.slice(ui.indexOf('function agentsView(){'),ui.indexOf('function openAgentDocumentModal('));
  const client = ui.slice(ui.indexOf('function companyCard('),ui.indexOf('function companiesView()'));
  assert.match(view,/a\.legalName/);
  assert.match(view,/a\.agentLegalEntityId/);
  assert.doesNotMatch(view,/a\.agent_name|a\.display_name|a\.full_name/);
  assert.match(client,/agentCompanies\(\)/);
  assert.match(client,/agentLegalEntityId:sel\.value/);
  assert.doesNotMatch(client,/agentPersonId:sel\.value/);
  assert.match(ui,/Загрузить подписанный документ/);
  assert.match(ui,/Документы и|Договоры и дополнительные соглашения/);
});

test('legal company source comes from normalized authoritative table',()=>{
  assert.match(archive,/from portal_private\.agent_legal_entities/);
  assert.match(archive,/aca\.agent_legal_entity_key/);
  assert.match(archive,/aca\.status='ACTIVE'/);
  assert.match(archive,/agentPersonId:representatives\.length===1/);
  assert.match(owner,/ale\.legal_name agent_legal_name/);
  assert.match(owner,/agentLegalEntityId/);
  assert.match(owner,/AGENT_LEGAL_ENTITY_ASSIGNMENT_V1/);
  assert.match(owner,/unchanged:true/);
});

test('agent documents are private, entity-scoped, and never auto-approved',()=>{
  assert.match(migration,/create table if not exists portal_private\.agent_company_documents_v1/);
  assert.match(migration,/agent_legal_entity_key uuid not null references portal_private\.agent_legal_entities/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all.*from anon, authenticated/);
  assert.match(migration,/unique \(agent_legal_entity_key, sha256\)/);
  assert.match(archive,/MAGIC_DOES_NOT_EXIST|%PDF-/);
  assert.match(archive,/createSignedUrl\(String\(doc\.storage_path\),60/);
  assert.match(archive,/where id=.*::uuid and agent_legal_entity_key=/);
  assert.match(archive,/reviewStatus:"UPLOADED",legalAuthorityChanged:false/);
  assert.doesNotMatch(archive,/update portal_private\.agent_deal_terms/);
  assert.match(admin,/agentCompanyArchive\.directory\(\)/);
  assert.match(admin,/agentCompanyArchive\.attach\(ctx,req/);
  assert.match(admin,/agentCompanyArchive\.download\(/);
});

test('PDF upload is bounded, signed-attested, content-tested, and audited',()=>{
  assert.match(archive,/15\*1024\*1024/);
  assert.match(archive,/SIGNED_DOCUMENT_ATTESTATION_REQUIRED/);
  assert.match(archive,/\.pdf\$\/i/);
  assert.match(archive,/crypto\.subtle\.digest\("SHA-256",bytes\)/);
  assert.match(archive,/AGENT_COMPANY_SIGNED_DOCUMENT_UPLOADED/);
  assert.match(archive,/ctx\.user/);
  assert.match(ui,/new FormData\(\)/);
  assert.match(ui,/AGENCY_CONTRACT/);
  assert.match(ui,/AGENCY_ADDENDUM/);
});

test('admin APIs require established role session and existing owner boundaries',()=>{
  const guard=admin.indexOf('if (!ctx) return send(403, { ok: false, code: "ADMIN_SESSION_REQUIRED" });');
  const dir=admin.indexOf('if(path==="/agent-companies"&&req.method==="GET")');
  assert.ok(guard >= 0 && dir > guard);
  assert.match(admin,/if \(!\["GET","POST"\]\.includes\(req\.method\)\)/);
  assert.match(archive,/where id=.*::uuid and agent_legal_entity_key=/);
  assert.match(ui,/agentDirectoryError/);
});
