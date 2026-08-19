// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");
const sql = postgres(DB, { prepare: false, max: 1 });
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

const service = createClient(SUPA_URL, runtimeKey("secret"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function send(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function pathOf(req) {
  const p = new URL(req.url).pathname;
  const marker = "/rona-admin-agent-access";
  const i = p.indexOf(marker);
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
  const rh = req.headers.get("x-request-id");
  const ch = req.headers.get("x-correlation-id");
  return {
    requestId: rh && UUID_RE.test(rh) ? rh : crypto.randomUUID(),
    correlationId: ch && UUID_RE.test(ch) ? ch : null,
  };
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
function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}
async function audit(tx, ctx, action, entityType, entityId, req, metadata = {}) {
  const { requestId, correlationId } = requestIds(req);
  await tx`
    insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
    values(${ctx.user}::uuid,'ADMIN',${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,${sql.json(metadata)})
  `;
  return requestId;
}

async function availableProfiles() {
  const rows = await sql`
    select distinct
      ap.id as agent_person_key,
      ap.agent_person_id,
      ap.display_alias,
      ap.full_name,
      ale.id as agent_legal_entity_key,
      ale.agent_legal_entity_id,
      ale.legal_name
    from portal_private.agent_persons ap
    join portal_private.agent_client_assignments aca on aca.agent_person_key=ap.id
    join portal_private.agent_legal_entities ale on ale.id=aca.agent_legal_entity_key
    where ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ap.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and ale.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ale.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and aca.status='ACTIVE'::portal_private.binding_status_enum
      and aca.valid_from<=now() and (aca.valid_to is null or aca.valid_to>now())
      and aca.authority_state='CONFIRMED'::portal_private.authority_state_enum
      and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by ap.agent_person_id,ale.agent_legal_entity_id
  `;
  const byPerson = new Map();
  for (const r of rows) {
    const id = String(r.agent_person_id);
    if (!byPerson.has(id)) byPerson.set(id, {
      agentPersonKey: String(r.agent_person_key),
      agentPersonId: id,
      displayAlias: String(r.display_alias || r.full_name || id),
      fullName: r.full_name ? String(r.full_name) : null,
      legalEntities: new Map(),
    });
    byPerson.get(id).legalEntities.set(String(r.agent_legal_entity_id), {
      agentLegalEntityKey: String(r.agent_legal_entity_key),
      agentLegalEntityId: String(r.agent_legal_entity_id),
      legalName: String(r.legal_name),
    });
  }
  return [...byPerson.values()].map((p) => ({ ...p, legalEntities: [...p.legalEntities.values()] }));
}

async function readiness() {
  const profiles = await availableProfiles();
  return {
    matrixReady: profiles.length > 0,
    mode: "EXISTING_AGENT_PERSON_FIXED_SCOPE",
    profiles: profiles.map((p) => ({
      agentPersonId: p.agentPersonId,
      displayAlias: p.displayAlias,
      legalEntityIds: p.legalEntities.map((x) => x.agentLegalEntityId),
    })),
  };
}

async function resolveAgentProfile(name, explicitScope) {
  const profiles = await availableProfiles();
  const scope = String(explicitScope || "").trim();
  const normalized = normalizeName(name);
  const matches = profiles.filter((p) => {
    if (scope) return p.agentPersonId === scope;
    return [p.displayAlias, p.fullName].filter(Boolean).some((x) => normalizeName(x) === normalized);
  });
  if (!matches.length) throw Object.assign(new Error("AGENT_PROFILE_NOT_FOUND"), { status: 409 });
  if (matches.length !== 1) throw Object.assign(new Error("AGENT_PROFILE_AMBIGUOUS"), { status: 409 });
  const profile = matches[0];
  if (profile.legalEntities.length !== 1) throw Object.assign(new Error("AGENT_LEGAL_ENTITY_AMBIGUOUS"), { status: 409 });
  return { ...profile, legalEntity: profile.legalEntities[0] };
}

async function createAgentAccessUser(ctx, req) {
  const b = await jsonBody(req);
  const name = requiredText(b.name, "NAME", 200);
  const login = requiredText(b.login, "LOGIN", 160);
  const email = requiredText(b.email, "EMAIL", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("INVALID_EMAIL"), { status: 400 });
  const role = String(b.role || "").trim();
  if (!new Set(["Агент", "AGENT"]).has(role)) throw Object.assign(new Error("AGENT_ROLE_REQUIRED"), { status: 400 });
  const profile = await resolveAgentProfile(name, b.agentScope);

  if ((await sql`select 1 from portal_private.portal_users where lower(login_name)=lower(${login}) limit 1`).length) {
    throw Object.assign(new Error("LOGIN_ALREADY_EXISTS"), { status: 409 });
  }
  const existingAgentAccount = await sql`
    select ub.user_id
    from portal_private.agent_user_bindings ub
    join portal_private.portal_users u on u.id=ub.user_id
    where ub.agent_person_key=${profile.agentPersonKey}::uuid
      and ub.agent_legal_entity_key=${profile.legalEntity.agentLegalEntityKey}::uuid
      and ub.status='ACTIVE'::portal_private.binding_status_enum and ub.revoked_at is null
      and u.status='ACTIVE'::portal_private.portal_user_status_enum
      and exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role='AGENT'::portal_private.portal_role_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null)
      and not exists(select 1 from portal_private.portal_user_roles ar where ar.user_id=u.id and ar.role='ADMIN'::portal_private.portal_role_enum and ar.status='ACTIVE'::portal_private.binding_status_enum and ar.revoked_at is null)
    limit 1
  `;
  if (existingAgentAccount.length) throw Object.assign(new Error("AGENT_PORTAL_USER_ALREADY_EXISTS"), { status: 409 });

  const entropy = new Uint8Array(24);
  crypto.getRandomValues(entropy);
  const initialPassword = "Aa1!" + Array.from(entropy).map((x) => x.toString(16).padStart(2, "0")).join("");
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: {
      rona_portal_login: login,
      rona_portal_display_name: name,
      rona_agent_person_id: profile.agentPersonId,
    },
  });
  if (error || !data?.user?.id) throw Object.assign(new Error("AUTH_USER_CREATE_FAILED"), { status: 502, detail: String(error?.message || error || "") });
  const authId = String(data.user.id);
  try {
    const result = await sql.begin(async (tx) => {
      const userId = crypto.randomUUID();
      await tx`
        insert into portal_private.portal_users(id,auth_user_id,login_name,display_name,status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,activated_at,last_auth_verified_at,must_change_password,password_change_required_at)
        values(${userId}::uuid,${authId}::uuid,${login},${name},'ACTIVE'::portal_private.portal_user_status_enum,'ADMIN_PORTAL','AGENT_ACCESS_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,now(),null,true,now())
      `;
      await tx`
        insert into portal_private.portal_user_roles(user_id,role,status,granted_by,reason)
        values(${userId}::uuid,'AGENT'::portal_private.portal_role_enum,'ACTIVE'::portal_private.binding_status_enum,${ctx.user}::uuid,'Human Administrator created Agent Portal access')
      `;
      await tx`
        insert into portal_private.agent_user_bindings(user_id,agent_person_key,agent_legal_entity_key,status,valid_from,granted_by,granted_at,reason,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
        values(${userId}::uuid,${profile.agentPersonKey}::uuid,${profile.legalEntity.agentLegalEntityKey}::uuid,'ACTIVE'::portal_private.binding_status_enum,now(),${ctx.user}::uuid,now(),'Admin Portal: fixed Agent Person access granted','ADMIN_PORTAL','AGENT_ACCESS_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)
      `;
      await audit(tx, ctx, "AGENT_PORTAL_USER_CREATED", "PORTAL_USER", userId, req, {
        login,
        email,
        agent_person_id: profile.agentPersonId,
        agent_legal_entity_id: profile.legalEntity.agentLegalEntityId,
      });
      return { userId };
    });
    return {
      ...result,
      initialPassword,
      agentPersonId: profile.agentPersonId,
      agentLegalEntityId: profile.legalEntity.agentLegalEntityId,
    };
  } catch (e) {
    try { await service.auth.admin.deleteUser(authId); } catch (_) {}
    throw e;
  }
}

Deno.serve(async (req) => {
  if (!["GET", "POST"].includes(req.method)) return send(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const ctx = await adminContext(req);
  if (!ctx) return send(403, { ok: false, code: "ADMIN_SESSION_REQUIRED" });
  const path = pathOf(req);
  try {
    if ((path === "/readiness" || path === "/agent-readiness") && req.method === "GET") return send(200, { ok: true, data: await readiness() });
    if (path === "/access/users" && req.method === "POST") return send(201, { ok: true, ...(await createAgentAccessUser(ctx, req)) });
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  } catch (e) {
    console.error("rona-admin-agent-access error", e);
    const status = Number(e?.status || 500);
    return send(status >= 400 && status < 600 ? status : 500, { ok: false, code: String(e?.message || "SERVER_ERROR") });
  }
});
