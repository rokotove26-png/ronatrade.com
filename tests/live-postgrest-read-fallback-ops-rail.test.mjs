import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const owner = readFileSync('functions/portal/owner-api.js','utf8');
const rail = readFileSync('supabase/functions/rona-owner-acceptance/application-owner-boundary-bootstrap-v3.ts','utf8');

test('live Owner proxy falls back only for explicit read RPCs', () => {
  for (const name of [
    'rona_admin_operations_current_v2',
    'rona_admin_operations_current_v1',
    'rona_admin_operations_attention_seen_v1',
  ]) {
    assert.match(owner, new RegExp(name));
  }
  assert.match(owner, /response\.status!==503/);
  assert.match(owner, /PGRST000/);
  assert.match(owner, /PGRST002/);
  for (const name of [
    'rona_admin_operations_attention_ack_v1',
    'rona_portal_presence_heartbeat_v1',
    'owner_r1_application_business_action_v2',
    'owner_r1_send_to_payments',
    'owner_r1_cancel_deal',
  ]) {
    const setMatch = owner.match(/RONA_OWNER_POSTGREST_READ_FALLBACK_NAMES=new Set\(\[(.*?)\]\);/s);
    assert.ok(setMatch, 'Owner fallback allowlist missing');
    assert.equal(setMatch[1].includes(name), false, `${name} must remain fail-closed`);
  }
});

test('Rail read model keeps primary PostgREST and uses fallback only on availability failures', () => {
  const primary = rail.indexOf('userClient.rpc("rona_admin_rail_deal_map_read_model_v4"');
  const unavailable = rail.indexOf('const postgrestUnavailable');
  const fallback = rail.indexOf('/functions/v1/rona-owner-rpc-read-fallback');
  assert.ok(primary >= 0 && unavailable > primary && fallback > unavailable, 'Rail fallback ordering invalid');
  assert.match(rail, /code === "PGRST000"/);
  assert.match(rail, /code === "PGRST002"/);
  assert.match(rail, /peer authentication failed/i);
  assert.match(rail, /name: "rona_admin_rail_deal_map_read_model_v4"/);
  assert.doesNotMatch(rail.slice(unavailable, fallback + 2000), /insert\s+into|delete\s+from|update\s+[a-z0-9_.]+\s+set|truncate\s+/i);
});
