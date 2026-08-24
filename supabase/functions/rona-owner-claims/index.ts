// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");
const sql = postgres(DB, { prepare: false, max: 1 });
const BUCKET = "rona-portal-private";
const MAX_PDF = 50 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function runtimeKey(kind) {
  const legacy = kind === "pub" ? Deno.env.get("SUPABASE_ANON_KEY") : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get(kind === "pub" ? "SUPABASE_PUBLISHABLE_KEYS" : "SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.default) return parsed.default;
  }
  throw new Error("key missing");
}
const service = createClient(SUPA_URL, runtimeKey("secret"), { auth: { persistSession: false, autoRefreshToken: false } });

function send(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function pathOf(req) {
  const p = new URL(req.url).pathname;
  const marker = "/rona-owner-claims";
  const i = p.indexOf(marker);
  return i >= 0 ? (p.slice(i + marker.length) || "/") : p;
}
function jwtClaims(token) {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4)));
  } catch { return {}; }
}
async function authContext(req) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const client = createClient(SUPA_URL, runtimeKey("pub"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const sid = jwtClaims(token).session_id;
  if (typeof sid !== "string" || !UUID_RE.test(sid)) return null;
  const rows = await sql`
    select a.portal_user_id,a.display_name,a.roles,s.not_after
    from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a
    join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid
    where a.session_allowed and (s.not_after is null or s.not_after>now())
  `;
  if (rows.length !== 1) return null;
  return { authUserId: String(data.user.id), userId: String(rows[0].portal_user_id), displayName: String(rows[0].display_name || ""), roles: (rows[0].roles || []).map(String), sessionId: sid };
}
function requireAdmin(ctx) {
  if (!ctx?.roles?.includes("ADMIN")) throw Object.assign(new Error("ROLE_MISMATCH"), { status: 403 });
}
function clean(v, name, max = 500, required = true) {
  const s = String(v ?? "").trim();
  if ((required && !s) || s.length > max) throw Object.assign(new Error(`INVALID_${name}`), { status: 400 });
  return s;
}
function reqIds(req) {
  const r = req.headers.get("x-request-id"), c = req.headers.get("x-correlation-id");
  return { requestId: r && UUID_RE.test(r) ? r : crypto.randomUUID(), correlationId: c && UUID_RE.test(c) ? c : null };
}
async function audit(tx, ctx, action, entityType, entityId, req, metadata = {}) {
  const { requestId, correlationId } = reqIds(req);
  await tx`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
    values(${ctx.userId}::uuid,'ADMIN',${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,${sql.json(metadata)})`;
}
async function jsonBody(req) {
  try { const v = await req.json(); if (!v || Array.isArray(v) || typeof v !== "object") throw new Error(); return v; }
  catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}
function safeFilename(name) { return String(name || "document.pdf").replace(/[^0-9A-Za-zА-Яа-яЁё._()\- ]+/g, "_").slice(0, 180) || "document.pdf"; }
async function sha256Hex(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function sha256Text(value) { return sha256Hex(new TextEncoder().encode(String(value))); }
async function parsePdf(req) {
  let form;
  try { form = await req.formData(); } catch { throw Object.assign(new Error("INVALID_MULTIPART"), { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) throw Object.assign(new Error("PDF_REQUIRED"), { status: 400 });
  if (file.size <= 0 || file.size > MAX_PDF) throw Object.assign(new Error("PDF_SIZE_INVALID"), { status: 400 });
  if (!/\.pdf$/i.test(file.name || "") || (file.type && file.type !== "application/pdf")) throw Object.assign(new Error("PDF_TYPE_INVALID"), { status: 400 });
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw Object.assign(new Error("PDF_SIGNATURE_INVALID"), { status: 400 });
  return { form, file, bytes, sha256: await sha256Hex(bytes) };
}
async function rawStorageObjectId(objectName) {
  const rows = await sql`select id from storage.objects where bucket_id=${BUCKET} and name=${objectName} limit 1`;
  return rows[0]?.id ? String(rows[0].id) : null;
}
async function uploadRaw(prefix, parsed) {
  const objectName = `${prefix}/${crypto.randomUUID()}-${safeFilename(parsed.file.name)}`;
  const { error } = await service.storage.from(BUCKET).upload(objectName, new Uint8Array(parsed.bytes), { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
  if (error) throw Object.assign(new Error("STORAGE_UPLOAD_FAILED"), { status: 502 });
  const rawId = await rawStorageObjectId(objectName);
  if (!rawId) {
    await service.storage.from(BUCKET).remove([objectName]).catch(() => {});
    throw Object.assign(new Error("STORAGE_OBJECT_ID_MISSING"), { status: 502 });
  }
  return { objectName, rawId };
}
async function createDocumentTx(tx, ctx, parsed, raw, meta) {
  const docKey = crypto.randomUUID(), versionKey = crypto.randomUUID();
  await tx`insert into portal_private.documents(id,document_id,document_type,client_key,contract_key,deal_key,authoritative_filename,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
    values(${docKey}::uuid,${meta.documentId},${meta.documentType},${meta.clientKey}::uuid,${meta.contractKey}::uuid,${meta.dealKey || null}::uuid,${parsed.file.name},'ADMIN_PORTAL','OWNER_CLAIMS_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
  await tx`insert into portal_private.document_versions(id,document_key,version_number,authoritative_filename,sha256,storage_path,uploaded_by,is_current,is_effective,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
    values(${versionKey}::uuid,${docKey}::uuid,1,${parsed.file.name},${parsed.sha256},${raw.objectName},${ctx.userId}::uuid,true,true,'ADMIN_PORTAL','OWNER_CLAIMS_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
  await tx`insert into portal_private.storage_objects(bucket_id,object_name,storage_object_id,object_kind,client_key,contract_key,deal_key,document_version_key,content_type,byte_size,sha256,storage_state,created_by,verified_by,verified_at)
    values(${BUCKET},${raw.objectName},${raw.rawId}::uuid,'DOCUMENT',${meta.clientKey}::uuid,${meta.contractKey}::uuid,${meta.dealKey || null}::uuid,${versionKey}::uuid,'application/pdf',${parsed.file.size},${parsed.sha256},'VERIFIED',${ctx.userId}::uuid,${ctx.userId}::uuid,now())`;
  await tx`update portal_private.documents set current_version_id=${versionKey}::uuid,updated_at=now() where id=${docKey}::uuid`;
  return { docKey, documentId: meta.documentId, filename: parsed.file.name, sha256: parsed.sha256 };
}

async function listClaims() {
  return await sql`
    select c.claim_id,cl.client_id,cl.legal_name,ct.contract_id,d.deal_id,c.category,c.subject,c.description,c.status,
           pd.document_id primary_document_id,pd.authoritative_filename primary_filename,
           rd.document_id response_document_id,rd.authoritative_filename response_filename,
           c.received_at,c.decision_at,c.updated_at,
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

async function dispatchLegal(ctx, req, claimId) {
  const c = (await sql`
    select c.id,c.claim_id,c.category,c.subject,c.description,c.status,cl.client_id,cl.legal_name,ct.contract_id,d.deal_id,pd.document_id,pd.authoritative_filename
    from portal_private.owner_claims c
    join portal_private.clients cl on cl.id=c.client_key
    join portal_private.contracts ct on ct.id=c.contract_key
    left join portal_private.deals d on d.id=c.deal_key
    join portal_private.documents pd on pd.id=c.primary_document_key
    where c.claim_id=${claimId} and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1`)[0];
  if (!c) throw Object.assign(new Error("CLAIM_NOT_FOUND"), { status: 404 });
  const countRows = await sql`select count(*)::int n from portal_private.ai_coordination_records where target_type='CLAIM' and target_id=${claimId} and record_type='HANDOFF_REQUEST' and target_role='LEGAL'::portal_private.ai_business_role_enum`;
  const seq = Number(countRows[0]?.n || 0) + 1;
  const sourceRefs = [String(c.claim_id), String(c.document_id), String(c.client_id), String(c.contract_id), ...(c.deal_id ? [String(c.deal_id)] : [])];
  const payload = {
    reason: "В Admin Portal зарегистрирована претензия. Требуется независимая юридическая оценка до финального решения.",
    subject: `Претензия ${c.claim_id} — юридический анализ`,
    priority: "HIGH",
    entity_id: String(c.claim_id),
    entity_type: "CLAIM",
    source_refs: sourceRefs,
    target_role: "LEGAL",
    requested_check: `Провести юридический анализ претензии ${c.claim_id} по клиенту ${c.legal_name}, договору ${c.contract_id}${c.deal_id ? `, сделке ${c.deal_id}` : ""}. Категория: ${c.category}. Предмет: ${c.subject}. Оценить обоснованность требований, договорные и доказательственные риски, необходимые документы, рекомендуемую позицию RONA Trade и условия принятия/отклонения. Не изменять authoritative claim status и документы; вернуть FUNCTIONAL_CONCLUSION с target_type CLAIM / target_id ${c.claim_id}.`
  };
  const idemHash = await sha256Text(`claim:${claimId}:legal:${seq}`);
  const payloadHash = await sha256Text(JSON.stringify(payload));
  const correlationId = reqIds(req).correlationId || crypto.randomUUID();
  const mcpRequestId = crypto.randomUUID();
  const recordId = crypto.randomUUID();
  await sql.begin(async tx => {
    await tx`insert into portal_private.ai_coordination_records(record_id,record_type,functional_role,identity_id,client_id,server_slug,tool_name,target_type,target_id,target_role,version,idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,correlation_id,mcp_request_id,qa_only)
      values(${recordId}::uuid,'HANDOFF_REQUEST','SYSTEM_ADMIN'::portal_private.ai_business_role_enum,'AI-SYSTEM-ADMIN','portal-admin-claims','rona-owner-claims','claim_legal_handoff','CLAIM',${claimId},'LEGAL'::portal_private.ai_business_role_enum,${seq},${idemHash},${payloadHash},${sql.json(sourceRefs)},'[]'::jsonb,${sql.json(payload)},'REQUESTED',${correlationId}::uuid,${mcpRequestId}::uuid,false)`;
    await tx`update portal_private.owner_claims set legal_handoff_record_id=${recordId}::uuid,updated_by=${ctx.userId}::uuid,updated_at=now() where claim_id=${claimId}`;
    await audit(tx,ctx,'OWNER_CLAIM_SENT_TO_LEGAL','CLAIM',claimId,req,{recordId,version:seq});
  });
  return { claimId, recordId, status: "REQUESTED", version: seq };
}

async function registerClaim(ctx, req) {
  const parsed = await parsePdf(req);
  const clientId = clean(parsed.form.get("clientId"), "CLIENT_ID", 160);
  const contractId = clean(parsed.form.get("contractId"), "CONTRACT_ID", 160);
  const dealId = clean(parsed.form.get("dealId"), "DEAL_ID", 160, false);
  const category = clean(parsed.form.get("category"), "CATEGORY", 120);
  const subject = clean(parsed.form.get("subject"), "SUBJECT", 500);
  const description = clean(parsed.form.get("description"), "DESCRIPTION", 4000, false);
  const scope = (await sql`
    select cl.id client_key,cl.client_id,cl.legal_name,ct.id contract_key,ct.contract_id
    from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id
    where cl.client_id=${clientId} and ct.contract_id=${contractId}
      and cl.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
      and ct.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
    limit 1`)[0];
  if (!scope) throw Object.assign(new Error("CLIENT_CONTRACT_NOT_FOUND"), { status: 404 });
  let dealKey = null;
  if (dealId) {
    const d = (await sql`select id from portal_private.deals where deal_id=${dealId} and client_key=${scope.client_key}::uuid and contract_key=${scope.contract_key}::uuid and lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum limit 1`)[0];
    if (!d) throw Object.assign(new Error("DEAL_SCOPE_MISMATCH"), { status: 409 });
    dealKey = String(d.id);
  }
  const day = new Date().toISOString().slice(0,10).replaceAll("-","");
  const claimId = `RONA-CLM-${day}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const raw = await uploadRaw(`claims/${clientId}/${claimId}/incoming`, parsed);
  try {
    await sql.begin(async tx => {
      const doc = await createDocumentTx(tx,ctx,parsed,raw,{documentId:`${claimId}-IN`,documentType:'CLAIM',clientKey:String(scope.client_key),contractKey:String(scope.contract_key),dealKey});
      await tx`insert into portal_private.owner_claims(claim_id,client_key,contract_key,deal_key,category,subject,description,status,primary_document_key,created_by,updated_by)
        values(${claimId},${scope.client_key}::uuid,${scope.contract_key}::uuid,${dealKey || null}::uuid,${category},${subject},${description || null},'REVIEW',${doc.docKey}::uuid,${ctx.userId}::uuid,${ctx.userId}::uuid)`;
      await audit(tx,ctx,'OWNER_CLAIM_REGISTERED','CLAIM',claimId,req,{clientId,contractId,dealId:dealId||null,documentId:doc.documentId,sha256:doc.sha256});
    });
  } catch (e) {
    await service.storage.from(BUCKET).remove([raw.objectName]).catch(() => {});
    throw e;
  }
  let legal = null;
  try { legal = await dispatchLegal(ctx,req,claimId); } catch (e) { console.error('claim legal dispatch failed',claimId,e); }
  return { claimId, clientId, contractId, dealId: dealId || null, status: 'REVIEW', legalDispatch: legal?.status || 'FAILED' };
}

async function uploadResponse(ctx, req, claimId) {
  const parsed = await parsePdf(req);
  const c = (await sql`
    select c.id,c.client_key,c.contract_key,c.deal_key,cl.client_id
    from portal_private.owner_claims c join portal_private.clients cl on cl.id=c.client_key
    where c.claim_id=${claimId} and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1`)[0];
  if (!c) throw Object.assign(new Error('CLAIM_NOT_FOUND'), { status: 404 });
  const raw = await uploadRaw(`claims/${c.client_id}/${claimId}/response`, parsed);
  try {
    return await sql.begin(async tx => {
      const doc = await createDocumentTx(tx,ctx,parsed,raw,{documentId:`${claimId}-RESP-${crypto.randomUUID().slice(0,6).toUpperCase()}`,documentType:'CLAIM_RESPONSE',clientKey:String(c.client_key),contractKey:String(c.contract_key),dealKey:c.deal_key?String(c.deal_key):null});
      await tx`update portal_private.owner_claims set response_document_key=${doc.docKey}::uuid,updated_by=${ctx.userId}::uuid,updated_at=now() where id=${c.id}::uuid`;
      await audit(tx,ctx,'OWNER_CLAIM_RESPONSE_UPLOADED','CLAIM',claimId,req,{documentId:doc.documentId,sha256:doc.sha256});
      return { claimId, documentId: doc.documentId, filename: doc.filename };
    });
  } catch (e) {
    await service.storage.from(BUCKET).remove([raw.objectName]).catch(() => {});
    throw e;
  }
}

async function updateStatus(ctx, req, claimId) {
  const body = await jsonBody(req);
  const status = clean(body.status,'STATUS',40).toUpperCase();
  if (!['REVIEW','ACCEPTED','REJECTED'].includes(status)) throw Object.assign(new Error('INVALID_STATUS'), { status: 400 });
  const c = (await sql`
    select c.id,c.status,c.response_document_key,
      exists(select 1 from portal_private.ai_coordination_records r where r.target_type='CLAIM' and r.target_id=c.claim_id and r.record_type='FUNCTIONAL_CONCLUSION' and r.functional_role='LEGAL'::portal_private.ai_business_role_enum) has_legal_conclusion
    from portal_private.owner_claims c where c.claim_id=${claimId} and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1`)[0];
  if (!c) throw Object.assign(new Error('CLAIM_NOT_FOUND'), { status: 404 });
  if (status !== 'REVIEW' && !c.has_legal_conclusion) throw Object.assign(new Error('LEGAL_CONCLUSION_REQUIRED'), { status: 409 });
  if (status === 'REJECTED' && !c.response_document_key) throw Object.assign(new Error('RESPONSE_PDF_REQUIRED'), { status: 409 });
  await sql.begin(async tx => {
    await tx`update portal_private.owner_claims set status=${status},decision_at=${status==='REVIEW'?null:new Date().toISOString()}::timestamptz,updated_by=${ctx.userId}::uuid,updated_at=now() where id=${c.id}::uuid`;
    await audit(tx,ctx,'OWNER_CLAIM_STATUS_UPDATED','CLAIM',claimId,req,{from:String(c.status),to:status});
  });
  return { claimId, status };
}

Deno.serve(async req => {
  try {
    const ctx = await authContext(req);
    if (!ctx) return send(401,{ok:false,code:'AUTH_REQUIRED'});
    requireAdmin(ctx);
    const path = pathOf(req), method = req.method.toUpperCase();
    if (path === '/admin/claims' && method === 'GET') return send(200,{ok:true,data:{claims:await listClaims()}});
    if (path === '/admin/claims' && method === 'POST') return send(200,{ok:true,data:await registerClaim(ctx,req)});
    let m = path.match(/^\/admin\/claims\/([^/]+)\/legal$/);
    if (m && method === 'POST') return send(200,{ok:true,data:await dispatchLegal(ctx,req,decodeURIComponent(m[1]))});
    m = path.match(/^\/admin\/claims\/([^/]+)\/response$/);
    if (m && method === 'POST') return send(200,{ok:true,data:await uploadResponse(ctx,req,decodeURIComponent(m[1]))});
    m = path.match(/^\/admin\/claims\/([^/]+)\/status$/);
    if (m && method === 'POST') return send(200,{ok:true,data:await updateStatus(ctx,req,decodeURIComponent(m[1]))});
    return send(404,{ok:false,code:'ROUTE_NOT_FOUND'});
  } catch (e) {
    console.error('rona-owner-claims error',e);
    const status = Number(e?.status || 500);
    return send(status>=400&&status<600?status:500,{ok:false,code:String(e?.message || 'SERVER_ERROR')});
  }
});
