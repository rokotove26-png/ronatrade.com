// P1 Client Intake / Stage 2.3 completion wrapper.
// This layer does not replace the active portal handlers. It verifies that successful
// client-intake writes and the two intake-bearing read projections are backed by the
// durable intake contract installed by Stage 2.2.

export const CLIENT_INTAKE_STAGE23_CONTRACT = "RONA_CLIENT_INTAKE_STAGE23_FAIL_CLOSED_V1";

const DB = Deno.env.get("SUPABASE_DB_URL");
const originalServe = Deno.serve.bind(Deno);

function routeOf(req: Request) {
  const url = new URL(req.url);
  const marker = "/rona-portal-api";
  const at = url.pathname.indexOf(marker);
  return at >= 0 ? (url.pathname.slice(at + marker.length) || "/") : url.pathname;
}

function failResponse(code: string, status = 503) {
  return new Response(JSON.stringify({ ok: false, code, client_intake_contract: CLIENT_INTAKE_STAGE23_CONTRACT }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-rona-client-intake-stage23": CLIENT_INTAKE_STAGE23_CONTRACT,
    },
  });
}

async function clientEvent(req: Request) {
  if (req.method !== "POST" || routeOf(req) !== "/v1/events") return false;
  try {
    const body: any = await req.clone().json();
    return String(body?.role || "").trim().toUpperCase() === "CLIENT";
  } catch {
    return false;
  }
}

async function criticalRoute(req: Request) {
  const route = routeOf(req);
  if (req.method === "POST" && route === "/v1/client/applications") return "WRITE";
  if (await clientEvent(req)) return "WRITE";
  if (req.method === "GET" && route === "/v1/client/context") return "READ";
  if (req.method === "GET" && route === "/v1/admin/bootstrap") return "READ";
  return null;
}

async function hasDurabilityContract(response: Response) {
  if (!response.ok) return true;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return false;
  try {
    const payload: any = await response.clone().json();
    const intakeId = String(payload?.intake_id || payload?.application?.intake_id || payload?.event?.intake_id || "").trim();
    const durableId = String(payload?.durable_id || payload?.application?.durable_id || payload?.event?.durable_id || "").trim();
    const sourceId = String(payload?.source_id || payload?.application?.source_id || payload?.event?.source_id || "").trim();
    return Boolean(intakeId && durableId && sourceId);
  } catch {
    return false;
  }
}

// Installed before Stage 2.2. Stage 2.2 captures this wrapper as its originalServe,
// then the pinned production bootstrap registers through both layers. Request order is:
// Stage 2.3 -> Stage 2.2 -> active production handler.
(Deno as any).serve = function stage23Serve(first: any, second?: any) {
  const handler = typeof first === "function" ? first : second;
  const options = typeof first === "function" ? undefined : first;
  if (typeof handler !== "function") return originalServe(first, second);

  const wrapped = async (req: Request, info: any) => {
    const critical = await criticalRoute(req);
    if (critical && !DB) return failResponse("CLIENT_INTAKE_DURABILITY_UNAVAILABLE");

    const response: Response = await handler(req, info);
    if (critical === "WRITE" && response.ok && !(await hasDurabilityContract(response))) {
      return failResponse("CLIENT_INTAKE_DURABILITY_MISSING");
    }
    if (critical && response.ok) {
      const headers = new Headers(response.headers);
      headers.set("x-rona-client-intake-stage23", CLIENT_INTAKE_STAGE23_CONTRACT);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  };

  return options === undefined ? originalServe(wrapped) : originalServe(options, wrapped);
};

await import("./stage21-bootstrap.ts");
