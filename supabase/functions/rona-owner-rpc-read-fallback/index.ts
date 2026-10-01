import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("RUNTIME_VARS_MISSING");

function runtimePublicKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.default) return parsed.default;
  }
  throw new Error("SUPABASE_PUBLIC_KEY_MISSING");
}

const sql = postgres(DB, {
  prepare: false,
  max: 1,
  idle_timeout: 1,
  connect_timeout: 3,
  max_lifetime: 15,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTRACT = "RONA_POSTGREST_READ_FALLBACK_V1";

const ADMIN_READS = new Set([
  "owner_analytics_admin_bootstrap",
  "owner_r1_admin_bootstrap",
  "rona_admin_cash_source_projection_v1",
  "owner_price_updates_bootstrap",
  "owner_prices_admin_workspace",
  "owner_deals_current_v4",
  "owner_deals_current_v3",
  "owner_access_workspace_bootstrap",
  "rona_admin_operations_current_v2",
  "rona_admin_operations_current_v1",
  "rona_admin_operations_attention_seen_v1",
  "rona_admin_rail_deal_map_read_model_v4",
]);

const CLIENT_READS = new Set([
  "owner_r1_client_bootstrap",
  "owner_analytics_client_feed",
]);

const ALLOWED_READS = new Set([...ADMIN_READS, ...CLIENT_READS]);

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-rona-postgrest-fallback": CONTRACT,
    },
  });
}

function decodeClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") || "";
    const padded = part + "=".repeat((4 - part.length % 4) % 4);
    const value = JSON.parse(atob(padded));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function dateOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("INVALID_DATE_ARGUMENT");
  return s;
}

function cleanTextOrNull(value: unknown, max = 160): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  if (!s || s.length > max) throw new Error("INVALID_TEXT_ARGUMENT");
  return s;
}

function boundedLimit(value: unknown): number {
  const n = Number(value ?? 300);
  if (!Number.isInteger(n) || n < 1 || n > 300) throw new Error("INVALID_LIMIT_ARGUMENT");
  return n;
}

async function authenticate(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const claims = decodeClaims(token);
  const sid = String(claims.session_id || "");
  if (!UUID_RE.test(sid)) return null;

  const client = createClient(SUPA_URL!, runtimePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || String(claims.sub || "") !== String(data.user.id)) return null;

  const rows = await sql`
    select a.portal_user_id, a.roles, s.not_after
      from portal_private.resolve_portal_auth(${data.user.id}::uuid, ${sid}) a
      join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid
     where a.session_allowed
       and (s.not_after is null or s.not_after > now())
  `;
  if (rows.length !== 1) return null;
  return {
    authUserId: String(data.user.id),
    sessionId: sid,
    roles: (rows[0].roles || []).map(String),
    claims,
  };
}

async function executeRead(tx: any, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "owner_analytics_admin_bootstrap":
      return (await tx`select public.owner_analytics_admin_bootstrap() as data`)[0]?.data ?? null;
    case "owner_r1_admin_bootstrap":
      return (await tx`select public.owner_r1_admin_bootstrap() as data`)[0]?.data ?? null;
    case "rona_admin_cash_source_projection_v1": {
      const from = dateOrNull(args.p_from);
      const to = dateOrNull(args.p_to);
      return (await tx`select public.rona_admin_cash_source_projection_v1(${from}::date,${to}::date) as data`)[0]?.data ?? null;
    }
    case "owner_price_updates_bootstrap":
      return (await tx`select public.owner_price_updates_bootstrap() as data`)[0]?.data ?? null;
    case "owner_prices_admin_workspace":
      return (await tx`select public.owner_prices_admin_workspace() as data`)[0]?.data ?? null;
    case "owner_deals_current_v4":
      return (await tx`select public.owner_deals_current_v4() as data`)[0]?.data ?? null;
    case "owner_deals_current_v3":
      return (await tx`select public.owner_deals_current_v3() as data`)[0]?.data ?? null;
    case "owner_access_workspace_bootstrap": {
      const limit = boundedLimit(args.p_limit);
      return (await tx`select public.owner_access_workspace_bootstrap(${limit}::integer) as data`)[0]?.data ?? null;
    }
    case "rona_admin_operations_current_v2":
      return (await tx`select public.rona_admin_operations_current_v2() as data`)[0]?.data ?? null;
    case "rona_admin_operations_current_v1":
      return (await tx`select public.rona_admin_operations_current_v1() as data`)[0]?.data ?? null;
    case "rona_admin_operations_attention_seen_v1":
      return (await tx`select public.rona_admin_operations_attention_seen_v1() as data`)[0]?.data ?? null;
    case "owner_r1_client_bootstrap":
      return (await tx`select public.owner_r1_client_bootstrap() as data`)[0]?.data ?? null;
    case "owner_analytics_client_feed":
      return (await tx`select public.owner_analytics_client_feed() as data`)[0]?.data ?? null;
    case "rona_admin_rail_deal_map_read_model_v4": {
      const dealId = cleanTextOrNull(args.p_deal_id);
      return (await tx`select public.rona_admin_rail_deal_map_read_model_v4(${dealId}::text) as data`)[0]?.data ?? null;
    }
    default:
      throw new Error("READ_RPC_NOT_ALLOWED");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const ctx = await authenticate(req);
  if (!ctx) return response(401, { ok: false, code: "PORTAL_ACCESS_DENIED" });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return response(400, { ok: false, code: "INVALID_JSON" });
  }

  const name = String(payload?.name || "");
  const args = payload?.args && typeof payload.args === "object" && !Array.isArray(payload.args) ? payload.args : {};
  if (!ALLOWED_READS.has(name)) return response(403, { ok: false, code: "READ_RPC_NOT_ALLOWED" });

  const requiredRole = CLIENT_READS.has(name) ? "CLIENT" : "ADMIN";
  if (!ctx.roles.includes(requiredRole)) return response(403, { ok: false, code: "ROLE_MISMATCH" });

  try {
    const result = await sql.begin(async (tx: any) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify(ctx.claims)}, true)`;
      return await executeRead(tx, name, args);
    });
    return response(200, result);
  } catch (error) {
    console.error("POSTGREST_READ_FALLBACK_FAIL", name, String((error as any)?.message || error));
    const code = String((error as any)?.message || "READ_FALLBACK_FAILED");
    const status = code === "INVALID_DATE_ARGUMENT" || code === "INVALID_TEXT_ARGUMENT" || code === "INVALID_LIMIT_ARGUMENT" ? 400 : 500;
    return response(status, { ok: false, code });
  }
});
