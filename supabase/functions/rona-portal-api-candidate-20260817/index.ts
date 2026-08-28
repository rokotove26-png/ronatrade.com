import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import postgres from "npm:postgres@3.4.7";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");

const sql = postgres(DB, { prepare: false, max: 1 });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function runtimeKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.default) return parsed.default;
  }
  throw new Error("key missing");
}

function claims(token: string) {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4)));
  } catch {
    return {};
  }
}

function send(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function authenticate(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const client = createClient(SUPA_URL!, runtimeKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const sid = claims(token).session_id;
  if (typeof sid !== "string" || !UUID_RE.test(sid)) return null;
  const rows = await sql`
    select a.portal_user_id, a.roles, s.not_after
    from portal_private.resolve_portal_auth(${data.user.id}::uuid, ${sid}) a
    join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid
    where a.session_allowed and (s.not_after is null or s.not_after>now())
  `;
  if (rows.length !== 1) return null;
  return {
    user: String(rows[0].portal_user_id),
    roles: (rows[0].roles || []).map(String),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return send(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  const c = await authenticate(req);
  if (!c) return send(401, { ok: false, code: "PORTAL_ACCESS_DENIED" });
  if (!c.roles.includes("CLIENT")) return send(403, { ok: false, code: "ROLE_MISMATCH" });

  try {
    const rows = await sql`
      select distinct
        cl.client_id,
        cl.legal_name,
        cl.registration_country,
        cl.registered_address,
        bp.contact_phone,
        ct.contract_id,
        ct.current_external_contract_number,
        ct.contract_status,
        ct.effective_from,
        ct.effective_to,
        ct.signed_contract_confirmed_at,
        ct.updated_at
      from portal_private.client_user_bindings b
      join portal_private.clients cl on cl.id=b.client_key
      join portal_private.contracts ct on ct.id=b.contract_key
      left join portal_private.client_user_binding_profiles bp on bp.binding_id=b.id
      where b.user_id=${c.user}::uuid
        and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now())
      order by cl.legal_name,ct.contract_id
    `;

    const contexts = rows.map((r: any) => ({
      client_id: r.client_id ? String(r.client_id) : null,
      legal_name: r.legal_name ? String(r.legal_name) : null,
      registration_country: r.registration_country ? String(r.registration_country) : null,
      registered_address: r.registered_address ? String(r.registered_address) : null,
      contact_phone: r.contact_phone ? String(r.contact_phone) : null,
      contract_id: String(r.contract_id),
      current_external_contract_number: r.current_external_contract_number ? String(r.current_external_contract_number) : null,
      contract_status: String(r.contract_status),
      effective_from: r.effective_from,
      effective_to: r.effective_to,
      reference_status: r.current_external_contract_number ? "CONFIRMED" : "REQUIRES_VERIFICATION",
    }));

    return send(200, {
      ok: true,
      data: {
        generated_at: new Date().toISOString(),
        data_contract: "1.3",
        requires_context_selection: contexts.length > 1,
        contexts,
        selected_context: null,
        applications: [],
        deals: [],
        documents: [],
        payments: [],
        shipments: [],
        rail_documents: [],
        market: [],
        notifications: [],
      },
    });
  } catch (error) {
    console.error("client bootstrap error", error);
    return send(500, { ok: false, code: "SERVER_ERROR" });
  }
});
