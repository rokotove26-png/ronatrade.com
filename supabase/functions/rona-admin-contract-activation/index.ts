// @ts-nocheck
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!SUPA_URL) throw new Error("SUPABASE_URL missing");

const TARGET = `${SUPA_URL}/functions/v1/rona-admin-client-authority`;
const SOURCE_MARKER = "/rona-admin-contract-activation";

function send(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function forwardedHeaders(req: Request) {
  const headers = new Headers();
  for (const name of [
    "authorization",
    "content-type",
    "accept",
    "x-request-id",
    "x-correlation-id",
    "x-idempotency-key",
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return send(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  }

  const url = new URL(req.url);
  const markerIndex = url.pathname.indexOf(SOURCE_MARKER);
  if (markerIndex < 0) {
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  }

  const suffix = url.pathname.slice(markerIndex + SOURCE_MARKER.length) || "/";
  if (!/^\/contracts\/[^/]+\/signed-document\/attach$/.test(suffix)) {
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  }

  const targetUrl = `${TARGET}${suffix}${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: forwardedHeaders(req),
      body: await req.arrayBuffer(),
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error("rona-admin-contract-activation proxy error", error);
    return send(502, { ok: false, code: "CONTRACT_ACTIVATION_UPSTREAM_ERROR" });
  }
});
