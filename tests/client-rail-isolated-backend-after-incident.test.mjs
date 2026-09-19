import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const proxy=await readFile('functions/portal/api/[[path]].js','utf8');
const candidate=await readFile('supabase/functions/rona-portal-api-candidate-20260817/client-rail-isolated-runtime-v1.ts','utf8');

assert.ok(proxy.includes("path==='/v1/client/rail-canonical'"),'Cloudflare proxy must isolate Client Rail route');
assert.ok(proxy.includes("CLIENT_RAIL_ISOLATED_BACKEND_V1"),'isolated Rail selector missing');
assert.ok(proxy.includes("return{slot:'production',fn:'rona-portal-api'"),'all non-Rail production traffic must remain on stable portal API');

assert.ok(candidate.includes("clientRailCanonical(req:Request,u:URL)"),'candidate Rail handler missing');
assert.ok(candidate.includes("proxy(req,'/v1/client/context'"),'Rail authority must delegate to stable production Client context');
assert.ok(candidate.includes("responseClientId!==clientId||responseContractId!==contractId"),'exact authorized context match required');
assert.ok(candidate.includes("rona_rail_deal_map_read_model_core_v1"),'server-only canonical Rail core missing');
assert.ok(candidate.includes("RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4"),'canonical Admin V4 compatibility check missing');
assert.ok(candidate.includes("CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE"),'degraded fail-closed response missing');

assert.ok(!candidate.includes("owner_r1_actor('ADMIN')"),'Client isolated backend must not impersonate Admin');
assert.ok(!proxy.includes("path.startsWith('/v1/admin/')&&"),'Admin routes must not be redirected to candidate');

console.log('CLIENT_RAIL_ISOLATED_BACKEND_AFTER_INCIDENT=PASS');
