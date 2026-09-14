import postgres from "npm:postgres@3.4.7";

const DB = Deno.env.get("SUPABASE_DB_URL");
if (!DB) throw new Error("MCP_RUNTIME_VARS_MISSING");
const sql = postgres(DB, { prepare: false, max: 3 });
const originalServe = Deno.serve.bind(Deno);

function isCurrentStateCall(req: Request): Promise<boolean> {
  if (req.method !== "POST") return Promise.resolve(false);
  try {
    return req.clone().json().then((msg: any) =>
      msg?.jsonrpc === "2.0" &&
      msg?.method === "tools/call" &&
      msg?.params?.name === "current_state"
    ).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

function cloneHeaders(headers: Headers) {
  const out = new Headers(headers);
  out.set("cache-control", "no-store, no-cache, must-revalidate");
  out.set("pragma", "no-cache");
  out.set("x-rona-role-state-contract", "RONA_ROLE_STATE_RECOVERY_V2");
  return out;
}

async function compactCurrentStateResponse(res: Response): Promise<Response> {
  if (!res.ok) return res;
  let envelope: any;
  try { envelope = await res.clone().json(); } catch { return res; }
  const content = envelope?.result?.content;
  if (!Array.isArray(content) || content.length < 1 || content[0]?.type !== "text" || typeof content[0]?.text !== "string") return res;

  let toolPayload: any;
  try { toolPayload = JSON.parse(content[0].text); } catch { return res; }
  if (toolPayload?.ok !== true || typeof toolPayload?.role !== "string") return res;

  let rows: any[];
  try {
    rows = await sql`select portal_private.ai_role_state_current_v2(${toolPayload.role}::portal_private.ai_business_role_enum, 10, 20) as data`;
  } catch (e) {
    console.error("role state v2 projection failed", String((e as any)?.message || e));
    return res;
  }
  if (!rows?.[0]?.data) return res;

  toolPayload.data = rows[0].data;
  content[0].text = JSON.stringify(toolPayload);
  const body = JSON.stringify(envelope);
  if (new TextEncoder().encode(body).length > 24000) {
    console.error("role state v2 response budget exceeded");
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: envelope?.id ?? null, error: { code: -32603, message: "ROLE_STATE_V2_RESPONSE_BUDGET_EXCEEDED" } }), {
      status: 500,
      headers: cloneHeaders(res.headers),
    });
  }
  return new Response(body, { status: res.status, statusText: res.statusText, headers: cloneHeaders(res.headers) });
}

(Deno as any).serve = function (...args: any[]) {
  if (typeof args[0] === "function") {
    const handler = args[0];
    return originalServe(async (req: Request) => {
      const compact = await isCurrentStateCall(req);
      const res = await handler(req);
      return compact ? await compactCurrentStateResponse(res) : res;
    });
  }
  if (typeof args[1] === "function") {
    const options = args[0];
    const handler = args[1];
    return originalServe(options, async (req: Request) => {
      const compact = await isCurrentStateCall(req);
      const res = await handler(req);
      return compact ? await compactCurrentStateResponse(res) : res;
    });
  }
  return (originalServe as any)(...args);
};

await import("https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/36727a94820e1e85e95d4abfc5d6aab8234c5c18/supabase/functions/rona-mcp-gateway/index.js");
