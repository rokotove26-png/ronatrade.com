import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('functions/portal/price-updates-api.js','utf8');

test('live price publication fallback is limited to canonical audience mutation', () => {
  assert.match(source, /rona-owner-price-publication-write-fallback/);
  const setMatch = source.match(/RONA_PRICE_POSTGREST_WRITE_FALLBACK_NAMES=new Set\(\[(.*?)\]\);/s);
  assert.ok(setMatch, 'write fallback allowlist missing');
  assert.match(setMatch[1], /owner_set_price_publication_audience/);

  for (const name of [
    'owner_apply_price_change_proposal',
    'owner_reject_price_change_proposal',
    'owner_decide_received_price_list',
    'owner_agent_cp_materialize_and_send',
    'owner_set_price_publication_for_client',
  ]) {
    assert.equal(setMatch[1].includes(name), false, name + ' must remain fail-closed');
  }
});

test('write fallback activates only after confirmed PostgREST availability failure', () => {
  const primary = source.indexOf('const primary=await fetch(`${RPC}/${encodeURIComponent(name)}`');
  const unavailable = source.indexOf('ronaPostgrestReadUnavailable(primary)');
  const writeFallback = source.indexOf('ronaPricePublicationWriteFallback(token,name,args)');
  assert.ok(primary >= 0 && unavailable > primary && writeFallback > unavailable, 'fallback ordering invalid');
  assert.match(source, /response\.status!==503/);
  assert.match(source, /PGRST000/);
  assert.match(source, /PGRST002/);
});
