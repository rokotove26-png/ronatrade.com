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
const CONTRACT = "RONA_PRICE_PUBLICATION_WRITE_FALLBACK_V1";
const RPC_NAME = "owner_set_price_publication_audience";

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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const ctx = await authenticate(req);
  if (!ctx) return response(401, { ok: false, code: "PORTAL_ACCESS_DENIED" });
  if (!ctx.roles.includes("ADMIN")) return response(403, { ok: false, code: "ROLE_MISMATCH" });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return response(400, { ok: false, code: "INVALID_JSON" });
  }

  if (String(payload?.name || "") !== RPC_NAME) {
    return response(403, { ok: false, code: "WRITE_RPC_NOT_ALLOWED" });
  }

  const args = payload?.args;
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return response(400, { ok: false, code: "INVALID_AUDIENCE_STATE" });
  }
  const keys = Object.keys(args).sort();
  if (keys.length !== 2 || keys[0] !== "p_agent" || keys[1] !== "p_client") {
    return response(400, { ok: false, code: "INVALID_AUDIENCE_STATE" });
  }
  if (typeof args.p_client !== "boolean" || typeof args.p_agent !== "boolean") {
    return response(400, { ok: false, code: "INVALID_AUDIENCE_STATE" });
  }

  try {
    const result = await sql.begin(async (tx: any) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify(ctx.claims)}, true)`;
      return (await tx`
        select public.owner_set_price_publication_audience(
          ${args.p_client}::boolean,
          ${args.p_agent}::boolean
        ) as data
      `)[0]?.data ?? null;
    });
    return response(200, result);
  } catch (error) {
    const code = String((error as any)?.message || "PRICE_PUBLICATION_WRITE_FALLBACK_FAILED");
    console.error("PRICE_PUBLICATION_WRITE_FALLBACK_FAIL", code);
    const status = code === "CURRENT_PRICE_PUBLICATION_NOT_FOUND" ? 409 : 500;
    return response(status, { ok: false, code });
  }
});
