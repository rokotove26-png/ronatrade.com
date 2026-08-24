// @ts-nocheck

export function createClaimsRuntime(deps:any) {
  const { sql, service, BUCKET, MAX_PDF, audit, reqIds } = deps;

  function clean(v:any, name:string, max=500, required=true) {
    const s=String(v??'').trim();
    if ((required&&!s)||s.length>max) throw Object.assign(new Error(`INVALID_${name}`),{status:400});
    return s;
  }
  async function jsonBody(req:Request) {
    try { const v=await req.json(); if(!v||Array.isArray(v)||typeof v!=='object')throw new Error(); return v; }
    catch { throw Object.assign(new Error('INVALID_JSON'),{status:400}); }
  }
  function safeFilename(name:string) {
    const base=String(name||'document.pdf').split(/[\\/]/).pop()||'document.pdf';
    const x=base.replace(/[^A-Za-z0-9А-Яа-яЁё._()\- ]+/g,'_').slice(0,160);
    return x.toLowerCase().endsWith('.pdf')?x:`${x||'document'}.pdf`;
  }
  async function sha256Hex(bytes:ArrayBuffer|Uint8Array) {
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function sha256Text(v:string) { return sha256Hex(new TextEncoder().encode(String(v))); }
  async function parsePdf(req:Request) {
    let form:FormData;
    try { form=await req.formData(); } catch { throw Object.assign(new Error('INVALID_MULTIPART'),{status:400}); }
    const file=form.get('file');
    if(!(file instanceof File))throw Object.assign(new Error('PDF_REQUIRED'),{status:400});
    if(file.size<=0||file.size>MAX_PDF)throw Object.assign(new Error('PDF_SIZE_INVALID'),{status:400});
    if(!/\.pdf$/i.test(file.name||'')||(file.type&&file.type!=='application/pdf'))throw Object.assign(new Error('PDF_TYPE_INVALID'),{status:400});
    const bytes=await file.arrayBuffer();
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Object.assign(new Error('PDF_SIGNATURE_INVALID'),{status:400});
    return {form,file,bytes,sha256:await sha256Hex(bytes)};
  }
  async function rawStorageObjectId(objectName:string) {
    const rows=await sql`select id from storage.objects where bucket_id=${BUCKET} and name=${objectName} limit 1`;
    return rows[0]?.id?String(rows[0].id):null;
  }
  async function uploadRaw(prefix:string,parsed:any) {
    const objectName=`${prefix}/${crypto.randomUUID()}-${safeFilename(parsed.file.name)}`;
    const {error}=await service.storage.from(BUCKET).upload(objectName,new Uint8Array(parsed.bytes),{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
    if(error)throw Object.assign(new Error('STORAGE_UPLOAD_FAILED'),{status:502});
    const rawId=await rawStorageObjectId(objectName);
    if(!rawId){await service.storage.from(BUCKET).remove([objectName]).catch(()=>{});throw Object.assign(new Error('STORAGE_OBJECT_ID_MISSING'),{status:502})}
    return {objectName,rawId};
  }
  async function createDocumentTx(tx:any,ctx:any,parsed:any,raw:any,meta:any) {
    const docKey=crypto.randomUUID(),versionKey=crypto.randomUUID();
    const sourceSystem=String(meta.sourceSystem||'ADMIN_PORTAL'),sourceVersion=String(meta.sourceVersion||'OWNER_CLAIMS_V2');
    await tx`insert into portal_private.documents(id,document_id,document_type,client_key,contract_key,deal_key,authoritative_filename,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
      values(${docKey}::uuid,${meta.documentId},${meta.documentType},${meta.clientKey}::uuid,${meta.contractKey}::uuid,${meta.dealKey||null}::uuid,${parsed.file.name},${sourceSystem},${sourceVersion},now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
    await tx`insert into portal_private.document_versions(id,document_key,version_number,authoritative_filename,sha256,storage_path,uploaded_by,is_current,is_effective,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
      values(${versionKey}::uuid,${docKey}::uuid,1,${parsed.file.name},${parsed.sha256},${raw.objectName},${ctx.userId}::uuid,true,true,${sourceSystem},${sourceVersion},now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
    await tx`insert into portal_private.storage_objects(bucket_id,object_name,storage_object_id,object_kind,client_key,contract_key,deal_key,document_version_key,content_type,byte_size,sha256,storage_state,created_by,verified_by,verified_at)
      values(${BUCKET},${raw.objectName},${raw.rawId}::uuid,'DOCUMENT',${meta.clientKey}::uuid,${meta.contractKey}::uuid,${meta.dealKey||null}::uuid,${versionKey}::uuid,'application/pdf',${parsed.file.size},${parsed.sha256},'VERIFIED',${ctx.userId}::uuid,${ctx.userId}::uuid,now())`;
    await tx`update portal_private.documents set current_version_id=${versionKey}::uuid,updated_at=now() where id=${docKey}::uuid`;
    return {docKey,documentId:meta.documentId,filename:parsed.file.name,sha256:parsed.sha256};
  }

  async function listClaims() {
    return sql`
      select c.claim_id,coalesce(c.claim_source,'ADMIN') claim_source,cl.client_id,cl.legal_name,ct.contract_id,d.deal_id,c.category,c.subject,c.description,c.status,
             pd.document_id primary_document_id,pd.authoritative_filename primary_filename,
             rd.document_id response_document_id,rd.authoritative_filename response_filename,
             c.received_at,c.decision_at,c.response_sent_at,c.response_sent_by,c.updated_at,
             h.record_id legal_handoff_record_id,h.created_at legal_handoff_at,
             q.state legal_queue_state,
             lc.record_id legal_conclusion_record_id,coalesce(lc.payload->>'status',lc.status) legal_status,
             lc.payload->>'summary' legal_summary,lc.payload->>'recommendation' legal_recommendation,
             coalesce(lc.payload->'open_issues','[]'::jsonb) legal_open_issues,
             coalesce(lc.payload->'risks','[]'::jsonb) legal_risks,lc.created_at legal_updated_at
      from portal_private.owner_claims c
      join portal_private.clients cl on cl.id=c.client_key
      join portal_private.contracts ct on ct.id=c.contract_key
      left join portal_private.deals d on d.id=c.deal_key
      join portal_private.documents pd on pd.id=c.primary_document_key
      left join portal_private.documents rd on rd.id=c.response_document_key
      left join lateral (
        select r.record_id,r.created_at from portal_private.ai_coordination_records r
        where r.target_type='CLAIM' and r.target_id=c.claim_id and r.record_type='HANDOFF_REQUEST' and r.target_role='LEGAL'::portal_private.ai_business_role_enum
        order by r.created_at desc limit 1
      ) h on true
      left join lateral (
        select x.state from portal_private.ai_runtime_queue x where x.source_record_id=h.record_id order by x.created_at desc limit 1
      ) q on true
      left join lateral (
        select r.record_id,r.status,r.payload,r.created_at from portal_private.ai_coordination_records r
        where r.target_type='CLAIM' and r.target_id=c.claim_id and r.record_type='FUNCTIONAL_CONCLUSION' and r.functional_role='LEGAL'::portal_private.ai_business_role_enum
        order by r.created_at desc limit 1
      ) lc on true
      where c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      order by c.updated_at desc,c.received_at desc`;
  }

  async function listClientClaims(ctx:any) {
    return sql`
      select c.claim_id,coalesce(c.claim_source,'ADMIN') claim_source,cl.client_id,cl.legal_name,ct.contract_id,d.deal_id,c.category,c.subject,c.description,c.status,
             pd.document_id primary_document_id,pd.authoritative_filename primary_filename,
             case when c.response_sent_at is not null then rd.document_id else null end response_document_id,
             case when c.response_sent_at is not null then rd.authoritative_filename else null end response_filename,
             c.received_at,c.decision_at,c.response_sent_at,c.updated_at
      from portal_private.owner_claims c
      join portal_private.clients cl on cl.id=c.client_key
      join portal_private.contracts ct on ct.id=c.contract_key
      left join portal_private.deals d on d.id=c.deal_key
      join portal_private.documents pd on pd.id=c.primary_document_key
      left join portal_private.documents rd on rd.id=c.response_document_key
      where c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and exists(
          select 1 from portal_private.client_user_bindings b
          where b.user_id=${ctx.userId}::uuid and b.client_key=c.client_key and b.contract_key=c.contract_key
            and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null
            and b.valid_from<=now() and (b.valid_to is null or b.valid_to>now())
            and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        )
      order by c.updated_at desc,c.received_at desc`;
  }

  async function dispatchLegal(ctx:any,req:Request,claimId:string) {
    const c=(await sql`
      select c.id,c.claim_id,coalesce(c.claim_source,'ADMIN') claim_source,c.category,c.subject,c.description,c.status,cl.client_id,cl.legal_name,ct.contract_id,d.deal_id,pd.document_id,pd.authoritative_filename
      from portal_private.owner_claims c
      join portal_private.clients cl on cl.id=c.client_key
      join portal_private.contracts ct on ct.id=c.contract_key
      left join portal_private.deals d on d.id=c.deal_key
      join portal_private.documents pd on pd.id=c.primary_document_key
      where c.claim_id=${claimId} and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1`)[0];
    if(!c)throw Object.assign(new Error('CLAIM_NOT_FOUND'),{status:404});
    if(String(c.claim_source)!=='CLIENT')throw Object.assign(new Error('LEGAL_HANDOFF_INCOMING_ONLY'),{status:409});
    const countRows=await sql`select count(*)::int n from portal_private.ai_coordination_records where target_type='CLAIM' and target_id=${claimId} and record_type='HANDOFF_REQUEST' and target_role='LEGAL'::portal_private.ai_business_role_enum`;
    const seq=Number(countRows[0]?.n||0)+1;
    const sourceRefs=[String(c.claim_id),String(c.document_id),String(c.client_id),String(c.contract_id),...(c.deal_id?[String(c.deal_id)]:[])];
    const payload={
      reason:'В клиентском портале зарегистрирована претензия клиента. Требуется независимая юридическая оценка до финального решения.',
      subject:`Претензия ${c.claim_id} — юридический анализ`,priority:'HIGH',entity_id:String(c.claim_id),entity_type:'CLAIM',source_refs:sourceRefs,target_role:'LEGAL',claim_source:'CLIENT',
      requested_check:`Провести юридический анализ входящей претензии ${c.claim_id} по клиенту ${c.legal_name}, договору ${c.contract_id}${c.deal_id?`, сделке ${c.deal_id}`:''}. Категория: ${c.category}. Предмет: ${c.subject}. Прочитать подтверждённый документ ${c.document_id} через document_read. Оценить обоснованность требований, договорные и доказательственные риски, необходимые документы, рекомендуемую позицию RONA Trade и условия принятия/отклонения. Не изменять authoritative claim status и документы; вернуть FUNCTIONAL_CONCLUSION с target_type CLAIM / target_id ${c.claim_id}.`
    };
    const idemHash=await sha256Text(`claim:${claimId}:legal:${seq}`),payloadHash=await sha256Text(JSON.stringify(payload));
    const correlationId=reqIds(req).correlationId||crypto.randomUUID(),mcpRequestId=crypto.randomUUID(),recordId=crypto.randomUUID();
    await sql.begin(async(tx:any)=>{
      await tx`insert into portal_private.ai_coordination_records(record_id,record_type,functional_role,identity_id,client_id,server_slug,tool_name,target_type,target_id,target_role,version,idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,correlation_id,mcp_request_id,qa_only)
        values(${recordId}::uuid,'HANDOFF_REQUEST','SYSTEM_ADMIN'::portal_private.ai_business_role_enum,'AI-SYSTEM-ADMIN','portal-client-claims','rona-owner-acceptance','claim_legal_handoff','CLAIM',${claimId},'LEGAL'::portal_private.ai_business_role_enum,${seq},${idemHash},${payloadHash},${sql.json(sourceRefs)},'[]'::jsonb,${sql.json(payload)},'REQUESTED',${correlationId}::uuid,${mcpRequestId}::uuid,false)`;
      await tx`update portal_private.owner_claims set legal_handoff_record_id=${recordId}::uuid,updated_by=${ctx.userId}::uuid,updated_at=now() where claim_id=${claimId}`;
      await audit(tx,ctx,'CLIENT_CLAIM_SENT_TO_LEGAL','CLAIM',claimId,req,{recordId,version:seq,claimSource:'CLIENT'});
    });
    return {claimId,recordId,status:'REQUESTED',version:seq};
  }

  async function registerClaim(ctx:any,req:Request) {
    const parsed=await parsePdf(req),clientId=clean(parsed.form.get('clientId'),'CLIENT_ID',160),contractId=clean(parsed.form.get('contractId'),'CONTRACT_ID',160),dealId=clean(parsed.form.get('dealId'),'DEAL_ID',160,false),category=clean(parsed.form.get('category'),'CATEGORY',120),subject=clean(parsed.form.get('subject'),'SUBJECT',500),description=clean(parsed.form.get('description'),'DESCRIPTION',4000,false);
    const scope=(await sql`
      select cl.id client_key,cl.client_id,cl.legal_name,ct.id contract_key,ct.contract_id
      from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id
      where cl.client_id=${clientId} and ct.contract_id=${contractId}
        and cl.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
        and ct.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
      limit 1`)[0];
    if(!scope)throw Object.assign(new Error('CLIENT_CONTRACT_NOT_FOUND'),{status:404});
    let dealKey=null;
    if(dealId){const d=(await sql`select id from portal_private.deals where deal_id=${dealId} and client_key=${scope.client_key}::uuid and contract_key=${scope.contract_key}::uuid and lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum limit 1`)[0];if(!d)throw Object.assign(new Error('DEAL_SCOPE_MISMATCH'),{status:409});dealKey=String(d.id)}
    const day=new Date().toISOString().slice(0,10).replaceAll('-',''),claimId=`RONA-CLM-${day}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,raw=await uploadRaw(`claims/${clientId}/${claimId}/outgoing`,parsed);
    try{
      await sql.begin(async(tx:any)=>{
        const doc=await createDocumentTx(tx,ctx,parsed,raw,{documentId:`${claimId}-OUT`,documentType:'CLAIM',clientKey:String(scope.client_key),contractKey:String(scope.contract_key),dealKey,sourceSystem:'ADMIN_PORTAL'});
        await tx`insert into portal_private.owner_claims(claim_id,claim_source,client_key,contract_key,deal_key,category,subject,description,status,primary_document_key,created_by,updated_by)
          values(${claimId},'ADMIN',${scope.client_key}::uuid,${scope.contract_key}::uuid,${dealKey||null}::uuid,${category},${subject},${description||null},'REVIEW',${doc.docKey}::uuid,${ctx.userId}::uuid,${ctx.userId}::uuid)`;
        await audit(tx,ctx,'OWNER_CLAIM_REGISTERED_FOR_CLIENT','CLAIM',claimId,req,{claimSource:'ADMIN',clientId,contractId,dealId:dealId||null,documentId:doc.documentId,sha256:doc.sha256,delivery:'CLIENT_PORTAL'});
      });
    }catch(e){await service.storage.from(BUCKET).remove([raw.objectName]).catch(()=>{});throw e}
    return {claimId,claimSource:'ADMIN',clientId,contractId,dealId:dealId||null,status:'REVIEW',clientDelivery:'VISIBLE_IN_CLIENT_PORTAL',legalDispatch:'NOT_APPLICABLE'};
  }

  async function registerClientClaim(ctx:any,req:Request) {
    const parsed=await parsePdf(req),clientId=clean(parsed.form.get('clientId'),'CLIENT_ID',160),contractId=clean(parsed.form.get('contractId'),'CONTRACT_ID',160),dealId=clean(parsed.form.get('dealId'),'DEAL_ID',160,false),category=clean(parsed.form.get('category'),'CATEGORY',120),subject=clean(parsed.form.get('subject'),'SUBJECT',500),description=clean(parsed.form.get('description'),'DESCRIPTION',4000,false);
    const scope=(await sql`
      select cl.id client_key,cl.client_id,cl.legal_name,ct.id contract_key,ct.contract_id
      from portal_private.client_user_bindings b
      join portal_private.clients cl on cl.id=b.client_key
      join portal_private.contracts ct on ct.id=b.contract_key
      where b.user_id=${ctx.userId}::uuid and cl.client_id=${clientId} and ct.contract_id=${contractId}
        and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null
        and b.valid_from<=now() and (b.valid_to is null or b.valid_to>now())
        and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and cl.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
        and ct.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
      limit 1`)[0];
    if(!scope)throw Object.assign(new Error('CLIENT_CONTRACT_ACCESS_DENIED'),{status:403});
    let dealKey=null;
    if(dealId){const d=(await sql`select id from portal_private.deals where deal_id=${dealId} and client_key=${scope.client_key}::uuid and contract_key=${scope.contract_key}::uuid and lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum limit 1`)[0];if(!d)throw Object.assign(new Error('DEAL_SCOPE_MISMATCH'),{status:409});dealKey=String(d.id)}
    const day=new Date().toISOString().slice(0,10).replaceAll('-',''),claimId=`RONA-CLM-${day}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,raw=await uploadRaw(`claims/${clientId}/${claimId}/incoming`,parsed);
    try{
      await sql.begin(async(tx:any)=>{
        const doc=await createDocumentTx(tx,ctx,parsed,raw,{documentId:`${claimId}-IN`,documentType:'CLAIM',clientKey:String(scope.client_key),contractKey:String(scope.contract_key),dealKey,sourceSystem:'CLIENT_PORTAL'});
        await tx`insert into portal_private.owner_claims(claim_id,claim_source,client_key,contract_key,deal_key,category,subject,description,status,primary_document_key,created_by,updated_by)
          values(${claimId},'CLIENT',${scope.client_key}::uuid,${scope.contract_key}::uuid,${dealKey||null}::uuid,${category},${subject},${description||null},'REVIEW',${doc.docKey}::uuid,${ctx.userId}::uuid,${ctx.userId}::uuid)`;
        await audit(tx,ctx,'CLIENT_CLAIM_REGISTERED','CLAIM',claimId,req,{claimSource:'CLIENT',clientId,contractId,dealId:dealId||null,documentId:doc.documentId,sha256:doc.sha256});
      });
    }catch(e){await service.storage.from(BUCKET).remove([raw.objectName]).catch(()=>{});throw e}
    let legal=null;try{legal=await dispatchLegal(ctx,req,claimId)}catch(e){console.error('client claim legal dispatch failed',claimId,e)}
    return {claimId,claimSource:'CLIENT',clientId,contractId,dealId:dealId||null,status:'REVIEW',legalDispatch:legal?.status||'FAILED'};
  }

  async function uploadResponse(ctx:any,req:Request,claimId:string) {
    const parsed=await parsePdf(req),c=(await sql`select c.id,c.claim_source,c.client_key,c.contract_key,c.deal_key,cl.client_id from portal_private.owner_claims c join portal_private.clients cl on cl.id=c.client_key where c.claim_id=${claimId} and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1`)[0];
    if(!c)throw Object.assign(new Error('CLAIM_NOT_FOUND'),{status:404});
    if(String(c.claim_source)!=='CLIENT')throw Object.assign(new Error('RESPONSE_INCOMING_ONLY'),{status:409});
    const raw=await uploadRaw(`claims/${c.client_id}/${claimId}/response`,parsed);
    try{return await sql.begin(async(tx:any)=>{const doc=await createDocumentTx(tx,ctx,parsed,raw,{documentId:`${claimId}-RESP-${crypto.randomUUID().slice(0,6).toUpperCase()}`,documentType:'CLAIM_RESPONSE',clientKey:String(c.client_key),contractKey:String(c.contract_key),dealKey:c.deal_key?String(c.deal_key):null,sourceSystem:'ADMIN_PORTAL'});await tx`update portal_private.owner_claims set response_document_key=${doc.docKey}::uuid,response_sent_at=null,response_sent_by=null,updated_by=${ctx.userId}::uuid,updated_at=now() where id=${c.id}::uuid`;await audit(tx,ctx,'OWNER_CLAIM_RESPONSE_UPLOADED','CLAIM',claimId,req,{documentId:doc.documentId,sha256:doc.sha256});return{claimId,documentId:doc.documentId,filename:doc.filename,responseSentAt:null}})}catch(e){await service.storage.from(BUCKET).remove([raw.objectName]).catch(()=>{});throw e}
  }

  async function sendResponse(ctx:any,req:Request,claimId:string) {
    const c=(await sql`select c.id,c.claim_source,c.response_document_key,rd.document_id from portal_private.owner_claims c left join portal_private.documents rd on rd.id=c.response_document_key where c.claim_id=${claimId} and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1`)[0];
    if(!c)throw Object.assign(new Error('CLAIM_NOT_FOUND'),{status:404});
    if(String(c.claim_source)!=='CLIENT')throw Object.assign(new Error('RESPONSE_INCOMING_ONLY'),{status:409});
    if(!c.response_document_key)throw Object.assign(new Error('RESPONSE_PDF_REQUIRED'),{status:409});
    const sentAt=new Date().toISOString();
    await sql.begin(async(tx:any)=>{await tx`update portal_private.owner_claims set response_sent_at=${sentAt}::timestamptz,response_sent_by=${ctx.userId}::uuid,updated_by=${ctx.userId}::uuid,updated_at=now() where id=${c.id}::uuid`;await audit(tx,ctx,'OWNER_CLAIM_RESPONSE_SENT','CLAIM',claimId,req,{claimSource:'CLIENT',documentId:c.document_id||null,sentAt})});
    return {claimId,documentId:c.document_id||null,responseSentAt:sentAt};
  }

  async function updateStatus(ctx:any,req:Request,claimId:string) {
    const body=await jsonBody(req),status=clean(body.status,'STATUS',40).toUpperCase();
    if(!['REVIEW','ACCEPTED','REJECTED'].includes(status))throw Object.assign(new Error('INVALID_STATUS'),{status:400});
    const c=(await sql`select c.id,c.claim_source,c.status,c.response_document_key,exists(select 1 from portal_private.ai_coordination_records r where r.target_type='CLAIM' and r.target_id=c.claim_id and r.record_type='FUNCTIONAL_CONCLUSION' and r.functional_role='LEGAL'::portal_private.ai_business_role_enum) has_legal_conclusion from portal_private.owner_claims c where c.claim_id=${claimId} and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1`)[0];
    if(!c)throw Object.assign(new Error('CLAIM_NOT_FOUND'),{status:404});
    if(String(c.claim_source)!=='CLIENT')throw Object.assign(new Error('CLAIM_DECISION_INCOMING_ONLY'),{status:409});
    if(status!=='REVIEW'&&!c.has_legal_conclusion)throw Object.assign(new Error('LEGAL_CONCLUSION_REQUIRED'),{status:409});
    if(status==='REJECTED'&&!c.response_document_key)throw Object.assign(new Error('RESPONSE_PDF_REQUIRED'),{status:409});
    await sql.begin(async(tx:any)=>{await tx`update portal_private.owner_claims set status=${status},decision_at=${status==='REVIEW'?null:new Date().toISOString()}::timestamptz,updated_by=${ctx.userId}::uuid,updated_at=now() where id=${c.id}::uuid`;await audit(tx,ctx,'OWNER_CLAIM_STATUS_UPDATED','CLAIM',claimId,req,{from:String(c.status),to:status,claimSource:'CLIENT'})});
    return {claimId,status};
  }

  async function handle(ctx:any,req:Request,path:string,method:string) {
    if(path==='/admin/claims'&&method==='GET')return{status:200,body:{ok:true,data:{claims:await listClaims()}}};
    if(path==='/admin/claims'&&method==='POST')return{status:200,body:{ok:true,data:await registerClaim(ctx,req)}};
    if(path==='/client/claims'&&method==='GET')return{status:200,body:{ok:true,data:{claims:await listClientClaims(ctx)}}};
    if(path==='/client/claims'&&method==='POST')return{status:200,body:{ok:true,data:await registerClientClaim(ctx,req)}};
    let m=path.match(/^\/admin\/claims\/([^/]+)\/legal$/);if(m&&method==='POST')return{status:200,body:{ok:true,data:await dispatchLegal(ctx,req,decodeURIComponent(m[1]))}};
    m=path.match(/^\/admin\/claims\/([^/]+)\/response$/);if(m&&method==='POST')return{status:200,body:{ok:true,data:await uploadResponse(ctx,req,decodeURIComponent(m[1]))}};
    m=path.match(/^\/admin\/claims\/([^/]+)\/send-response$/);if(m&&method==='POST')return{status:200,body:{ok:true,data:await sendResponse(ctx,req,decodeURIComponent(m[1]))}};
    m=path.match(/^\/admin\/claims\/([^/]+)\/status$/);if(m&&method==='POST')return{status:200,body:{ok:true,data:await updateStatus(ctx,req,decodeURIComponent(m[1]))}};
    return null;
  }

  return { handle };
}
