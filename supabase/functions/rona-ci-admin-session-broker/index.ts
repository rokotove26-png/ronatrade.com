// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPA_URL = Deno.env.get("SUPABASE_URL");
const DB = Deno.env.get("SUPABASE_DB_URL");
if (!SUPA_URL || !DB) throw new Error("runtime vars missing");
const sql = postgres(DB, { prepare: false, max: 1 });

function runtimeKey(kind: "pub" | "secret") {
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
const publicClient = () => createClient(SUPA_URL, runtimeKey("pub"), { auth: { persistSession: false, autoRefreshToken: false } });
const SOURCE = "QA_CI_ADMIN_BROKER";
const REPO = "rokotove26-png/ronatrade.com";
const REF = "refs/heads/release/public-go-live-v1.1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{40}$/i;

function send(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache", "referrer-policy": "no-referrer" } });
}
function pathOf(req: Request) {
  const p = new URL(req.url).pathname;
  const marker = "/rona-ci-admin-session-broker";
  const i = p.indexOf(marker);
  return i >= 0 ? (p.slice(i + marker.length) || "/") : p;
}
function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function expectedSecret() {
  return Deno.env.get("RONA_ADMIN_SESSION_SECRET") || Deno.env.get("RONA_RUNTIME_ADMIN_SECRET") || "";
}
function requestContext(req: Request) {
  return {
    repo: String(req.headers.get("x-github-repository") || ""),
    sha: String(req.headers.get("x-github-sha") || ""),
    ref: String(req.headers.get("x-github-ref") || ""),
    runId: String(req.headers.get("x-github-run-id") || ""),
  };
}
function contextAllowed(ctx: any) {
  return ctx.repo === REPO && ctx.ref === REF && SHA_RE.test(ctx.sha) && /^\d{5,20}$/.test(ctx.runId);
}
async function audit(portalId: string, action: string, runId: string, sha: string, metadata: Record<string, unknown> = {}) {
  try {
    await sql`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata)
      values(${portalId}::uuid,'ADMIN',${action},'PORTAL_USER',${portalId},${crypto.randomUUID()}::uuid,${sql.json({ ci_run_id: runId, git_sha: sha, broker_mode: "EPHEMERAL_CI_ADMIN", ...metadata })})`;
  } catch (e) { console.error("broker audit", e); }
}
async function retireRows(rows: any[], reason: string) {
  for (const row of rows) {
    const portalId = String(row.id);
    const authId = row.auth_user_id ? String(row.auth_user_id) : "";
    try {
      await sql.begin(async (tx) => {
        await tx`update portal_private.portal_user_roles set status='REVOKED'::portal_private.binding_status_enum,revoked_at=coalesce(revoked_at,now()),reason=${reason},updated_at=now() where user_id=${portalId}::uuid and role='ADMIN'::portal_private.portal_role_enum and status='ACTIVE'::portal_private.binding_status_enum`;
        await tx`update portal_private.portal_users set status='SUSPENDED'::portal_private.portal_user_status_enum,lifecycle_state='SUSPENDED'::portal_private.lifecycle_state_enum,suspended_at=coalesce(suspended_at,now()),auth_user_id=null,updated_at=now(),source_version=coalesce(source_version,'')||'|RETIRED' where id=${portalId}::uuid`;
      });
    } catch (e) { console.error("broker retire db", portalId, e); }
    if (authId && UUID_RE.test(authId)) {
      try { await service.auth.admin.deleteUser(authId, false); } catch (e) { console.error("broker retire auth", authId, e); }
    }
  }
}
async function cleanupStale() {
  const rows = await sql`select id,auth_user_id from portal_private.portal_users where source_system=${SOURCE} and status='ACTIVE'::portal_private.portal_user_status_enum and created_at < now() - interval '2 hours' limit 50`;
  if (rows.length) await retireRows(rows, "CI broker stale-session containment cleanup");
}
async function cleanupRun(runId: string, sha: string) {
  const rows = await sql`select id,auth_user_id from portal_private.portal_users where source_system=${SOURCE} and source_version=${`CI_RUN_${runId}`} and status='ACTIVE'::portal_private.portal_user_status_enum`;
  for (const row of rows) await audit(String(row.id), "CI_ADMIN_SESSION_BROKER_CLEANUP", runId, sha, {});
  await retireRows(rows, "CI broker explicit run cleanup");
  return rows.length;
}
async function issueSession(ctx: any) {
  await cleanupStale();
  const sameRun = await sql`select id,auth_user_id from portal_private.portal_users where source_system=${SOURCE} and source_version=${`CI_RUN_${ctx.runId}`} and status='ACTIVE'::portal_private.portal_user_status_enum`;
  if (sameRun.length) await retireRows(sameRun, "CI broker session rotation");

  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const login = `qa_ci_admin_${ctx.runId}_${nonce}`;
  const email = `qa-ci-admin-${ctx.runId}-${nonce}@example.invalid`;
  const entropy = new Uint8Array(32); crypto.getRandomValues(entropy);
  const password = "Aa1!" + Array.from(entropy).map((x) => x.toString(16).padStart(2, "0")).join("");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { rona_portal_login: login, rona_portal_display_name: "RONA CI Ephemeral Administrator", rona_ci_run_id: ctx.runId } });
  if (created.error || !created.data?.user?.id) throw Object.assign(new Error("CI_AUTH_USER_CREATE_FAILED"), { detail: String(created.error?.message || created.error || "") });
  const authId = String(created.data.user.id);
  const portalId = crypto.randomUUID();
  try {
    await sql.begin(async (tx) => {
      await tx`insert into portal_private.portal_users(id,auth_user_id,login_name,display_name,status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,auth_linked_at,activated_at,last_auth_verified_at,must_change_password,password_changed_at)
        values(${portalId}::uuid,${authId}::uuid,${login},'RONA CI Ephemeral Administrator','ACTIVE'::portal_private.portal_user_status_enum,${SOURCE},${`CI_RUN_${ctx.runId}`},now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum,now(),now(),now(),false,now())`;
      await tx`insert into portal_private.portal_user_roles(user_id,role,status,granted_by,reason) values(${portalId}::uuid,'ADMIN'::portal_private.portal_role_enum,'ACTIVE'::portal_private.binding_status_enum,null,'Ephemeral CI production verification administrator')`;
    });
    const signed = await publicClient().auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data?.session?.access_token || !signed.data?.session?.refresh_token) throw Object.assign(new Error("CI_SESSION_CREATE_FAILED"), { detail: String(signed.error?.message || signed.error || "") });
    await audit(portalId, "CI_ADMIN_SESSION_BROKER_ISSUED", ctx.runId, ctx.sha, { repository: ctx.repo, ref: ctx.ref });
    return { portalId, session: signed.data.session };
  } catch (e) {
    try { await retireRows([{ id: portalId, auth_user_id: authId }], "CI broker failed issuance cleanup"); } catch (_) {}
    throw e;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return send(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const expected = expectedSecret();
  if (!expected) return send(503, { ok: false, code: "CI_BROKER_SECRET_MISSING" });
  if (!safeEqual(bearer(req), expected)) return send(401, { ok: false, code: "CI_BROKER_UNAUTHORIZED" });
  const ctx = requestContext(req);
  if (!contextAllowed(ctx)) return send(403, { ok: false, code: "CI_CONTEXT_DENIED" });
  try {
    const path = pathOf(req);
    if (path === "/cleanup") {
      const retired = await cleanupRun(ctx.runId, ctx.sha);
      return send(200, { ok: true, mode: "EPHEMERAL_CI_ADMIN", retired });
    }
    if (path !== "/") return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
    const issued = await issueSession(ctx);
    return send(200, { ok: true, mode: "EPHEMERAL_CI_ADMIN", broker_admin_id: issued.portalId, session: issued.session });
  } catch (e) {
    console.error("rona-ci-admin-session-broker", e);
    return send(500, { ok: false, code: String(e?.message || "CI_BROKER_ERROR") });
  }
});
