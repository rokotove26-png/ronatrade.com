// FINANCE read-only provenance bridge for ASSISTANT document source records.
// It deliberately does NOT create an authoritative document, signed URL,
// finance fact, or DOCUMENT functional conclusion.
const DOCUMENT_ID=/^RONA-DOC-[0-9]{4}-[0-9]{6}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SQL=[
  "SELECT d.id::text AS registry_row_uuid, d.registry_number, d.document_type,",
  "d.direction,d.document_date,d.title,d.external_number,d.counterparty,",
  "d.authoritative_filename,d.linked_entity_type,d.linked_entity_id,",
  "d.functional_owner::text AS registered_by_role,d.status AS source_registry_status,",
  "d.drive_file_id,d.drive_url,d.sha256,d.source_ref,d.updated_at,",
  "h.record_id::text AS exact_handoff_record_id",
  "FROM portal_private.assistant_document_register_v1 d",
  "JOIN LATERAL (",
  " SELECT c.record_id FROM portal_private.ai_coordination_records c",
  " WHERE c.record_type='HANDOFF_REQUEST'",
  " AND c.functional_role='ASSISTANT'::portal_private.ai_business_role_enum",
  " AND c.target_role='FINANCE'::portal_private.ai_business_role_enum",
  " AND c.target_type='DOCUMENT'",
  " AND c.target_id IN (d.registry_number,d.id::text)",
  " AND c.qa_only=false AND c.status='REQUESTED'",
  " AND NOT EXISTS (SELECT 1 FROM portal_private.ai_coordination_records next",
  "   WHERE next.supersedes_id=c.record_id AND next.qa_only=false)",
  " ORDER BY c.created_at DESC,c.record_id DESC LIMIT 1",
  ") h ON TRUE",
  "WHERE (d.registry_number=$1 OR d.id::text=$1)",
  "AND d.status='REGISTERED'",
  "AND COALESCE(d.authoritative_filename,'') NOT ILIKE 'ANNULLED_DELETED__%'",
  "LIMIT 1"
].join(" ");
export const FINANCE_ASSISTANT_DOCUMENT_BRIDGE_SQL=SQL;
export async function readFinanceHandoffDocumentMetadata({sql,role,identity_id,document_id}) {
  // No new Finance tool or entity authority: only fallback after existing
  // authenticated document_read returned AI_DOCUMENT_NOT_FOUND.
  if(role!=='FINANCE'||identity_id!=='AI-FINANCE'||
     typeof document_id!=='string'||document_id.length>160||
     !(DOCUMENT_ID.test(document_id)||UUID.test(document_id))) return null;
  const rows=await sql.unsafe(SQL,[document_id]);
  if(rows.length!==1)return null;
  const d=rows[0];
  if(d.registered_by_role!=='ASSISTANT')return null;
  // Preserve the original document status; do not imply FINANCE acceptance.
  return {
    data:{
      document_id:d.registry_number,
      registry_row_uuid:d.registry_row_uuid,
      source_system:'ASSISTANT_DOCUMENT_REGISTER_V1',
      source_registry_status:d.source_registry_status,
      access_contract:'FINANCE_HANDOFF_SOURCE_METADATA_V1',
      metadata_only:true,
      canonical_document_materialized:false,
      signed_url:null,
      financial_validation:'NOT_PERFORMED',
      legal_validation:'NOT_PERFORMED',
      source_document_type:d.document_type,
      direction:d.direction,
      document_date:d.document_date,
      title:d.title,
      external_number:d.external_number,
      counterparty:d.counterparty,
      authoritative_filename:d.authoritative_filename,
      linked_entity_type:d.linked_entity_type,
      linked_entity_id:d.linked_entity_id,
      source_sha256:d.sha256,
      source_checksum_asserted_in_registry:typeof d.sha256==='string' && /^[0-9a-f]{64}$/i.test(d.sha256),
      source_content_verified_by_bridge:false,
      untrusted_external_metadata:true,
      source_locator:{drive_file_id:d.drive_file_id,drive_url:d.drive_url,access_not_guaranteed:true},
      source_ref:d.source_ref,
      updated_at:d.updated_at,
      authorized_handoff_record_id:d.exact_handoff_record_id,
      action_required:'REVIEW_SOURCE_ONLY_DO_NOT_AUTO_POST'
    },
    audit_provenance:{
      source:'ASSISTANT_DOCUMENT_REGISTER_V1',
      document_id:d.registry_number,
      handoff_record_id:d.exact_handoff_record_id,
      metadata_only:true
    }
  };
}
