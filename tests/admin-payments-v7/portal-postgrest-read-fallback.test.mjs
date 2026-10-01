import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  OWNER_POSTGREST_READ_FALLBACK_NAMES,
  PRICE_POSTGREST_READ_FALLBACK_NAMES,
  patchOwnerApiSource,
  patchPriceUpdatesApiSource,
} from '../../scripts/portal-postgrest-read-fallback.mjs';

const ownerFixture = [
  "const SUPABASE_URL='https://example.supabase.co';",
  "const SUPABASE_PUBLISHABLE_KEY='public';",
  "const RPC_UPSTREAM='https://example.supabase.co/rest/v1/rpc';",
  "async function rpcCall(token,name,args){return fetch(`${RPC_UPSTREAM}/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args||{})})}",
  "async function rpcAuthFailure(response){return response?.status===401}",
].join('\n');

const priceFixture = [
  "const SUPABASE_URL='https://example.supabase.co';",
  "const SUPABASE_PUBLISHABLE_KEY='public';",
  "const RPC='https://example.supabase.co/rest/v1/rpc';",
  "async function rpc(token,name,args={}){return fetch(`${RPC}/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args)})}",
  "async function session(req){return req}",
].join('\n');

test('owner fallback is limited to explicit read RPCs and preserves write fail-closed behavior', () => {
  const out = patchOwnerApiSource(ownerFixture);
  assert.match(out, /rona-owner-rpc-read-fallback/);
  assert.match(out, /response\.status!==503/);
  assert.match(out, /PGRST000/);
  assert.match(out, /PGRST002/);
  assert.match(out, /RONA_OWNER_POSTGREST_READ_FALLBACK_NAMES\.has\(name\)/);

  for (const name of [
    'owner_r1_application_business_action_v2',
    'owner_r1_send_to_payments',
    'owner_r1_cancel_deal',
    'rona_admin_operations_attention_ack_v1',
    'rona_portal_presence_heartbeat_v1',
  ]) {
    assert.equal(OWNER_POSTGREST_READ_FALLBACK_NAMES.includes(name), false, `${name} must remain fail-closed on PostgREST`);
  }
});

test('price fallback restores only read bootstraps, not publication mutations', () => {
  const out = patchPriceUpdatesApiSource(priceFixture);
  assert.match(out, /rona-owner-rpc-read-fallback/);
  assert.deepEqual(PRICE_POSTGREST_READ_FALLBACK_NAMES, [
    'owner_price_updates_bootstrap',
    'owner_prices_admin_workspace',
  ]);
  for (const name of [
    'owner_apply_price_change_proposal',
    'owner_reject_price_change_proposal',
    'owner_set_price_publication_audience',
    'owner_decide_received_price_list',
    'owner_agent_cp_materialize_and_send',
  ]) {
    assert.equal(PRICE_POSTGREST_READ_FALLBACK_NAMES.includes(name), false, `${name} must never use read fallback`);
  }
});

test('edge fallback is static, authenticated and contains no mutation statements', () => {
  const source = readFileSync('supabase/functions/rona-owner-rpc-read-fallback/index.ts', 'utf8');
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(source, /resolve_portal_auth/);
  assert.match(source, /set_config\('request\.jwt\.claims'/);
  assert.match(source, /switch \(name\)/);
  assert.match(source, /READ_RPC_NOT_ALLOWED/);
  assert.doesNotMatch(source, /insert\s+into/i);
  assert.doesNotMatch(source, /delete\s+from/i);
  assert.doesNotMatch(source, /update\s+[a-z0-9_.]+\s+set/i);
  assert.doesNotMatch(source, /truncate\s+/i);
});
