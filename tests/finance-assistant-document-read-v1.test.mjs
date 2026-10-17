import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFinanceHandoffDocumentMetadata,FINANCE_ASSISTANT_DOCUMENT_BRIDGE_SQL} from '../supabase/functions/rona-mcp-gateway/finance-assistant-document-read.mjs';
const DOC='RONA-DOC-2026-000025';
const ROW='b8541c2f-dba9-4bce-8c1e-6366a549fbb6';
const handoff='24de2585-ab84-4858-a777-79535e794aa5';
const sample={
 registry_row_uuid:ROW,registry_number:DOC,document_type:'LETTER_OUT',
 direction:'OUTBOUND',document_date:'2026-10-17',title:'Source-only document',
 external_number:'RONA-S001-OUT-2026-007',counterparty:'COUNTERPARTY',
 authoritative_filename:'TEST_LETTER_SIGNED.pdf',linked_entity_type:'DEAL',
 linked_entity_id:'DEAL-2026-004',registered_by_role:'ASSISTANT',
 source_registry_status:'REGISTERED',drive_file_id:'sample-drive-id',
 drive_url:'https://drive.google.com/file/d/sample-drive-id/view',
 sha256:'a'.repeat(64),source_ref:'OWNER:SOURCE_ONLY',
 updated_at:'2026-10-17T18:00:00Z',exact_handoff_record_id:handoff
};
function fixture(response=[sample]){
 const calls=[];
 const sql={unsafe:async(q,params)=>{calls.push({q,params});return response}};
 return{sql,calls};
}
const read=(f,id=DOC,role='FINANCE',identity_id='AI-FINANCE')=>
 readFinanceHandoffDocumentMetadata({sql:f.sql,role,identity_id,document_id:id});
test('returns provenance only for exact incoming Assistant -> Finance document handoff',async()=>{
 const f=fixture();
 const o=await read(f);
 assert.equal(o.data.document_id,DOC);
 assert.equal(o.data.access_contract,'FINANCE_HANDOFF_SOURCE_METADATA_V1');
 assert.equal(o.data.metadata_only,true);
 assert.equal(o.data.canonical_document_materialized,false);
 assert.equal(o.data.signed_url,null);
 assert.equal(o.data.financial_validation,'NOT_PERFORMED');
 assert.equal(o.data.legal_validation,'NOT_PERFORMED');
 assert.equal(o.data.authorized_handoff_record_id,handoff);
 assert.equal(o.data.source_locator.access_not_guaranteed,true);
 assert.deepEqual(f.calls[0].params,[DOC]);
});
test('rejects different role, identity and malformed identifiers before SQL',async()=>{
 const variants=[
 [DOC,'LEGAL','AI-LEGAL'],[DOC,'FINANCE','AI-ATTACKER'],
 ['x','FINANCE','AI-FINANCE'],['RONA-DOC-2000-00001','FINANCE','AI-FINANCE'],
 [DOC+'; DROP TABLE portal_private.documents','FINANCE','AI-FINANCE'],
 ];
 for(const [id,role,identity_id] of variants){const f=fixture();assert.equal(await read(f,id,role,identity_id),null);assert.equal(f.calls.length,0)}
});
test('uuid source references are allowed but still require the same audited JOIN',async()=>{
 const f=fixture();
 assert.equal((await read(f,ROW)).data.registry_row_uuid,ROW);
 assert.deepEqual(f.calls[0].params,[ROW]);
});
test('missing or non-Assistant source is denied',async()=>{
 const absent=fixture([]);assert.equal(await read(absent),null);
 const outsider=fixture([{...sample,registered_by_role:'LEGAL'}]);
 assert.equal(await read(outsider),null);
});
test('SQL enforces source, assignee, current handoff, active registry and annulment exclusions',()=>{
 const q=FINANCE_ASSISTANT_DOCUMENT_BRIDGE_SQL;
 assert.match(q,/c\.functional_role='ASSISTANT'/);
 assert.match(q,/c\.target_role='FINANCE'/);
 assert.match(q,/c\.target_type='DOCUMENT'/);
 assert.match(q,/c\.target_id IN \(d\.registry_number,d\.id::text\)/);
 assert.match(q,/c\.qa_only=false AND c\.status='REQUESTED'/);
 assert.match(q,/next\.supersedes_id=c\.record_id/);
 assert.match(q,/d\.status='REGISTERED'/);
 assert.match(q,/NOT ILIKE 'ANNULLED_DELETED__%'/);
 assert.match(q,/d\.registry_number=\$1 OR d\.id::text=\$1/);
 assert.doesNotMatch(q,/\b(?:INSERT\s+INTO|UPDATE\s+portal_private|DELETE\s+FROM|DROP\s+TABLE)\b/i);
});
test('gateway only falls back for AI_DOCUMENT_NOT_FOUND; never for authorization errors',()=>{
 const gateway=readFileSync(new URL('../supabase/functions/rona-mcp-gateway/gateway-base.mjs',import.meta.url),'utf8');
 assert.ok(gateway.includes("if(name==='document_read' && cfg.business_role==='FINANCE' &&"));
 assert.ok(gateway.includes("res.data?.code==='AI_DOCUMENT_NOT_FOUND'"));
 assert.ok(gateway.includes('readFinanceHandoffDocumentMetadata('));
 assert.ok(gateway.includes('auditProvenance:bridge.audit_provenance'));
 assert.ok(gateway.includes('source_bridge:out.auditProvenance'));
 assert.ok(gateway.includes("return{error:String(res.data?.code||'AI_BACKEND_DENIED')"));
});
