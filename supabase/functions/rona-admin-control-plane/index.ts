// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");
const sql = postgres(DB, { prepare: false, max: 1, idle_timeout: 1, connect_timeout: 3, max_lifetime: 15 });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_AUTHORITY = `${SUPA_URL}/functions/v1/rona-admin-authority`;
const CONTRACT_ACTIVATION = `${SUPA_URL}/functions/v1/rona-admin-contract-activation`;

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
  const p = new URL(req.url).pathname, marker = "/rona-admin-control-plane", i = p.indexOf(marker);
  return i >= 0 ? (p.slice(i + marker.length) || "/") : p;
}

function claims(token) {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4)));
  } catch { return {}; }
}

async function adminContext(req) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const client = createClient(SUPA_URL, runtimeKey("pub"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
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

async function jsonBody(req) {
  try {
    const v = await req.json();
    if (!v || Array.isArray(v) || typeof v !== "object") throw new Error();
    return v;
  } catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
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

function normalizeName(v) { return String(v || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU").replace(/ё/g, "е"); }

async function audit(tx, ctx, action, entityType, entityId, req, metadata = {}) {
  const { requestId, correlationId } = requestIds(req);
  await tx`
    insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
    values(${ctx.user}::uuid,'ADMIN',${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,${sql.json(metadata)})
  `;
}

async function nonAdminUser(userId) {
  if (!UUID_RE.test(userId)) throw Object.assign(new Error("INVALID_USER_ID"), { status: 400 });
  const rows = await sql`
    select u.id,u.auth_user_id,u.status::text,u.lifecycle_state::text
    from portal_private.portal_users u
    where u.id=${userId}::uuid
      and not exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role='ADMIN'::portal_private.portal_role_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null)
    limit 1
  `;
  if (!rows.length) throw Object.assign(new Error("USER_NOT_FOUND_OR_ADMIN_PROTECTED"), { status: 404 });
  return rows[0];
}

async function bindingEligible(contractId) {
  const rows = await sql`
    select ct.id contract_key,ct.client_key,cl.client_id,cl.legal_name,ct.contract_id
    from portal_private.contracts ct
    join portal_private.clients cl on cl.id=ct.client_key
    join portal_private.documents d on d.id=ct.current_signed_document_id
    join portal_private.document_versions dv on dv.id=d.current_version_id
    join portal_private.storage_objects so on so.document_version_key=dv.id and so.storage_state='VERIFIED'
    where ct.contract_id=${contractId} and ct.contract_status='ACTIVE' and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and d.authority_state='CONFIRMED'::portal_private.authority_state_enum and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and dv.authority_state='CONFIRMED'::portal_private.authority_state_enum and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and dv.is_current and dv.is_effective and ct.signed_contract_confirmed_at is not null and ct.signed_contract_confirmed_by is not null
      and exists(
        select 1 from portal_private.audit_events ae
        where ae.action='BILATERAL_CONTRACT_ATTACH_CONFIRMED' and ae.entity_type='CONTRACT' and ae.entity_id=ct.contract_id
          and ae.actor_user_id=ct.signed_contract_confirmed_by and ae.metadata->>'document_id'=d.document_id
          and lower(coalesce(ae.metadata->>'sha256',''))=lower(dv.sha256)
          and coalesce((ae.metadata->>'storage_verified')::boolean,false)
      )
    limit 1
  `;
  return rows[0] || null;
}

async function contractCandidate(contractId) {
  const rows = await sql`
    select ct.id contract_key,ct.client_key,ct.contract_id,ct.authority_state::text contract_authority,ct.lifecycle_state::text contract_lifecycle,
           cl.client_id,cl.legal_name,cl.authority_state::text client_authority,cl.lifecycle_state::text client_lifecycle
    from portal_private.contracts ct join portal_private.clients cl on cl.id=ct.client_key
    where ct.contract_id=${contractId}
    limit 1
  `;
  if (!rows.length) return null;
  const r = rows[0];
  if (["ARCHIVED","SUPERSEDED"].includes(String(r.contract_lifecycle)) || String(r.contract_authority) === "REJECTED") return null;
  if (["ARCHIVED","SUPERSEDED"].includes(String(r.client_lifecycle)) || String(r.client_authority) === "REJECTED") return null;
  return r;
}

async function accessSnapshot() {
  const users = await sql`
    select u.id,u.login_name,u.display_name,u.status::text,u.last_auth_verified_at,
           coalesce(array_agg(distinct r.role::text) filter(where r.role is not null),'{}') roles
    from portal_private.portal_users u
    left join portal_private.portal_user_roles r on r.user_id=u.id and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null
    where left(coalesce(u.source_system,''),3)<>'QA_' and left(lower(coalesce(u.login_name,'')),3)<>'qa_' and left(lower(coalesce(u.login_name,'')),4)<>'g81_'
      and exists(select 1 from portal_private.portal_user_roles xr where xr.user_id=u.id and xr.role in ('CLIENT'::portal_private.portal_role_enum,'AGENT'::portal_private.portal_role_enum) and xr.status='ACTIVE'::portal_private.binding_status_enum and xr.revoked_at is null)
      and not exists(select 1 from portal_private.portal_user_roles ar where ar.user_id=u.id and ar.role='ADMIN'::portal_private.portal_role_enum and ar.status='ACTIVE'::portal_private.binding_status_enum and ar.revoked_at is null)
    group by u.id,u.login_name,u.display_name,u.status,u.last_auth_verified_at
    order by u.login_name nulls last
  `;
  const byUser = new Map();
  for (const u of users) {
    const roles = (u.roles || []).map(String);
    byUser.set(String(u.id), { id: String(u.id), name: String(u.display_name || ""), login: String(u.login_name || ""), role: roles.includes("AGENT") ? "Агент" : "Клиент", status: String(u.status), online: false, last: u.last_auth_verified_at || null, bindings: [] });
  }
  const cb = await sql`
    select b.id,b.user_id,cl.client_id,cl.legal_name,ct.contract_id,b.status::text,b.deal_scope_mode
    from portal_private.client_user_bindings b
    join portal_private.clients cl on cl.id=b.client_key
    join portal_private.contracts ct on ct.id=b.contract_key
    order by b.created_at
  `;
  for (const b of cb) {
    const u = byUser.get(String(b.user_id));
    if (u) u.bindings.push({ id: String(b.id), company: String(b.legal_name), clientId: String(b.client_id), contractId: String(b.contract_id), status: String(b.status), role: "Уполномоченный представитель", dealScopeMode: String(b.deal_scope_mode || "") });
  }
  const ab = await sql`
    select b.id,b.user_id,b.status::text,ap.agent_person_id,ale.agent_legal_entity_id,ale.legal_name
    from portal_private.agent_user_bindings b
    join portal_private.agent_persons ap on ap.id=b.agent_person_key
    join portal_private.agent_legal_entities ale on ale.id=b.agent_legal_entity_key
    order by b.created_at
  `;
  for (const b of ab) {
    const u = byUser.get(String(b.user_id));
    if (u) u.bindings.push({ id: String(b.id), company: String(b.legal_name), clientId: String(b.agent_legal_entity_id), contractId: String(b.agent_person_id), status: String(b.status), role: "Агент", dealScopeMode: "AGENT_FIXED_SCOPE" });
  }
  return [...byUser.values()];
}

async function availableProfiles() {
  const rows = await sql`
    select distinct ap.id agent_person_key,ap.agent_person_id,ap.display_alias,ap.full_name,
           ale.id agent_legal_entity_key,ale.agent_legal_entity_id,ale.legal_name
    from portal_private.agent_persons ap
    join portal_private.agent_client_assignments aca on aca.agent_person_key=ap.id
    join portal_private.agent_legal_entities ale on ale.id=aca.agent_legal_entity_key
    where ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ap.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and ale.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ale.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and aca.status='ACTIVE'::portal_private.binding_status_enum and aca.valid_from<=now() and (aca.valid_to is null or aca.valid_to>now())
      and aca.authority_state='CONFIRMED'::portal_private.authority_state_enum and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by ap.agent_person_id,ale.agent_legal_entity_id
  `;
  const m = new Map();
  for (const r of rows) {
    const id = String(r.agent_person_id);
    if (!m.has(id)) m.set(id, { agentPersonKey: String(r.agent_person_key), agentPersonId: id, displayAlias: String(r.display_alias || r.full_name || id), fullName: r.full_name ? String(r.full_name) : null, legalEntities: new Map() });
    m.get(id).legalEntities.set(String(r.agent_legal_entity_id), { agentLegalEntityKey: String(r.agent_legal_entity_key), agentLegalEntityId: String(r.agent_legal_entity_id), legalName: String(r.legal_name) });
  }
  return [...m.values()].map((p) => ({ ...p, legalEntities: [...p.legalEntities.values()] }));
}

async function resolveAgentProfile(name, scopeValue) {
  const ps = await availableProfiles(), scope = String(scopeValue || "").trim(), n = normalizeName(name);
  const matches = ps.filter((p) => scope ? p.agentPersonId === scope : [p.displayAlias, p.fullName].filter(Boolean).some((x) => normalizeName(x) === n));
  if (!matches.length) throw Object.assign(new Error("AGENT_PROFILE_NOT_FOUND"), { status: 409 });
  if (matches.length !== 1) throw Object.assign(new Error("AGENT_PROFILE_AMBIGUOUS"), { status: 409 });
  const p = matches[0];
  if (p.legalEntities.length !== 1) throw Object.assign(new Error("AGENT_LEGAL_ENTITY_AMBIGUOUS"), { status: 409 });
  return { ...p, legalEntity: p.legalEntities[0] };
}

async function assertLoginAvailable(login) {
  if ((await sql`select 1 from portal_private.portal_users where lower(login_name)=lower(${login}) limit 1`).length) throw Object.assign(new Error("LOGIN_ALREADY_EXISTS"), { status: 409 });
}

async function createAuthUser(email, password, login, name, extra = {}) {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { rona_portal_login: login, rona_portal_display_name: name, ...extra } });
  if (error || !data?.user?.id) throw Object.assign(new Error("AUTH_USER_CREATE_FAILED"), { status: 502 });
  return String(data.user.id);
}

async function createClientUser(ctx, req, b) {
  const name = requiredText(b.name, "NAME", 200), login = requiredText(b.login, "LOGIN", 160), email = requiredText(b.email, "EMAIL", 320).toLowerCase(), password = validatePassword(b.initialPassword);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("INVALID_EMAIL"), { status: 400 });
  await assertLoginAvailable(login);
  const requested = Array.isArray(b.contractIds) ? [...new Set(b.contractIds.map(String).filter(Boolean))] : [];
  if (!requested.length) throw Object.assign(new Error("COMPANY_REQUIRED"), { status: 400 });
  const openWithout = b.openWithoutContract === true;
  const eligible = [], pending = [];
  for (const id of requested) {
    const ready = await bindingEligible(id);
    if (ready) eligible.push(ready);
    else {
      const candidate = await contractCandidate(id);
      if (!candidate) throw Object.assign(new Error("CONTRACT_CANDIDATE_NOT_FOUND"), { status: 404 });
      pending.push(candidate);
    }
  }
  if (pending.length && !openWithout) throw Object.assign(new Error("SIGNED_CONTRACT_GATE_NOT_SATISFIED"), { status: 409 });

  const authId = await createAuthUser(email, password, login, name);
  try {
    return await sql.begin(async (tx) => {
      const userId = crypto.randomUUID();
      await tx`
        insert into portal_private.portal_users(id,auth_user_id,login_name,display_name,status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,activated_at,last_auth_verified_at,must_change_password,password_change_required_at,password_changed_at)
        values(${userId}::uuid,${authId}::uuid,${login},${name},'ACTIVE'::portal_private.portal_user_status_enum,'ADMIN_PORTAL','ADMIN_EXCLUSIVE_CLIENT_V2',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,now(),null,false,null,now())
      `;
      await tx`insert into portal_private.portal_user_roles(user_id,role,status,granted_by,reason) values(${userId}::uuid,'CLIENT'::portal_private.portal_role_enum,'ACTIVE'::portal_private.binding_status_enum,${ctx.user}::uuid,'Administrator created Client Portal account')`;
      for (const c of eligible) {
        await tx`
          insert into portal_private.client_user_bindings(user_id,client_key,contract_key,status,granted_by,reason,source_system,source_version,source_timestamp,authority_state,lifecycle_state,deal_scope_mode)
          values(${userId}::uuid,${c.client_key}::uuid,${c.contract_key}::uuid,'ACTIVE'::portal_private.binding_status_enum,${ctx.user}::uuid,${`Admin Portal: ${String(b.bindingRole || "Authorized representative")}`},'ADMIN_PORTAL','ADMIN_EXCLUSIVE_CLIENT_V2',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,'ALL_CONTRACT_DEALS')
        `;
      }
      for (const c of pending) {
        await tx`
          insert into portal_private.client_user_bindings(user_id,client_key,contract_key,status,granted_by,reason,source_system,source_version,source_timestamp,authority_state,lifecycle_state,deal_scope_mode)
          values(${userId}::uuid,${c.client_key}::uuid,${c.contract_key}::uuid,'PENDING'::portal_private.binding_status_enum,${ctx.user}::uuid,'Admin Portal: opened without confirmed signed contract; data access fail-closed','ADMIN_PORTAL','ADMIN_EXCLUSIVE_CLIENT_V2',now(),'DRAFT'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,'ALL_CONTRACT_DEALS')
        `;
      }
      await audit(tx, ctx, "CLIENT_PORTAL_USER_CREATED_BY_ADMIN", "PORTAL_USER", userId, req, {
        login, email, requested_contract_ids: requested, linked_contract_ids: eligible.map((x) => String(x.contract_id)), pending_contract_ids: pending.map((x) => String(x.contract_id)), password_admin_set: true, open_without_contract: openWithout,
      });
      return { userId, linkedContractIds: eligible.map((x) => String(x.contract_id)), pendingContractIds: pending.map((x) => String(x.contract_id)) };
    });
  } catch (e) {
    try { await service.auth.admin.deleteUser(authId); } catch (_) {}
    throw e;
  }
}

async function createAgentUser(ctx, req, b) {
  const name = requiredText(b.name, "NAME", 200), login = requiredText(b.login, "LOGIN", 160), email = requiredText(b.email, "EMAIL", 320).toLowerCase(), password = validatePassword(b.initialPassword);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("INVALID_EMAIL"), { status: 400 });
  await assertLoginAvailable(login);
  const profile = await resolveAgentProfile(name, b.agentScope);
  const exists = await sql`
    select 1 from portal_private.agent_user_bindings ub join portal_private.portal_users u on u.id=ub.user_id
    where ub.agent_person_key=${profile.agentPersonKey}::uuid and ub.agent_legal_entity_key=${profile.legalEntity.agentLegalEntityKey}::uuid
      and ub.status='ACTIVE'::portal_private.binding_status_enum and ub.revoked_at is null and u.status='ACTIVE'::portal_private.portal_user_status_enum
      and exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role='AGENT'::portal_private.portal_role_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null)
      and not exists(select 1 from portal_private.portal_user_roles ar where ar.user_id=u.id and ar.role='ADMIN'::portal_private.portal_role_enum and ar.status='ACTIVE'::portal_private.binding_status_enum and ar.revoked_at is null)
    limit 1
  `;
  if (exists.length) throw Object.assign(new Error("AGENT_PORTAL_USER_ALREADY_EXISTS"), { status: 409 });
  const authId = await createAuthUser(email, password, login, name, { rona_agent_person_id: profile.agentPersonId });
  try {
    return await sql.begin(async (tx) => {
      const userId = crypto.randomUUID();
      await tx`
        insert into portal_private.portal_users(id,auth_user_id,login_name,display_name,status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,activated_at,last_auth_verified_at,must_change_password,password_change_required_at,password_changed_at)
        values(${userId}::uuid,${authId}::uuid,${login},${name},'ACTIVE'::portal_private.portal_user_status_enum,'ADMIN_PORTAL','ADMIN_EXCLUSIVE_AGENT_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,now(),null,false,null,now())
      `;
      await tx`insert into portal_private.portal_user_roles(user_id,role,status,granted_by,reason) values(${userId}::uuid,'AGENT'::portal_private.portal_role_enum,'ACTIVE'::portal_private.binding_status_enum,${ctx.user}::uuid,'Administrator created Agent Portal account')`;
      await tx`
        insert into portal_private.agent_user_bindings(user_id,agent_person_key,agent_legal_entity_key,status,valid_from,granted_by,granted_at,reason,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
        values(${userId}::uuid,${profile.agentPersonKey}::uuid,${profile.legalEntity.agentLegalEntityKey}::uuid,'ACTIVE'::portal_private.binding_status_enum,now(),${ctx.user}::uuid,now(),'Admin Portal: fixed Agent Person access granted','ADMIN_PORTAL','ADMIN_EXCLUSIVE_AGENT_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)
      `;
      await audit(tx, ctx, "AGENT_PORTAL_USER_CREATED_BY_ADMIN", "PORTAL_USER", userId, req, { login, email, agent_person_id: profile.agentPersonId, agent_legal_entity_id: profile.legalEntity.agentLegalEntityId, password_admin_set: true });
      return { userId, agentPersonId: profile.agentPersonId, agentLegalEntityId: profile.legalEntity.agentLegalEntityId };
    });
  } catch (e) {
    try { await service.auth.admin.deleteUser(authId); } catch (_) {}
    throw e;
  }
}

async function createAccessUser(ctx, req) {
  const b = await jsonBody(req), role = String(b.role || "Клиент").trim();
  if (role === "Клиент" || role === "CLIENT") return createClientUser(ctx, req, b);
  if (role === "Агент" || role === "AGENT") return createAgentUser(ctx, req, b);
  throw Object.assign(new Error("UNSUPPORTED_PORTAL_ROLE"), { status: 400 });
}

async function setPassword(ctx, req, userId) {
  const user = await nonAdminUser(userId), b = await jsonBody(req), password = validatePassword(b.password);
  const { error } = await service.auth.admin.updateUserById(String(user.auth_user_id), { password });
  if (error) throw Object.assign(new Error("AUTH_PASSWORD_UPDATE_FAILED"), { status: 502 });
  await sql.begin(async (tx) => {
    await tx`update portal_private.portal_users set must_change_password=false,password_change_required_at=null,password_changed_at=now(),updated_at=now() where id=${userId}::uuid`;
    await audit(tx, ctx, "PORTAL_USER_PASSWORD_SET_BY_ADMIN", "PORTAL_USER", userId, req, { password_admin_set: true });
  });
  return { userId, passwordUpdated: true };
}

async function blockUser(ctx, req, userId) {
  await nonAdminUser(userId);
  await sql.begin(async (tx) => {
    await tx`update portal_private.client_user_bindings set status='SUSPENDED'::portal_private.binding_status_enum,reason='Admin Portal: user blocked',updated_at=now() where user_id=${userId}::uuid and status='ACTIVE'::portal_private.binding_status_enum and revoked_at is null`;
    await tx`update portal_private.agent_user_bindings set status='SUSPENDED'::portal_private.binding_status_enum,reason='Admin Portal: user blocked',updated_at=now() where user_id=${userId}::uuid and status='ACTIVE'::portal_private.binding_status_enum and revoked_at is null`;
    await tx`update portal_private.portal_users set status='SUSPENDED'::portal_private.portal_user_status_enum,lifecycle_state='SUSPENDED'::portal_private.lifecycle_state_enum,suspended_at=now(),updated_at=now() where id=${userId}::uuid`;
    await audit(tx, ctx, "PORTAL_USER_BLOCKED_BY_ADMIN", "PORTAL_USER", userId, req, {});
  });
  return { userId, status: "SUSPENDED" };
}

async function unblockUser(ctx, req, userId) {
  await nonAdminUser(userId);
  const pending = [];
  await sql.begin(async (tx) => {
    await tx`update portal_private.portal_users set status='ACTIVE'::portal_private.portal_user_status_enum,lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,suspended_at=null,updated_at=now() where id=${userId}::uuid`;
    const suspended = await tx`select b.id,ct.contract_id from portal_private.client_user_bindings b join portal_private.contracts ct on ct.id=b.contract_key where b.user_id=${userId}::uuid and b.status='SUSPENDED'::portal_private.binding_status_enum and b.revoked_at is null`;
    for (const b of suspended) {
      const eligible = await bindingEligible(String(b.contract_id));
      if (eligible) await tx`update portal_private.client_user_bindings set status='ACTIVE'::portal_private.binding_status_enum,reason='Admin Portal: user unblocked',updated_at=now() where id=${b.id}::uuid`;
      else pending.push(String(b.contract_id));
    }
    await tx`update portal_private.agent_user_bindings set status='ACTIVE'::portal_private.binding_status_enum,reason='Admin Portal: user unblocked',updated_at=now() where user_id=${userId}::uuid and status='SUSPENDED'::portal_private.binding_status_enum and revoked_at is null`;
    await audit(tx, ctx, "PORTAL_USER_UNBLOCKED_BY_ADMIN", "PORTAL_USER", userId, req, { pending_contract_ids: pending });
  });
  return { userId, status: "ACTIVE", pendingContractIds: pending };
}

function forwardedHeaders(req) {
  const headers = new Headers();
  for (const name of ["authorization","content-type","accept","x-request-id","x-correlation-id","x-idempotency-key","x-current-document-id"]) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  return headers;
}

async function forwardTo(req, base, path) {
  const url = new URL(req.url), init = { method: req.method, headers: forwardedHeaders(req) };
  if (!["GET","HEAD"].includes(req.method)) init.body = await req.clone().arrayBuffer();
  return fetch(`${base}${path}${url.search}`, init);
}

async function forwardLegacy(req, path) { return forwardTo(req, LEGACY_AUTHORITY, path); }
async function forwardContractActivation(req, path) {
  const response = await forwardTo(req, CONTRACT_ACTIVATION, path);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return response;
  }

  return send(response.status >= 400 && response.status < 600 ? response.status : 502, {
    ok: false,
    code: "CONTRACT_ACTIVATION_UPSTREAM_ERROR"
  });
}

async function bootstrap(req) {
  const upstream = await forwardLegacy(req, "/bootstrap"), body = await upstream.json().catch(() => ({}));
  if (!upstream.ok || body?.ok === false) throw Object.assign(new Error(String(body?.code || "LEGACY_BOOTSTRAP_FAILED")), { status: upstream.status || 502 });
  const data = body.data || {}, profiles = await availableProfiles();
  data.accessUsers = await accessSnapshot();
  data.adminControlPlane = {
    mode: "ADMIN_EXCLUSIVE",
    passwordOwner: "ADMINISTRATOR",
    accountCreationIndependentFromContract: true,
    openWithoutContractCreatesPendingBinding: true,
    adminUploadActivatesContractAndPendingBindings: true,
    clientContractDownloadArchitecture: "CURRENT_CONFIRMED_PRIVATE_OBJECT_SHORT_LIVED_URL",
    agentProfiles: profiles.map((p) => ({ agentPersonId: p.agentPersonId, displayAlias: p.displayAlias, legalEntityIds: p.legalEntities.map((x) => x.agentLegalEntityId) })),
  };
  return { ok: true, data };
}

Deno.serve(async (req) => {
  if (!["GET","POST"].includes(req.method)) return send(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const ctx = await adminContext(req);
  if (!ctx) return send(403, { ok: false, code: "ADMIN_SESSION_REQUIRED" });
  const path = pathOf(req);
  try {
    if (path === "/bootstrap" && req.method === "GET") return send(200, await bootstrap(req));
    if ((path === "/agent-readiness" || path === "/readiness") && req.method === "GET") {
      const profiles = await availableProfiles();
      return send(200, { ok: true, data: { matrixReady: profiles.length > 0, mode: "EXISTING_AGENT_PERSON_FIXED_SCOPE", profiles: profiles.map((p) => ({ agentPersonId: p.agentPersonId, displayAlias: p.displayAlias, legalEntityIds: p.legalEntities.map((x) => x.agentLegalEntityId) })) } });
    }
    if (path === "/access/users" && req.method === "POST") return send(201, { ok: true, ...(await createAccessUser(ctx, req)) });
    const pw = path.match(/^\/access\/users\/([0-9a-f-]+)\/password$/i);
    if (pw && req.method === "POST") return send(200, { ok: true, ...(await setPassword(ctx, req, pw[1])) });
    const block = path.match(/^\/access\/users\/([0-9a-f-]+)\/block$/i);
    if (block && req.method === "POST") return send(200, { ok: true, ...(await blockUser(ctx, req, block[1])) });
    const unblock = path.match(/^\/access\/users\/([0-9a-f-]+)\/unblock$/i);
    if (unblock && req.method === "POST") return send(200, { ok: true, ...(await unblockUser(ctx, req, unblock[1])) });
    if (/^\/contracts\/[^/]+\/signed-document\/attach$/.test(path) && req.method === "POST") return await forwardContractActivation(req, path);
    if (/^\/contracts\//.test(path) || /^\/documents\//.test(path) || /^\/access\/users\/[0-9a-f-]+\/contracts/.test(path)) return await forwardLegacy(req, path);
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  } catch (e) {
    console.error("rona-admin-control-plane error", e);
    const status = Number(e?.status || 500);
    return send(status >= 400 && status < 600 ? status : 500, { ok: false, code: String(e?.message || "SERVER_ERROR") });
  }
});
