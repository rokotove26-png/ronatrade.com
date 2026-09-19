// #670 Client Online Rail — production-v55 preserving wrapper.
// Repository candidate only. System Administrator owns deploy.
// Every non-Rail request is delegated to the exact deployed v55 source.
import {
  sql,
  authenticate,
  apiRoute,
  send,
  origins,
} from "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/77588541119bb1a96375beed3e853e067ab1422f/supabase/functions/rona-portal-api/shared.ts";
import {
  CLIENT_RAIL_CANONICAL_CONTRACT,
  projectClientRailCanonical,
} from "./client-rail-canonical-projection-v1.mjs";

const LIVE_V55_SOURCE =
  "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/1c356872f3640f35c40158d01ae363521272ce3d/supabase/functions/rona-portal-api/payments-v8-production-hardening.ts";

const nativeServe = Deno.serve.bind(Deno);
let liveV55Handler:any = null;

(Deno as any).serve = function captureLiveV55(first:any, second?:any) {
  const handler = typeof first === "function" ? first : second;
  if (typeof handler !== "function") throw new Error("CLIENT_RAIL_LIVE_V55_HANDLER_REQUIRED");
  liveV55Handler = handler;
  return {
    finished: Promise.resolve(),
    shutdown() {},
    ref() {},
    unref() {},
  };
};

await import(LIVE_V55_SOURCE);
(Deno as any).serve = nativeServe;

if (typeof liveV55Handler !== "function") {
  throw new Error("CLIENT_RAIL_LIVE_V55_HANDLER_CAPTURE_FAILED");
}

function clean(value:unknown, max = 200) {
  const valueText = String(value ?? "").trim();
  return valueText && valueText.length <= max ? valueText : null;
}

async function authorizedContext(c:any, clientId:string, contractId:string) {
  const rows = await sql`
    select distinct
      cl.id as client_key,
      cl.client_id,
      ct.id as contract_key,
      ct.contract_id
    from portal_private.client_user_bindings b
    join portal_private.clients cl on cl.id=b.client_key
    join portal_private.contracts ct on ct.id=b.contract_key
    where b.user_id=${c.user}::uuid
      and b.status='ACTIVE'
      and b.revoked_at is null
      and b.valid_from<=now()
      and (b.valid_to is null or b.valid_to>now())
      and b.lifecycle_state='ACTIVE'
      and cl.client_id=${clientId}
      and ct.contract_id=${contractId}
      and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now())
    limit 2
  `;
  if (rows.length !== 1) return null;
  return rows[0];
}

async function authorizedDeals(c:any, context:any) {
  return await sql`
    select distinct
      d.id as deal_key,
      d.deal_id,
      d.business_status,
      d.lifecycle_state::text as lifecycle_state
    from portal_private.deals d
    where d.client_key=${context.client_key}::uuid
      and d.contract_key=${context.contract_key}::uuid
      and d.lifecycle_state='ACTIVE'
      and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now())
    order by d.deal_id
  `;
}

async function exactDealReadModel(deal:any) {
  const rows = await sql`
    select portal_private.rona_admin_rail_deal_map_read_model_v4(${deal.deal_id}) as data
  `;
  const model = rows[0]?.data;
  const modelDeals = Array.isArray(model?.deals) ? model.deals : [];
  if (
    !model ||
    String(model.modelVersion || "") !== "RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4" ||
    modelDeals.length !== 1 ||
    String(modelDeals[0]?.dealId || "") !== String(deal.deal_id) ||
    String(modelDeals[0]?.dealKey || "") !== String(deal.deal_key)
  ) {
    const error = new Error("CLIENT_RAIL_CANONICAL_READ_MODEL_DEGRADED");
    error.status = 503;
    throw error;
  }
  return model;
}

async function clientRailCanonical(req:Request) {
  const origin = req.headers.get("origin");
  if (origin && !origins.has(origin)) return send(null, 403, { ok:false, code:"ORIGIN_DENIED" });
  if (req.method !== "GET") return send(origin, 405, { ok:false, code:"METHOD_NOT_ALLOWED" });

  const c = await authenticate(req);
  if (!c) return send(origin, 401, { ok:false, code:"PORTAL_ACCESS_DENIED" });
  if (!c.roles.includes("CLIENT")) return send(origin, 403, { ok:false, code:"ROLE_MISMATCH" });

  const url = new URL(req.url);
  const clientId = clean(url.searchParams.get("clientId"), 160);
  const contractId = clean(url.searchParams.get("contractId"), 160);
  if (!clientId || !contractId) {
    return send(origin, 400, { ok:false, code:"CLIENT_CONTRACT_CONTEXT_REQUIRED" });
  }

  const context = await authorizedContext(c, clientId, contractId);
  if (!context) {
    // Do not distinguish nonexistent from another client's context.
    return send(origin, 404, { ok:false, code:"CONTEXT_NOT_FOUND" });
  }

  try {
    const deals = await authorizedDeals(c, context);
    const readModels:any[] = [];
    for (const deal of deals) readModels.push(await exactDealReadModel(deal));

    const data = projectClientRailCanonical({
      context: {
        client_id: String(context.client_id),
        contract_id: String(context.contract_id),
      },
      deals,
      readModels,
    });

    return send(origin, 200, {
      ok:true,
      data,
      projection_contract:CLIENT_RAIL_CANONICAL_CONTRACT,
    });
  } catch (error:any) {
    console.error("CLIENT_RAIL_CANONICAL_READ_MODEL_FAILED", error);
    return send(origin, 503, {
      ok:false,
      code:"CLIENT_RAIL_CANONICAL_READ_MODD_UNAVAILABLIE",
      retryable:true,
    });
  }
}

nativeServe(async (req:Request, info:any) => {
  const route = apiRoute(new URL(req.url));
  if (route === "/v1/client/rail-canonical") return await clientRailCanonical(req);
  return await liveV55Handler(req, info);
});
