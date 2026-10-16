// Strict, read-only bridge from role-authored immutable proposals to certified Act data.
// No inferred Finance/Legal amounts and no business-record mutations.
function blocked(code:string):never{throw Object.assign(new Error(code),{status:409})}
const str=(v:unknown)=>String(v??'').trim();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{23}$/i;
const empty=(v:any)=>!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length===0;
export async function certifiedRoleSnapshots(sql:any,row:any,review:any,conclusions:any[]){
 const fromFinance=empty(row.finance_snapshot),fromLegal=empty(row.legal_snapshot);
 if(!fromFinance&&!fromLegal)
   return{finance:row.finance_snapshot,legal:row.legal_snapshot,source:'MATERIALIZED_SNAPSHOTS'};
 const candidates=await sql`select record_id,functional_role::text as role,status,payload
   from portal_private.ai_coordination_records
   where target_type='DOCUMENT' and target_id=${String(row.id)}
     and record_type='BUSINESS_CHANGE_PROPOSAL'
     and functional_role::text in ('FINANCE','LEGAL')
   order by created_at desc limit 40`;
 const choose=(role:string,field:string,contract:string,conclusionId:string)=>{
   const conclusion=conclusions.find((c:any)=>str(c.record_id)===str(conclusionId)
     &&str(c.role)===role&&c.status==='APPROVED'&&c.payload?.confirmed===true);
   if(!conclusion)blocked('ACT_ROLE_CERTIFIED_CONCLUSION_REQUIRED');
   const sources=conclusion.payload?.source_refs;
   if(!Array.isArray(sources)||sources.length<1||sources.length>20)
     blocked('ACT_ROLE_CERTIFIED_PROPOSAL_REF_REQUIRED');
   const proposals=candidates.filter((p:any)=>
     p.role===role&&p.status==='PROPOSED'
     &&p.payload?.proposed_field===field
     &&sources.includes(str(p.record_id)));
   if(proposals.length!==1)
     blocked('ACT_ROLE_CERTIFIED_PROPOSAL_NOT_FOUND');
   const v=proposals[0].payload?.proposed_value;
   if(empty(v)||v.contract!==contract)
     blocked('ACT_ROLE_CERTIFIED_CONTRACT_INVALID');
   const guards=[
     [v.requestId,row.id],[v.dealId,row.deal_id],
     [v.assignmentId,row.assignment_id],
     [v.ownerCorrectionId,row.owner_correction_key],
     [v.ownerCorrectionVersion,row.correction_version],
     [v.signedAddendumDocumentId,row.source_snapshot?.addendumId]
   ];
   if(guards.some(([a,b])=>!str(a)||str(a)!==str(b)))
     blocked('ACT_ROLE_CERTIFIED_SOURCE_SCOPE_MISMATCH');
   if(role==='FINANCE'&&str(v.approvedTermId)!==str(row.term_key))
     blocked('ACT_ROLE_CERTIFIED_TERM_SCOPE_MISMATCH');
   if(role==='LEGAL'&&str(v.approvedTermId)!==str(row.term_key))
     blocked('ACT_ROLE_CERTIFIED_TERM_SCOPE_MISMATCH');
   return v
 };
 const finance=fromFinance?choose('FINANCE',
   'agent_rewards.act.finance_snapshot_v1','RONA_AGENT_ACT_FINANCE_CERT_V1',
   String(review.finance.recordId)):row.finance_snapshot;
 const legal=fromLegal?choose('LEGAL',
   'agent_rewards.act.legal_snapshot_v1','RONA_AGENT_ACT_LEGAL_CERT_V1',
   String(review.legal.recordId)):row.legal_snapshot;
 return{finance,legal,source:'ROLE_CONCLUSION_LINKED_PROPOSALS'}
}
