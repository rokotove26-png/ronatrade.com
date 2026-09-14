import postgres from "npm:postgres@3.4.7";

const DB = Deno.env.get("SUPABASE_DB_URL");
const MATERIALIZER_TOKEN = Deno.env.get("RONA_FINANCE_MATERIALIZER_TOKEN");
if (!DB || !MATERIALIZER_TOKEN) throw new Error("FINANCE_MATERIALIZER_RUNTIME_VARS_MISSING");

const sql = postgres(DB, { prepare: false, max: 2 });
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function tokenMatches(candidate: string) {
  if (!candidate) return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(MATERIALIZER_TOKEN!)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "x-rona-finance-materializer-contract": "PAYMENTS_V7_SERVER_MATERIALIZER_V1",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  if (!await tokenMatches(bearer(req))) return json(401, { ok: false, code: "MATERIALIZER_AUTH_REQUIRED" });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const fact = payload?.fact;
  if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
    return json(400, { ok: false, code: "STRUCTURED_FINANCE_FACT_REQUIRED" });
  }

  const requestCorrelation = req.headers.get("x-correlation-id") || "";
  const correlationId = UUID_RE.test(requestCorrelation) ? requestCorrelation : crypto.randomUUID();

  // The caller cannot choose the business actor. The server materializer is a separate
  // execution contour over facts source-locked by FINANCE / AI-FINANCE.
  const actor = {
    role: "FINANCE",
    identity_id: "AI-FINANCE",
    correlation_id: correlationId,
    execution_contour: "SERVER_MATERIALIZER",
  };

  try {
    const rows = await sql`
      select portal_private.materialize_finance_fact_v7(
        ${sql.json(actor)}::jsonb,
        ${sql.json(fact)}::jsonb
      ) as result
    `;
    const result = rows[0]?.result || {
      accepted: false,
      materialized: false,
      reason_code: "MATERIALIZER_RESULT_MISSING",
    };
    return json(result.accepted === true ? 200 : 409, {
      ok: result.accepted === true,
      data: result,
      correlation_id: correlationId,
    });
  } catch (error) {
    console.error("Payments V7 server materializer failed", String((error as any)?.message || error));
    return json(503, {
      ok: false,
      code: "FINANCE_MATERIALIZER_UNAVAILABLE",
      correlation_id: correlationId,
    });
  }
});
