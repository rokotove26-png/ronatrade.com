// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");
const sql = postgres(DB, { prepare: false, max: 1 });
const BUCKET = "rona-portal-private";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PDF_MAX = 50 * 1024 * 1024;

function runtimeKey(kind) {
  const legacy = kind === "pub" ? Deno.env.get("SUPABASE_ANON_KEY") : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get(kind === "pub" ? "SUPABASE_PUBLISHABLE_KEYS" : "SUPABASE_SECRET_KEYS");
  if (raw) { const parsed = JSON.parse(raw); if (parsed.default) return parsed.default; }
  throw new Error("key missing");
}
const service = createClient(SUPA_URL, runtimeKey("secret"), { auth: { persistSession: false, autoRefreshToken: false } });

function send(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function pathOf(req) {
  const p = new URL(req.url).pathname, marker = "/rona-admin-client-authority", i = p.indexOf(marker);
  return i >= 0 ? (p.slice(i + marker.length) || "/") : p;
}
function claims(token) {
  try { const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4))); }
  catch { return {}; }
}
async function adminContext(req) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const client = createClient(SUPA_URL, runtimeKey("pub"), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const sid = claims(token).session_id;
  if (typeof sid !== "string" || !UUID_RE.test(sid)) return null;
  const rows = await sql`
    select a.portal_user_id,a.display_name,a.roles,s.not_after
    from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a
    join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid
    where a.session_allowed and (s.not_after is null or s.not_after>now())
  `;
  if (rows.length !== 1 || !(rows[0].roles || []).map(String).includes("ADMIN")) return null;
  return { auth: data.user.id, user: String(rows[0].portal_user_id), name: String(rows[0].display_name || ""), sid };
}
function requestIds(req) {
  const rh = req.headers.get("x-request-id"), ch = req.headers.get("x-correlation-id");
  return { requestId: rh && UUID_RE.test(rh) ? rh : crypto.randomUUID(), correlationId: ch && UUID_RE.test(ch) ? ch : null };
}
async function audit(tx, ctx, action, entityType, entityId, req, metadata = {}) {
  const { requestId, correlationId } = requestIds(req);
  await tx`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
    values(${ctx.user}::uuid,'ADMIN',${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,${sql.json(metadata)})`;
  return requestId;
}
async function jsonBody(req) {
  try { const v = await req.json(); if (!v || Array.isArray(v) || typeof v !== "object") throw new Error(); return v; }
  catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}
function requiredText(v, name, max = 240) {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw Object.assign(new Error(`INVALID_${name}`), { status: 400 });
  return v.trim();
}
function validatePassword(v) {
  const p = requiredText(v, "INITIAL_PASSWORD", 128);
  if (p.length < 10 || !/[a-zа-яё]/.test(p) || !/[A-ZА-ЯЁ]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-zА-Яа-яЁё0-9]/.test(p)) throw Object.assign(new Error("PASSWORD_POLICY_FAILED"), { status: 400 });
  return p;
}
function safeFilename(name) {
  const base = String(name || "signed-contract.pdf").split(/[\\/]/).pop() || "signed-contract.pdf";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "signed-contract"}.pdf`;
}
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function resolveSourceCandidate(selectionId, clientIdHint = "") {
  const id = requiredText(selectionId, "CONTRACT_ID", 160), client = String(clientIdHint || "").trim();
  const rows = await sql`
    select ct.id contract_key,ct.contract_id,ct.contract_status,ct.current_external_contract_number,
           ct.authority_state::text contract_authority,ct.lifecycle_state::text contract_lifecycle,
           ct.current_signed_document_id,ct.signed_contract_confirmed_at,ct.signed_contract_confirmed_by,
           cl.id client_key,cl.client_id,cl.legal_name,cl.authority_state::text client_authority,cl.lifecycle_state::text client_lifecycle
    from portal_private.contracts ct
    join portal_private.clients cl on cl.id=ct.client_key
    where (ct.contract_id=${id} or cl.client_id=${id})
      and (${client}='' or cl.client_id=${client})
      and ct.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and ct.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
      and cl.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and cl.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
    order by case when ct.contract_id=${id} then 0 else 1 end,ct.updated_at desc
    limit 2
  `;
  if (!rows.length) throw Object.assign(new Error("EXECUTIVE_SOURCE_CONTRACT_REQUIRED"), { status: 409 });
  if (rows.length > 1 && String(rows[0].contract_id) !== id) throw Object.assign(new Error("SOURCE_CONTRACT_AMBIGUOUS"), { status: 409 });
  return rows[0];
}
async function bindingEligible(contractId) {
  const rows = await sql`
    select ct.id contract_key,ct.client_key,cl.client_id,cl.legal_name,ct.contract_id
    from portal_private.contracts ct join portal_private.clients cl on cl.id=ct.client_key
    join portal_private.documents d on d.id=ct.current_signed_document_id
    join portal_private.document_versions dv on dv.id=d.current_version_id
    join portal_private.storage_objects so on so.document_version_key=dv.id and so.storage_state='VERIFIED'
    where ct.contract_id=${contractId} and ct.contract_status='ACTIVE'
      and ct.authority_state='CONFIRMED'::portal_private.authority_state_enum
      and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and d.authority_state='CONFIRMED'::portal_private.authority_state_enum and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and dv.authority_state='CONFIRMED'::portal_private.authority_state_enum and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and dv.is_current and dv.is_effective and ct.signed_contract_confirmed_at is not null and ct.signed_contract_confirmed_by is not null
      and exists(select 1 from portal_private.audit_events ae where ae.action='BILATERAL_CONTRACT_ATTACH_CONFIRMED' and ae.entity_type='CONTRACT'
        and ae.entity_id=ct.contract_id and ae.actor_user_id=ct.signed_contract_confirmed_by
        and ae.metadata->>'document_id'=d.document_id and lower(coalesce(ae.metadata->>'sha256',''))=lower(dv.sha256)
        and coalesce((ae.metadata->>'storage_verified')::boolean,false))
    limit 1
  `;
  return rows[0] || null;
}
async function assertLoginAvailable(login) {
  if ((await sql`select 1 from portal_private.portal_users where lower(login_name)=lower(${login}) limit 1`).length) throw Object.assign(new Error("LOGIN_ALREADY_EXISTS"), { status: 409 });
}
async function createClientUser(ctx, req) {
  const b = await jsonBody(req);
  const role = String(b.role || "Клиент").trim();
  if (!new Set(["Клиент","CLIENT"]).has(role)) throw Object.assign(new Error("CLIENT_ROLE_ONLY"), { status: 400 });
  const name = requiredText(b.name, "NAME", 200), login = requiredText(b.login, "LOGIN", 160), email = requiredText(b.email, "EMAIL", 320).toLowerCase(), password = validatePassword(b.initialPassword);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("INVALID_EMAIL"), { status: 400 });
  const phone = String(b.phone || "").trim() || null;
  const requestedRaw = Array.isArray(b.contractIds) ? [...new Set(b.contractIds.map(String).filter(Boolean))] : [];
  if (!requestedRaw.length) throw Object.assign(new Error("COMPANY_REQUIRED"), { status: 400 });
  const openWithout = b.openWithoutContract === true;
  const requested = [], eligible = [], pending = [];
  for (const raw of requestedRaw) {
    const c = await resolveSourceCandidate(raw);
    if (!requested.some(x => String(x.contract_id) === String(c.contract_id))) requested.push(c);
  }
  for (const c of requested) {
    const ready = await bindingEligible(String(c.contract_id));
    if (ready) eligible.push(ready); else pending.push(c);
  }
  if (pending.length && !openWithout) throw Object.assign(new Error("SIGNED_CONTRACT_REQUIRED"), { status: 409 });
  await assertLoginAvailable(login);
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { rona_portal_login: login, rona_portal_display_name: name } });
  if (error || !data?.user?.id) throw Object.assign(new Error("AUTH_USER_CREATE_FAILED"), { status: 502 });
  const authId = String(data.user.id);
  try {
    return await sql.begin(async tx => {
      const userId = crypto.randomUUID();
      await tx`insert into portal_private.portal_users(id,auth_user_id,login_name,display_name,status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,activated_at,last_auth_verified_at,must_change_password,password_change_required_at,password_changed_at)
        values(${userId}::uuid,${authId}::uuid,${login},${name},'ACTIVE'::portal_private.portal_user_status_enum,'ADMIN_PORTAL','ADMIN_EXCLUSIVE_CLIENT_V2',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,now(),null,false,null,now())`;
      await tx`insert into portal_private.portal_user_roles(user_id,role,status,granted_by,reason)
        values(${userId}::uuid,'CLIENT'::portal_private.portal_role_enum,'ACTIVE'::portal_private.binding_status_enum,${ctx.user}::uuid,'Administrator created Client Portal account')`;
      for (const c of eligible) {
        await tx`insert into portal_private.client_user_bindings(user_id,client_key,contract_key,status,granted_by,reason,source_system,source_version,source_timestamp,authority_state,lifecycle_state,deal_scope_mode)
          values(${userId}::uuid,${c.client_key}::uuid,${c.contract_key}::uuid,'ACTIVE'::portal_private.binding_status_enum,${ctx.user}::uuid,${`Admin Portal: ${String(b.bindingRole || "Authorized representative")}`},'ADMIN_PORTAL','ADMIN_EXCLUSIVE_CLIENT_V2',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,'ALL_CONTRACT_DEALS')`;
      }
      const seenClients = new Set();
      for (const c of pending) {
        const clientKey = String(c.client_key);
        if (seenClients.has(clientKey)) continue;
        seenClients.add(clientKey);
        await tx`insert into portal_private.client_user_pending_company_bindings(user_id,client_key,requested_contract_key,status,representation_role,contact_email,contact_phone,granted_by,reason,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
          values(${userId}::uuid,${clientKey}::uuid,${c.contract_key}::uuid,'PENDING'::portal_private.binding_status_enum,${String(b.bindingRole || "Уполномоченный представитель")},${email},${phone},${ctx.user}::uuid,'Admin Portal: opened without confirmed contract','ADMIN_PORTAL','ADMIN_EXCLUSIVE_CLIENT_V2',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
      }
      await audit(tx, ctx, "CLIENT_PORTAL_USER_CREATED_BY_ADMIN", "PORTAL_USER", userId, req, { login, email, requested_contract_ids: requested.map(x=>String(x.contract_id)), linked_contract_ids: eligible.map(x=>String(x.contract_id)), pending_contract_ids: pending.map(x=>String(x.contract_id)), open_without_contract: openWithout, password_admin_set: true });
      return { userId, linkedContractIds: eligible.map(x=>String(x.contract_id)), pendingContractIds: pending.map(x=>String(x.contract_id)) };
    });
  } catch (e) { try { await service.auth.admin.deleteUser(authId); } catch {} throw e; }
}

async function parseSignedPdfForm(req) {
  let form; try { form = await req.formData(); } catch { throw Object.assign(new Error("INVALID_MULTIPART"), { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) throw Object.assign(new Error("PDF_REQUIRED"), { status: 400 });
  if (file.size <= 0 || file.size > PDF_MAX) throw Object.assign(new Error("PDF_SIZE_INVALID"), { status: 400 });
  if (!/\.pdf$/i.test(file.name || "") || (file.type && file.type !== "application/pdf")) throw Object.assign(new Error("PDF_TYPE_INVALID"), { status: 400 });
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-") throw Object.assign(new Error("PDF_SIGNATURE_INVALID"), { status: 400 });
  const clientId = requiredText(form.get("clientId"), "CLIENT_ID", 80);
  const claimsSigned = String(form.get("adminClaimsBilateralSigned") || "").toLowerCase() === "true";
  let attestation = {}; try { attestation = JSON.parse(String(form.get("adminAttestation") || "{}")); } catch { throw Object.assign(new Error("ATTESTATION_INVALID"), { status: 400 }); }
  if (!claimsSigned || attestation?.confirmed !== true || String(attestation?.type || "") !== "BILATERAL_SIGNED_CONTRACT_ATTESTATION") throw Object.assign(new Error("BILATERAL_ATTESTATION_REQUIRED"), { status: 400 });
  return { file, bytes, clientId, attestation, sha256: await sha256Hex(bytes) };
}
async function rawStorageObjectId(objectName) {
  const rows = await sql`select id from storage.objects where bucket_id=${BUCKET} and name=${objectName} limit 1`;
  return rows[0]?.id ? String(rows[0].id) : null;
}
async function uploadRawPdf(contract, parsed) {
  const objectName = `contracts/${contract.client_id}/${contract.contract_id}/${crypto.randomUUID()}-${safeFilename(parsed.file.name)}`;
  const { error } = await service.storage.from(BUCKET).upload(objectName, new Uint8Array(parsed.bytes), { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
  if (error) throw Object.assign(new Error("STORAGE_UPLOAD_FAILED"), { status: 502 });
  const rawId = await rawStorageObjectId(objectName);
  if (!rawId) { try { await service.storage.from(BUCKET).remove([objectName]); } catch {} throw Object.assign(new Error("STORAGE_OBJECT_ID_MISSING"), { status: 502 }); }
  return { objectName, rawId };
}
async function cleanupRaw(objectName) { try { await service.storage.from(BUCKET).remove([objectName]); } catch {} }
async function alreadyConfirmed(contract) {
  if (!contract.current_signed_document_id || !contract.signed_contract_confirmed_at || !contract.signed_contract_confirmed_by) return false;
  const rows = await sql`select 1 from portal_private.documents d join portal_private.document_versions dv on dv.id=d.current_version_id join portal_private.storage_objects so on so.document_version_key=dv.id and so.storage_state='VERIFIED' where d.id=${contract.current_signed_document_id}::uuid and dv.is_current and dv.is_effective limit 1`;
  return rows.length === 1;
}
async function activatePendingBindings(tx, ctx, req, contract) {
  const rows = await tx`
    select p.id,p.user_id,p.representation_role
    from portal_private.client_user_pending_company_bindings p
    join portal_private.portal_users u on u.id=p.user_id
    where p.client_key=${contract.client_key}::uuid and p.status='PENDING'::portal_private.binding_status_enum and p.revoked_at is null
      and (p.requested_contract_key is null or p.requested_contract_key=${contract.contract_key}::uuid)
      and u.status='ACTIVE'::portal_private.portal_user_status_enum and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role='CLIENT'::portal_private.portal_role_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null)
    for update of p
  `;
  let activated = 0;
  for (const p of rows) {
    const live = await tx`select id from portal_private.client_user_bindings where user_id=${p.user_id}::uuid and client_key=${contract.client_key}::uuid and contract_key=${contract.contract_key}::uuid and status in ('PENDING'::portal_private.binding_status_enum,'ACTIVE'::portal_private.binding_status_enum,'SUSPENDED'::portal_private.binding_status_enum) limit 1`;
    if (!live.length) {
      await tx`insert into portal_private.client_user_bindings(user_id,client_key,contract_key,status,granted_by,reason,source_system,source_version,source_timestamp,authority_state,lifecycle_state,deal_scope_mode)
        values(${p.user_id}::uuid,${contract.client_key}::uuid,${contract.contract_key}::uuid,'ACTIVE'::portal_private.binding_status_enum,${ctx.user}::uuid,${`Admin Portal: ${String(p.representation_role || "Уполномоченный представитель")}; activated after signed contract confirmation`},'ADMIN_PORTAL','ADMIN_CONTRACT_ACTIVATION_V2',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,'ALL_CONTRACT_DEALS')`;
      activated++;
    }
    await tx`update portal_private.client_user_pending_company_bindings set status='ACTIVE'::portal_private.binding_status_enum,reason='Activated after Administrator confirmed signed contract',updated_at=now() where id=${p.id}::uuid`;
  }
  if (activated) await audit(tx, ctx, "PENDING_CLIENT_ACCESS_ACTIVATED_AFTER_CONTRACT", "CONTRACT", String(contract.contract_id), req, { activated_bindings: activated });
  return activated;
}
async function attachAndActivateContract(ctx, req, selectionId) {
  const parsed = await parseSignedPdfForm(req);
  const contract = await resolveSourceCandidate(selectionId, parsed.clientId);
  if (await alreadyConfirmed(contract)) throw Object.assign(new Error("SIGNED_PDF_ALREADY_CONFIRMED"), { status: 409 });
  const raw = await uploadRawPdf(contract, parsed);
  try {
    const result = await sql.begin(async tx => {
      const locked = await tx`select ct.id contract_key,ct.contract_id,ct.client_key,cl.client_id,cl.legal_name from portal_private.contracts ct join portal_private.clients cl on cl.id=ct.client_key where ct.id=${contract.contract_key}::uuid for update of ct,cl`;
      if (locked.length !== 1) throw Object.assign(new Error("EXECUTIVE_SOURCE_CONTRACT_REQUIRED"), { status: 409 });
      const c = locked[0];
      let docs = await tx`select id,document_id,current_version_id from portal_private.documents where client_key=${c.client_key}::uuid and contract_key=${c.contract_key}::uuid and (document_id=${c.contract_id} or upper(document_type) in ('КОНТРАКТ','SIGNED_BILATERAL_CONTRACT')) order by (document_id=${c.contract_id}) desc,updated_at desc limit 1 for update`;
      let documentKey, documentId;
      if (!docs.length) {
        documentKey = crypto.randomUUID(); documentId = String(c.contract_id);
        await tx`insert into portal_private.documents(id,document_id,document_type,client_key,contract_key,authoritative_filename,current_version_id,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
          values(${documentKey}::uuid,${documentId},'КОНТРАКТ',${c.client_key}::uuid,${c.contract_key}::uuid,${parsed.file.name},null,'ADMIN_PORTAL','ADMIN_CONTRACT_ACTIVATION_V2',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
      } else { documentKey = String(docs[0].id); documentId = String(docs[0].document_id); }
      const maxRows = await tx`select coalesce(max(version_number),0) max_version from portal_private.document_versions where document_key=${documentKey}::uuid`;
      const nextVersion = Number(maxRows[0]?.max_version || 0) + 1, newVersionId = crypto.randomUUID();
      await tx`update portal_private.document_versions set is_current=false,is_effective=false where document_key=${documentKey}::uuid and is_current`;
      await tx`insert into portal_private.document_versions(id,document_key,version_number,authoritative_filename,sha256,storage_path,uploaded_by,is_current,is_effective,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
        values(${newVersionId}::uuid,${documentKey}::uuid,${nextVersion},${parsed.file.name},${parsed.sha256},${raw.objectName},${ctx.user}::uuid,true,true,'ADMIN_PORTAL',${`ADMIN_SIGNED_CONTRACT_V${nextVersion}`},now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
      await tx`update portal_private.document_versions set superseded_by=${newVersionId}::uuid,authority_state='SUPERSEDED'::portal_private.authority_state_enum,lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum where document_key=${documentKey}::uuid and id<>${newVersionId}::uuid and is_current=false and superseded_by is null`;
      await tx`update portal_private.storage_objects set storage_state='SUPERSEDED',updated_at=now() where document_version_key in (select id from portal_private.document_versions where document_key=${documentKey}::uuid and id<>${newVersionId}::uuid) and storage_state in ('RESERVED','UPLOADED','VERIFIED')`;
      await tx`update portal_private.documents set authoritative_filename=${parsed.file.name},current_version_id=${newVersionId}::uuid,authority_state='CONFIRMED'::portal_private.authority_state_enum,lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,updated_at=now() where id=${documentKey}::uuid`;
      await tx`insert into portal_private.storage_objects(bucket_id,object_name,storage_object_id,object_kind,client_key,contract_key,document_version_key,content_type,byte_size,sha256,storage_state,created_by,verified_by,verified_at)
        values(${BUCKET},${raw.objectName},${raw.rawId}::uuid,'DOCUMENT',${c.client_key}::uuid,${c.contract_key}::uuid,${newVersionId}::uuid,'application/pdf',${parsed.file.size},${parsed.sha256},'VERIFIED',${ctx.user}::uuid,${ctx.user}::uuid,now())`;
      await tx`update portal_private.clients set authority_state='CONFIRMED'::portal_private.authority_state_enum,lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,updated_at=now() where id=${c.client_key}::uuid`;
      await tx`update portal_private.contracts set contract_status='ACTIVE',authority_state='CONFIRMED'::portal_private.authority_state_enum,lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,current_signed_document_id=${documentKey}::uuid,signed_contract_confirmed_at=now(),signed_contract_confirmed_by=${ctx.user}::uuid,updated_at=now() where id=${c.contract_key}::uuid`;
      await audit(tx, ctx, "ADMIN_CONTRACT_AUTHORITY_ACTIVATED", "CONTRACT", String(c.contract_id), req, { client_id: String(c.client_id), source_first: true, document_id: documentId, sha256: parsed.sha256 });
      await audit(tx, ctx, "BILATERAL_CONTRACT_ATTACH_CONFIRMED", "CONTRACT", String(c.contract_id), req, { document_id: documentId, sha256: parsed.sha256, storage_verified: true, source_first_activation: true });
      await audit(tx, ctx, "SIGNED_CONTRACT_STORAGE_REGISTERED", "DOCUMENT", documentId, req, { contract_id: String(c.contract_id), client_id: String(c.client_id), sha256: parsed.sha256, object_name: raw.objectName, attestation_type: parsed.attestation.type });
      const activatedBindings = await activatePendingBindings(tx, ctx, req, { ...c, contract_key: String(c.contract_key), client_key: String(c.client_key), contract_id: String(c.contract_id) });
      return { clientId: String(c.client_id), contractId: String(c.contract_id), documentId, version: String(nextVersion), sha256: parsed.sha256, serverConfirmed: true, bilateralSignedConfirmed: true, clientDownloadAllowed: true, activatedPendingBindings: activatedBindings };
    });
    return result;
  } catch (e) { await cleanupRaw(raw.objectName); throw e; }
}

Deno.serve(async req => {
  if (!["POST"].includes(req.method)) return send(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const ctx = await adminContext(req); if (!ctx) return send(403, { ok: false, code: "ADMIN_SESSION_REQUIRED" });
  const path = pathOf(req);
  try {
    if (path === "/access/users") return send(201, { ok: true, ...(await createClientUser(ctx, req)) });
    const attach = path.match(/^\/contracts\/([^/]+)\/signed-document\/attach$/);
    if (attach) return send(200, { ok: true, document: await attachAndActivateContract(ctx, req, decodeURIComponent(attach[1])) });
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  } catch (e) {
    console.error("rona-admin-client-authority error", e);
    const status = Number(e?.status || 500);
    return send(status >= 400 && status < 600 ? status : 500, { ok: false, code: String(e?.message || "SERVER_ERROR") });
  }
});
