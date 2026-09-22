import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const proxy=await readFile('functions/portal/api/[[path]].js','utf8');
const candidate=await readFile('supabase/functions/rona-portal-api-candidate-20260817/client-rail-isolated-runtime-v1.ts','utf8');
const projection=await readFile('supabase/functions/rona-portal-api-candidate-20260817/client-rail-canonical-projection-v1.mjs','utf8');

assert.ok(proxy.includes("path==='/v1/client/rail-canonical'"),'Cloudflare proxy must isolate Client Rail route');
assert.ok(proxy.includes("CLIENT_RAIL_ISOLATED_BACKEND_V1"),'isolated Rail selector missing');
assert.ok(proxy.includes("path==='/v1/client/deal-state'"),'Cloudflare proxy must route canonical Deal State to the isolated Client backend');
assert.ok(proxy.includes("CLIENT_DEAL_STATE_CANONICAL_V1"),'canonical Deal State selector missing');
assert.ok(proxy.includes("return{slot:'production',fn:'rona-portal-api'"),'all non-Rail production traffic must remain on stable portal API');

assert.ok(candidate.includes("clientRailCanonical(req:Request,u:URL)"),'candidate Rail handler missing');
assert.ok(candidate.includes("proxy(req,'/v1/client/context'"),'Rail authority must delegate to stable production Client context');
assert.ok(candidate.includes("responseClientId!==clientId||responseContractId!==contractId"),'exact authorized context match required');
assert.ok(candidate.includes("rona_rail_deal_map_read_model_core_v2"),'cohort-aware server-only canonical Rail core missing');
assert.ok(candidate.includes("CLIENT_RAIL_ISOLATED_V1_PLUS_CANONICAL_DEAL_STATE_V1_COHORT_ROUTE_V1"),'cohort route backend version marker missing');
assert.ok(candidate.includes("RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4"),'canonical Admin V4 compatibility check missing');
assert.ok(candidate.includes("CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE"),'degraded fail-closed response missing');
assert.ok(projection.includes('const routeCohortsByDeal={}'),'Client Rail cohort projection collection missing');
assert.ok(projection.includes('publishByDeal(routeCohortsByDeal,scope,array(deal.routeCohorts))'),'Client Rail must publish route cohorts per deal');
assert.ok(projection.includes('routeCohortContractVersion:"RAIL_ROUTE_COHORTS_V1"'),'Client Rail cohort contract marker missing');
assert.ok(candidate.includes("clientDealState(req:Request,u:URL)"),'canonical Deal State handler missing');
assert.ok(candidate.includes("route==='/v1/client/deal-state'"),'canonical Deal State route missing');
assert.ok(candidate.includes("CLIENT_DEAL_STATE_CONTRACT"),'canonical Deal State contract missing');
assert.ok(candidate.includes("PRODUCTION_CONTEXT_FINANCE_V7_RESOURCE_RAIL_V4"),'canonical Deal State lineage marker missing');
assert.ok(candidate.includes("x-rona-admin-impersonation-token"),'Client impersonation header forwarding missing');

assert.ok(!candidate.includes("owner_r1_actor('ADMIN')"),'Client isolated backend must not impersonate Admin');
assert.ok(!proxy.includes("path.startsWith('/v1/admin/')&&"),'Admin routes must not be redirected to candidate');

console.log('CLIENT_RAIL_ISOLATED_BACKEND_AFTER_INCIDENT=PASS rail=true canonical_deal_state=true');
