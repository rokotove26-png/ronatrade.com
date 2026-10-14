// @ts-nocheck
// Private, append-only PDF archive for agent legal entities. Upload is NOT legal approval.
const BUCKET="rona-portal-private";
const MAX_BYTES=15*1024*1024;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAgentCompanyArchive({sql,service,audit}){
  const fail=(code,status=400)=>Object.assign(new Error(code),{status});

  async function getAgent(companyId){
    if(!/^S-[0-9A-Za-z-]{1,40}$/.test(companyId))throw fail("AGENT_COMPANY_ID_INVALID");
    const rows=await sql`select id,agent_legal_entity_id,legal_name from portal_private.agent_legal_entities
      where agent_legal_entity_id=${companyId}
        and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      limit 1`;
    if(!rows.length)throw fail("AGENT_COMPANY_NOT_FOUND",404);
    return rows[0];
  }

  async function directory(){
    const [companies,assignments,docs]=await Promise.all([
      sql`select id,agent_legal_entity_id,legal_name from portal_private.agent_legal_entities
        where lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
        order by legal_name,agent_legal_entity_id`,
      sql`select aca.agent_legal_entity_key,cl.client_id,cl.legal_name,ap.agent_person_id,
          coalesce(ap.display_alias,ap.full_name,ap.agent_person_id) as representative_name
        from portal_private.agent_client_assignments aca
        join portal_private.clients cl on cl.id=aca.client_key
        join portal_private.agent_persons ap on ap.id=aca.agent_person_key
        where aca.status='ACTIVE'::portal_private.binding_status_enum
          and aca.valid_from<=now() and (aca.valid_to is null or aca.valid_to>now())
          and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and aca.agent_legal_entity_key is not null
        order by cl.legal_name`,
      sql`select id,agent_legal_entity_key,document_kind,document_number,original_filename,
          byte_size,review_status,uploaded_at
        from portal_private.agent_company_documents_v1 order by uploaded_at desc`
    ]);
    return {agents:companies.map(c=>{
      const assigned=assignments.filter(a=>String(a.agent_legal_entity_key)===String(c.id));
      const representatives=[...new Map(assigned.map(a=>[String(a.agent_person_id),{
        agentPersonId:String(a.agent_person_id),name:String(a.representative_name)
      }])).values()];
      return {
        agentLegalEntityId:String(c.agent_legal_entity_id),legalName:String(c.legal_name),
        representatives,agentPersonId:representatives.length===1?representatives[0].agentPersonId:null,
        clients:[...new Map(assigned.map(a=>[String(a.client_id),{
          clientId:String(a.client_id),legalName:String(a.legal_name)
        }])).values()],
        documents:docs.filter(d=>String(d.agent_legal_entity_key)===String(c.id)).map(d=>({
          id:String(d.id),kind:String(d.document_kind),number:d.document_number?String(d.document_number):null,
          filename:String(d.original_filename),size:Number(d.byte_size),
          reviewStatus:String(d.review_status),uploadedAt:d.uploaded_at
        }))
      };
    })};
  }

  async function attach(ctx,req,companyId){
    const agent=await getAgent(companyId);
    const form=await req.formData().catch(()=>{throw fail("AGENT_DOCUMENT_FORM_INVALID")});
    const file=form.get("file"),kind=String(form.get("documentKind")||"");
    const number=String(form.get("documentNumber")||"").trim();
    if(!["AGENCY_CONTRACT","AGENCY_ADDENDUM"].includes(kind))throw fail("AGENT_DOCUMENT_KIND_INVALID");
    if(number.length>120)throw fail("AGENT_DOCUMENT_NUMBER_INVALID");
    if(String(form.get("signedAttested"))!=="true")throw fail("SIGNED_DOCUMENT_ATTESTATION_REQUIRED");
    if(!(file instanceof File))throw fail("SIGNED_DOCUMENT_PDF_REQUIRED");
    const filename=String(file.name||"").replace(/[\/\\\u0000-\u001f]/g,"_").trim();
    if(!filename||filename.length>240||!/\.pdf$/i.test(filename))throw fail("SIGNED_DOCUMENT_PDF_NAME_INVALID");
    if(file.size<8||file.size>MAX_BYTES)throw fail("SIGNED_DOCUMENT_PDF_SIZE_INVALID");
    if(file.type&&file.type!=="application/pdf")throw fail("SIGNED_DOCUMENT_PDF_TYPE_INVALID");
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(String.fromCharCode(...bytes.slice(0,5))!=="%PDF-")throw fail("SIGNED_DOCUMENT_PDF_SIGNATURE_INVALID");
    const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)))
      .map(v=>v.toString(16).padStart(2,"0")).join("");
    const duplicates=await sql`select id from portal_private.agent_company_documents_v1
      where agent_legal_entity_key=${agent.id}::uuid and sha256=${sha} limit 1`;
    if(duplicates.length)return {id:String(duplicates[0].id),existing:true};
    const docId=crypto.randomUUID(),storagePath="agent-company-documents/"+companyId+"/"+docId+".pdf";
    const upload=await service.storage.from(BUCKET).upload(
      storagePath,new Blob([bytes],{type:"application/pdf"}),
      {contentType:"application/pdf",cacheControl:"0",upsert:false}
    );
    if(upload.error)throw fail("SIGNED_DOCUMENT_STORAGE_FAILED",502);
    try{
      await sql.begin(async tx=>{
        await tx`insert into portal_private.agent_company_documents_v1
          (id,agent_legal_entity_key,document_kind,document_number,original_filename,
           sha256,byte_size,storage_bucket,storage_path,uploaded_by,admin_signed_attested)
          values(${docId}::uuid,${agent.id}::uuid,${kind},${number||null},${filename},
                 ${sha},${bytes.byteLength},${BUCKET},${storagePath},${ctx.user}::uuid,true)`;
        await audit(tx,ctx,"AGENT_COMPANY_SIGNED_DOCUMENT_UPLOADED","DOCUMENT",docId,req,{
          agentLegalEntityId:companyId,documentKind:kind,documentNumber:number||null,
          sha256:sha,reviewStatus:"UPLOADED",legalAuthorityChanged:false
        });
      });
      return {id:docId,existing:false,reviewStatus:"UPLOADED"};
    }catch(e){
      await service.storage.from(BUCKET).remove([storagePath]).catch(()=>{});
      if(String(e?.code)==="23505"){
        const duplicate=await sql`select id from portal_private.agent_company_documents_v1
          where agent_legal_entity_key=${agent.id}::uuid and sha256=${sha} limit 1`;
        if(duplicate.length)return {id:String(duplicate[0].id),existing:true};
      }
      throw e;
    }
  }

  async function download(companyId,docId){
    const agent=await getAgent(companyId);
    if(!UUID_RE.test(docId))throw fail("AGENT_DOCUMENT_ID_INVALID");
    const docs=await sql`select id,original_filename,storage_path from portal_private.agent_company_documents_v1
      where id=${docId}::uuid and agent_legal_entity_key=${agent.id}::uuid limit 1`;
    if(!docs.length)throw fail("AGENT_DOCUMENT_NOT_FOUND",404);
    const doc=docs[0],{data,error}=await service.storage.from(BUCKET)
      .createSignedUrl(String(doc.storage_path),60,{download:String(doc.original_filename)});
    if(error||!data?.signedUrl)throw fail("AGENT_DOCUMENT_DOWNLOAD_UNAVAILABLE",502);
    return {url:data.signedUrl,expiresInSeconds:60,filename:String(doc.original_filename)};
  }
  return {directory,attach,download};
}
