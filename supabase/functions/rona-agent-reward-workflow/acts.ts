// RONA Trade act lifecycle, additive to the source-only agent Rewards read workspace.
// No modification to Finance numbers or external settlement; two immutable role conclusions
// are mandatory before an act can be archived or exposed to the agent.
const ID=/^[0-9a-f-]{36}$/i,BUCKET='rona-portal-private',MAX=20*1024*1024;
function deny(code:string,status=409){throw Object.assign(new Error(code),{status})}
export async function reviewState(sql:any,id:string){
 const xs=await sql`select record_id,functional_role::text as role,status
 from portal_private.ai_coordination_records
 where target_type='DOCUMENT' and target_id=${id} and record_type='FUNCTIONAL_CONCLUSION'
   and functional_role::text in ('FINANCE','LEGAL')
 order by created_at desc limit 30`;
 const f=xs.find((x:any)=>x.role==='FINANCE'),l=xs.find((x:any)=>x.role==='LEGAL');
 return{finance:{status:f?.status||'PENDING',recordId:f?.record_id||null},
   legal:{status:l?.status||'PENDING',recordId:l?.record_id||null},
   approved:f?.status==='APPROVED'&&l?.status==='APPROVED'}
}
export async function actFiles(sql:any,id:string){
 return await sql`select d.id as "documentId",d.document_stage as stage,d.filename,d.uploaded_at as "uploadedAt"
 from portal_private.agent_reward_act_documents_v1 d
 join portal_private.storage_objects o on o.id=d.storage_object_key and o.storage_state='VERIFIED'
 where d.request_key=${id}::uuid order by d.uploaded_at desc limit 30`
}
export async function rowFor(sql:any,id:string){
 if(!ID.test(id))deny('ACT_ID_INVALID',400);
 const rows=await sql`select r.*,d.deal_id,a.agent_person_key,a.agent_legal_entity_key,
 b.agent_legal_entity_key as linked_legal_entity
 from portal_private.agent_reward_act_requests_v1 r
 join portal_private.deals d on d.id=r.deal_key
 join portal_private.agent_client_assignments a on a.id=r.assignment_id
 join portal_private.agent_reward_deal_addenda_v1 b on b.id=r.addendum_key
 where r.id=${id}::uuid limit 2`;
 if(rows.length!==1||String(rows[0].agent_legal_entity_key)!==String(rows[0].linked_legal_entity))
   deny('ACT_SOURCE_ASSOCIATION_INVALID',404);
 return rows[0]
}
async function assertCurrent(sql:any,row:any){
 const x=await sql`select id from portal_private.agent_reward_owner_corrections_v1
 where deal_key=${row.deal_key}::uuid and assignment_id=${row.assignment_id}::uuid
 order by correction_version desc limit 1`;
 if(x.length!==1||String(x[0].id)!==String(row.owner_correction_key))deny('OWNER_CORRECTION_SUPERSEDED')
}
async function stageExists(sql:any,id:string,stage:string){
 const x=await sql`select id from portal_private.agent_reward_act_documents_v1
 where request_key=${id}::uuid and document_stage=${stage} limit 1`;
 return x.length>0
}
async function boundAgent(sql:any,userId:string,row:any){
 const x=await sql`select id from portal_private.agent_user_bindings
 where user_id=${userId}::uuid and agent_person_key=${row.agent_person_key}::uuid
 and agent_legal_entity_key=${row.agent_legal_entity_key}::uuid
 and status::text='ACTIVE' and lifecycle_state::text='ACTIVE'
 and authority_state::text in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
 and valid_from<=now() and (valid_to is null or valid_to>now()) limit 1`;
 return x.length===1
}
async function audit(sql:any,ctx:any,req:Request,action:string,row:any,data:any){
 const incoming=req.headers.get('x-request-id')||'',ref=ID.test(incoming)?incoming:crypto.randomUUID();
 await sql`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata)
 values(${ctx.userId}::uuid,${ctx.role||'ADMIN'},${action},'DEAL',${row.deal_id},${ref}::uuid,${sql.json(data)})`
}
async function uploadAct(req:Request,sql:any,service:any,ctx:any,row:any,stage:string){
 if(!['FINANCE_LEGAL_DRAFT','OWNER_SIGNED','BOTH_SIGNED'].includes(stage))deny('ACT_STAGE_INVALID',400);
 await assertCurrent(sql,row);
 const reviews=await reviewState(sql,String(row.id));
 // Manual paths keep their existing gates. Canonical one-click issuance is allowed
 // to skip the intermediate print-draft only after full, authoritative source checks.
 let form:FormData;try{form=await req.formData()}catch{deny('INVALID_MULTIPART',400)}
 const canonicalAutomatic=stage==='OWNER_SIGNED'&&String(form!.get('canonicalAutomaticIssue'))==='true';
 if(stage!=='FINANCE_LEGAL_DRAFT'&&!reviews.approved)deny('FINANCE_LEGAL_ACT_REVIEW_REQUIRED');
 if(stage==='FINANCE_LEGAL_DRAFT'&&!['REVIEW_REQUESTED','FINANCE_LEGAL_REVIEW'].includes(row.request_status))
   deny('ACT_DRAFT_WRONG_STAGE');
 if(canonicalAutomatic){
   if(form!.get('ownerConfirmsSigning')!=='true'||form!.get('ownerConfirmsFacsimile')!=='true')
     deny('ACT_OWNER_SIGNING_ATTESTATION_REQUIRED',400);
   if(String(row.requested_by)!==String(ctx.userId))deny('ACT_OWNER_IDENTITY_REQUIRED',403);
   await approvedActIssue(sql,ctx,String(row.id));
 }else if(stage==='OWNER_SIGNED'&&(row.request_status!=='DRAFT_READY'||!await stageExists(sql,row.id,'FINANCE_LEGAL_DRAFT')))
   deny('FINANCE_LEGAL_DRAFT_REQUIRED');
 if(stage==='BOTH_SIGNED'&&(!['OWNER_SIGNED','AWAITING_AGENT_SIGNATURE'].includes(row.request_status)
    ||!await stageExists(sql,row.id,'OWNER_SIGNED')))
   deny('OWNER_SIGNED_ACT_REQUIRED');
 const file=form!.get('file');
 if(!(file instanceof File)||file.size<1||file.size>MAX)deny('PDF_SIZE_INVALID',400);
 const name=String(file.name||'').normalize('NFC').split(/[\\/]/).pop()||'';
 if(!/\.pdf$/i.test(name)||name.length>180||(file.type&&file.type!=='application/pdf'))
   deny('PDF_TYPE_INVALID',400);
 const attested=String(form!.get('attestedSigned'))==='true';
 if(stage!=='FINANCE_LEGAL_DRAFT'&&!attested)deny('SIGNED_ACT_ATTESTATION_REQUIRED',400);
 const content=await file.arrayBuffer();
 if(new TextDecoder().decode(content.slice(0,5))!=='%PDF-')deny('PDF_SIGNATURE_INVALID',400);
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',content)))
   .map(x=>x.toString(16).padStart(2,'0')).join('');
 const objectName='agent-services-acts/'+row.deal_id+'/'+row.id+'/'+stage+'-'+crypto.randomUUID()+'.pdf';
 const stored=await service.storage.from(BUCKET).upload(objectName,new Uint8Array(content),
   {contentType:'application/pdf',cacheControl:'0',upsert:false});
 if(stored.error)deny('ACT_STORAGE_UPLOAD_FAILED',502);
 try{
   const store=await sql`select id from storage.objects where bucket_id=${BUCKET} and name=${objectName} limit 1`;
   if(store.length!==1)deny('ACT_STORAGE_OBJECT_MISSING',502);
   const state=stage==='FINANCE_LEGAL_DRAFT'?'DRAFT_READY':
     stage==='OWNER_SIGNED'?'OWNER_SIGNED':'SIGNED_ARCHIVED';
   const rows=await sql.begin(async(tx:any)=>{
     const locked=await tx`select request_status from portal_private.agent_reward_act_requests_v1
       where id=${row.id}::uuid for update`;
     const previous=String(locked[0]?.request_status||'');
     const allowed=stage==='FINANCE_LEGAL_DRAFT'
       ? ['REVIEW_REQUESTED','FINANCE_LEGAL_REVIEW'].includes(previous)
       :stage==='OWNER_SIGNED'
         ? (canonicalAutomatic
           ? ['REVIEW_REQUESTED','FINANCE_LEGAL_REVIEW','DRAFT_READY'].includes(previous)
           : previous==='DRAFT_READY')
         : ['OWNER_SIGNED','AWAITING_AGENT_SIGNATURE'].includes(previous);
     if(!allowed)deny('ACT_STAGE_CHANGED');
     const registered=await tx`insert into portal_private.storage_objects(
       bucket_id,object_name,storage_object_id,object_kind,content_type,byte_size,sha256,storage_state,
       created_by,verified_by,verified_at) values(${BUCKET},${objectName},${store[0].id}::uuid,'DOCUMENT',
       'application/pdf',${file.size},${sha},'VERIFIED',
       ${ctx.userId}::uuid,${ctx.userId}::uuid,now()) returning id`;
     const doc=await tx`insert into portal_private.agent_reward_act_documents_v1(
       request_key,storage_object_key,document_stage,filename,sha256,byte_size,signed_attestation,uploaded_by)
       values(${row.id}::uuid,${registered[0].id}::uuid,${stage},${name},${sha},
       ${file.size},${attested},${ctx.userId}::uuid) returning id`;
     await tx`update portal_private.agent_reward_act_requests_v1
       set request_status=${state},
       finance_review_record_id=${reviews.finance.recordId}::uuid,
       legal_review_record_id=${reviews.legal.recordId}::uuid,
       prepared_at=case when ${stage}='FINANCE_LEGAL_DRAFT' then now() else prepared_at end,
       completed_at=case when ${stage}='BOTH_SIGNED' then now() else completed_at end
       where id=${row.id}::uuid`;
     return doc
   });
   await audit(sql,ctx,req,'AGENT_ACT_'+stage+'_PDF_ARCHIVED',row,{id:rows[0].id,sha,stage});
   return{documentId:rows[0].id,stage,filename:name,sha256:sha}
 }catch(e){await service.storage.from(BUCKET).remove([objectName]).catch(()=>null);throw e}
}
async function publish(sql:any,req:Request,ctx:any,row:any){
 // Agent inbox UI deployment gate: never record delivery before it is visible to the recipient.
 deny('AGENT_PORTAL_INBOX_UI_NOT_DEPLOYED');
 await assertCurrent(sql,row);
 if(row.request_status!=='OWNER_SIGNED'||!await stageExists(sql,row.id,'OWNER_SIGNED'))
   deny('OWNER_SIGNED_ACT_REQUIRED');
 if(!(await reviewState(sql,String(row.id))).approved)deny('FINANCE_LEGAL_ACT_REVIEW_REQUIRED');
 const recipient=await sql`select id from portal_private.agent_user_bindings
 where agent_person_key=${row.agent_person_key}::uuid
 and agent_legal_entity_key=${row.agent_legal_entity_key}::uuid
 and status::text='ACTIVE' and lifecycle_state::text='ACTIVE'
 and authority_state::text in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
 and valid_from<=now() and (valid_to is null or valid_to>now()) limit 1`;
 if(!recipient.length)deny('AGENT_PORTAL_RECIPIENT_NOT_ACTIVE');
 const evidence='AGENT_PORTAL_INBOX:'+row.id;
 const changed=await sql`update portal_private.agent_reward_act_requests_v1
 set request_status='AWAITING_AGENT_SIGNATURE',dispatched_at=now(),dispatch_evidence_ref=${evidence}
 where id=${row.id}::uuid and request_status='OWNER_SIGNED' returning id`;
 if(!changed.length)deny('ACT_DISPATCH_RACE');
 await audit(sql,ctx,req,'AGENT_ACT_DELIVERED_TO_AGENT_PORTAL',row,{evidence});
 return{requestId:row.id,status:'AWAITING_AGENT_SIGNATURE',delivery:'AGENT_PORTAL_INBOX'}
}
async function download(req:Request,sql:any,service:any,ctx:any,row:any,id:string,agent:boolean){
 if(!ID.test(id))deny('ACT_DOCUMENT_ID_INVALID',400);
 if(agent){
   if(!['AWAITING_AGENT_SIGNATURE','SIGNED_ARCHIVED'].includes(row.request_status))
     deny('AGENT_ACT_NOT_PUBLISHED',403);
   if(!await boundAgent(sql,ctx.userId,row))deny('AGENT_ACT_ACCESS_DENIED',403)
 }
 const files=await sql`select d.document_stage,d.filename,o.object_name,o.bucket_id
 from portal_private.agent_reward_act_documents_v1 d
 join portal_private.storage_objects o on o.id=d.storage_object_key and o.storage_state='VERIFIED'
 where d.id=${id}::uuid and d.request_key=${row.id}::uuid limit 1`;
 if(files.length!==1)deny('ACT_DOCUMENT_NOT_FOUND',404);
 const doc=files[0];
 if(agent&&doc.document_stage!=='OWNER_SIGNED')deny('ACT_AGENT_DOCUMENT_STAGE_DENIED',403);
 const {data,error}=await service.storage.from(String(doc.bucket_id||BUCKET))
   .createSignedUrl(String(doc.object_name),120,{download:String(doc.filename)});
 if(error||!data?.signedUrl)deny('ACT_DOWNLOAD_FAILED',502);
 await audit(sql,ctx,req,'AGENT_ACT_PDF_DOWNLOADED',row,{documentId:id,agent,expiresIn:120});
 return{documentId:id,filename:doc.filename,url:data.signedUrl,expiresIn:120}
}
// Owner-authorized graphic facsimile is not a qualified electronic signature.
export async function approvedActIssue(sql:any,ctx:any,id:string){
 const row=await rowFor(sql,id);
 if(String(row.requested_by)!==String(ctx.userId))deny('ACT_OWNER_IDENTITY_REQUIRED',403);
 const owners=await sql`select distinct owner_portal_user_id from portal_private.mcp_oauth_tokens
   where owner_portal_user_id is not null limit 2`;
 if(owners.length!==1||String(owners[0].owner_portal_user_id)!==String(ctx.userId))
   deny('ACT_CANONICAL_OWNER_ONLY',403);
 await assertCurrent(sql,row);
 // The single-click workflow does not create a separate preliminary draft.
 // Finance + Legal approvals and every source gate below are still mandatory.
 if(!['REVIEW_REQUESTED','FINANCE_LEGAL_REVIEW','DRAFT_READY','OWNER_SIGNED'].includes(String(row.request_status)))
   deny('ACT_NOT_READY_FOR_ISSUANCE');
 const review=await reviewState(sql,id);
 if(!review.approved)deny('FINANCE_LEGAL_ACT_REVIEW_REQUIRED');
 const conclusions=await sql`select status,payload from portal_private.ai_coordination_records
   where target_type='DOCUMENT' and target_id=${id}
   and record_type='FUNCTIONAL_CONCLUSION'
   and record_id in (${review.finance.recordId}::uuid,${review.legal.recordId}::uuid)`;
 if(conclusions.length!==2||conclusions.some((x:any)=>
   x.status!=='APPROVED'||x.payload?.confirmed!==true||
   (Array.isArray(x.payload?.mandatory_conditions)&&x.payload.mandatory_conditions.length)))
   deny('ACT_FUNCTIONAL_CONCLUSIONS_UNCONFIRMED');
 const terms=await sql`select t.term_reference,t.commission_mode,t.commission_rate,
   b.document_reference,b.evidence_status,a.document_id,
   l.legal_name,l.tax_identifier,l.registered_address,l.registration_country
   from portal_private.agent_reward_deal_addenda_v1 b
   join portal_private.agent_agency_contract_documents a on a.id=b.agency_document_key
   join portal_private.agent_legal_entities l on l.id=b.agent_legal_entity_key
   join portal_private.agent_deal_terms t on t.id=${row.term_key}::uuid
   where b.id=${row.addendum_key}::uuid and b.deal_key=${row.deal_key}::uuid
   and b.assignment_id=${row.assignment_id}::uuid and b.is_current=true
   and t.id=b.term_key and t.deal_key=b.deal_key and t.assignment_id=b.assignment_id
   and t.status::text='ACTIVE' and t.lifecycle_state::text='ACTIVE'
   and t.authority_state::text in ('CONFIRMED','VERIFIED','AUTHORITATIVE') limit 2`;
 if(terms.length!==1)deny('ACT_SIGNED_ADDENDUM_TERM_NOT_CURRENT');
 const t=terms[0],ordinal=(ref:string)=>{
   const n=[...String(ref||'').matchAll(/(?:ДС|ADDENDUM)\s*(?:№|NO\.?)?\s*0*(\d{1,3})\b/gi)].map(a=>Number(a[1]));
   return n.length===1?n[0]:null;
 };
 const ds=ordinal(t.document_reference),term=ordinal(t.term_reference);
 if(!ds||!term||ds!==term)deny('ACT_SIGNED_ADDENDUM_TERM_CONFLICT');
 const finance=row.finance_snapshot||{},legal=row.legal_snapshot||{};
 const amount=finance.approvedActAmount==null?NaN:Number(finance.approvedActAmount),
   currency=String(finance.approvedCurrency||''),financeRef=String(finance.financeSourceRef||'');
 if(!Number.isFinite(amount)||amount<=0||!/^[A-Z]{3}$/.test(currency)||!financeRef)
   deny('ACT_FINANCE_APPROVED_AMOUNT_MISSING');
 if(String(finance.ownerCorrectionId||'')!==String(row.owner_correction_key)||
    Number(finance.ownerCorrectionVersion)!==Number(row.correction_version)||
    String(finance.approvedTermId||'')!==String(row.term_key)||
    String(finance.signedAddendumDocumentId||'')!==String(t.document_id))
   deny('ACT_FINANCE_SOURCE_SNAPSHOT_MISMATCH');
 if(String(legal.approvedAddendumDocumentId||'')!==String(t.document_id))
   deny('ACT_LEGAL_SOURCE_SNAPSHOT_MISMATCH');
 // Owner confirmed interpretation for DEAL-2026-004 signed DS #1: 50% of
 // VERIFIED NET DEAL PROFIT AFTER TAX, never gross margin or pretax profit.
 // This contract-specific rule MUST NOT silently rewrite other agents' terms.
 let netProfitSource:null|{basis:string,netProfit:number,rate:number}=null;
 if(String(row.deal_id)==='DEAL-2026-004'&&ds===1){
   const profit=finance.approvedNetProfit==null?NaN:Number(finance.approvedNetProfit);
   const share=finance.approvedAgentShare==null?NaN:Number(finance.approvedAgentShare);
   const correctionVersion=finance.ownerCorrectionVersion==null?NaN:Number(finance.ownerCorrectionVersion);
   if(String(finance.approvedBasisType)!=='NET_PROFIT_AFTER_TAX'
       ||!Number.isFinite(profit)||!Number.isFinite(share)||share!==0.5
       ||String(t.commission_mode)!=='PERCENT'||Number(t.commission_rate)!==0.5
       ||String(finance.ownerCorrectionId||'')!==String(row.owner_correction_key)
       ||correctionVersion!==Number(row.correction_version)
       ||String(finance.approvedTermId||'')!==String(row.term_key)
       ||String(finance.signedAddendumDocumentId||'')!==String(t.document_id))
     deny('ACT_VERIFIED_NET_PROFIT_BASIS_REQUIRED');
   const calculated=Math.round((Math.max(0,profit)*0.5+Number.EPSILON)*100)/100;
   if(Math.abs(amount-calculated)>0.0001)
     deny('ACT_AGENT_AMOUNT_NOT_50_PERCENT_OF_NET_PROFIT');
   netProfitSource={basis:'NET_PROFIT_AFTER_TAX',netProfit:profit,rate:0.5};
 }
 const number=String(row.generated_document_number||''),date=String(legal.approvedActDate||''),
   service=String(legal.approvedServiceText||''),period=String(legal.servicePeriod||''),
   signer=String(legal.issuerSignatoryName||''),facsimileRef=String(legal.facsimileAuthorizationRef||''),
   issuerRequisites=String(legal.approvedIssuerRequisites||''),
   issuerName=String(legal.approvedIssuerLegalName||''),
   signingPlace=String(legal.approvedSigningPlace||''),
   agentSignatory=String(legal.approvedAgentSignatory||'');
 if(!number||number!==String(legal.approvedDocumentNumber||'')||
   !/^\d{4}-\d{2}-\d{2}$/.test(date)||!service||!period||!signer||!facsimileRef||
   !issuerRequisites||!issuerName||!signingPlace||!agentSignatory||
   legal.facsimileApproved!==true)
   deny('ACT_LEGAL_APPROVED_DOCUMENT_FIELDS_MISSING');
 return{requestId:row.id,dealId:row.deal_id,documentNumber:number,documentDate:date,
   servicePeriod:period,services:service,amount,currency,issuer:issuerName,signingPlace,
   issuerSigner:signer,issuerRequisites,agentSignatory,
   agentLegalName:t.legal_name,agentTaxId:t.tax_identifier,
   agentAddress:t.registered_address,agentCountry:t.registration_country,
   addendumReference:t.document_reference,addendumDocumentId:t.document_id,
   financeEvidence:review.finance.recordId,legalEvidence:review.legal.recordId,
   financeSourceRef:financeRef,netProfitSource,facsimileAuthorizationRef:facsimileRef,
   documentStandard:'RONA-DOC-STANDARD v2',
   signatureMethod:'OWNER_APPROVED_GRAPHIC_FACSIMILE_NOT_QES',createsPayable:false};
}
export async function issueFinalAct(sql:any,ctx:any,req:Request,id:string){
 const b=await req.json().catch(()=>({}));
 if(b?.ownerConfirmsSigning!==true||b?.ownerConfirmsFacsimile!==true)
   deny('ACT_OWNER_SIGNING_ATTESTATION_REQUIRED',400);
 const ready=await approvedActIssue(sql,ctx,id),row=await rowFor(sql,id);
 await audit(sql,{...ctx,role:'ADMIN'},req,'AGENT_ACT_CANONICAL_FACSIMILE_RENDER_AUTHORIZED',row,{
   documentNumber:ready.documentNumber,finance:ready.financeEvidence,
   legal:ready.legalEvidence,source:ready.financeSourceRef,
   facsimileRef:ready.facsimileAuthorizationRef,
   attested:true,qualifiedElectronicSignature:false,createsPayable:false});
 return ready;
}

export async function agentInbox(sql:any,ctx:any){
 const xs=await sql`select distinct on(r.id) r.id as "requestId",d.deal_id as "dealId",
 r.request_status as status,r.dispatched_at as "dispatchedAt",
 f.id as "documentId",f.filename
 from portal_private.agent_reward_act_requests_v1 r
 join portal_private.deals d on d.id=r.deal_key
 join portal_private.agent_client_assignments a on a.id=r.assignment_id
 join portal_private.agent_reward_act_documents_v1 f
   on f.request_key=r.id and f.document_stage='OWNER_SIGNED'
 join portal_private.agent_user_bindings b on b.agent_person_key=a.agent_person_key
   and b.agent_legal_entity_key=a.agent_legal_entity_key and b.user_id=${ctx.userId}::uuid
   and b.status::text='ACTIVE' and b.lifecycle_state::text='ACTIVE'
   and b.authority_state::text in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
   and b.valid_from<=now() and (b.valid_to is null or b.valid_to>now())
 where r.request_status in ('AWAITING_AGENT_SIGNATURE','SIGNED_ARCHIVED')
 order by r.id,f.uploaded_at desc limit 35`;
 return{acts:xs}
}
export async function agentDownload(req:Request,sql:any,service:any,ctx:any,id:string,documentId:string){
 const row=await rowFor(sql,id);
 return await download(req,sql,service,{...ctx,role:'AGENT'},row,documentId,true)
}
export async function adminActAction(req:Request,sql:any,service:any,ctx:any,
 deal:any,action:string,stage:string){
 const match=action.match(/^acts\/([0-9a-f-]{36})\/(upload|dispatch|finalize|documents\/[0-9a-f-]{36}\/download)$/i);
 if(!match)deny('ACT_ROUTE_INVALID',404);
 const row=await rowFor(sql,match![1]);
 if(String(row.deal_key)!==String(deal.deal_key)||String(row.assignment_id)!==String(deal.assignment_id))
   deny('ACT_SOURCE_SCOPE_DENIED',403);
 if(match![2]==='dispatch'&&req.method==='POST')return await publish(sql,req,{...ctx,role:'ADMIN'},row);
 if(match![2]==='finalize'&&req.method==='POST')return await issueFinalAct(sql,ctx,req,String(row.id));
 if(match![2]==='upload'&&req.method==='POST')return await uploadAct(req,sql,service,{...ctx,role:'ADMIN'},row,stage);
 const doc=match![2].match(/^documents\/([0-9a-f-]{36})\/download$/i);
 if(doc&&req.method==='GET')
   return await download(req,sql,service,{...ctx,role:'ADMIN'},row,doc[1],false);
 deny('ACT_ACTION_NOT_ALLOWED',404)
}
