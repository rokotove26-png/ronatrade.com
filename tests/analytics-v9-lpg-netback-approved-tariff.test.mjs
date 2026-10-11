import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {onRequest} from '../functions/portal/analytics-v2-ui.js';
const read=path=>readFileSync(path,'utf8');
const gitHash=source=>createHash('sha1').update('blob '+Buffer.byteLength(source)+'\0'+source).digest('hex');
const g=JSON.parse(read('governance/analytics-v9-lpg-netback-approved-rail-20261011.json'));

test('V9 owner instruction and exact signed predecessor preserved: no new price/rate market facts',()=>{
  assert.equal(g.approval,'OWNER_IN_CHAT');
  assert.equal(g.scope,'ADMIN_ANALYTICS_LPG_PLATTS_NETBACK_PLUS_OWNER_CONFIRMED_RAIL_TARIFF_V9');
  assert.equal(g.source_locks.owner_bootstrap_live_predecessor_md5,'973c775f6d984fe5b293510270dba9be');
  assert.equal(g.source_locks.admin_delivery_before,'47c2154659cc72a56fae6df74c2b0e0bbcf38f77');
  assert.equal(gitHash(read('functions/portal/analytics-v2-ui.js')),g.source_locks.admin_delivery_after);
  assert.equal(gitHash(read('supabase/migrations/20261011011500_analytics_lpg_platts_netback_owner_tariff_v9.sql')),g.source_locks.migration_blob);
  assert.equal(gitHash(read('functions/portal/analytics-canonical-live-hydration.js')),g.source_locks.protected_r4_hydration);
  assert.equal(gitHash(read('functions/portal/analytics-v2-approved-base.js')),g.source_locks.frozen_original_r4);
  assert.equal(gitHash(read('assets/portal-runtime/client-market-intelligence-v1.js')),g.source_locks.client_v20_unchanged);
});

test('Source-locked SQL appends only admin private transport rates with unambiguous active matching route',()=>{
  const sql=read('supabase/migrations/20261011011500_analytics_lpg_platts_netback_owner_tariff_v9.sql');
  for(const s of [
    'market_intelligence_admin_lpg_tariff_bridge_v1','LPG_SPBT',"t.status='WORKING_CONFIRMED'",
    't.approved_at IS NOT NULL','t.valid_to IS NULL','t.source_refs',
    "other.status='WORKING_CONFIRMED'",'NOT EXISTS','tariff_usd_per_t','jsonb_set(p',
    "'PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1'","'NOT_INCLUDED'",
    "portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(v)"
  ])assert.ok(sql.includes(s),'SQL source requirement '+s);
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION')&&sql.includes('FROM anon, authenticated'));
  assert.ok(!sql.includes('INSERT INTO portal_private.owner_rail_tariff_matrix'));
  assert.ok(!sql.includes('UPDATE portal_private.owner_price_snapshots'));
  assert.ok(!sql.includes('GRANT EXECUTE'));
  assert.ok(!sql.includes('RETURN jsonb_set(p,')||sql.includes("'{canonicalAnalytics,products,LPG,rona,netbackTariffBridges}'"));
});

test('Admin R4 output computes only positive source-confirmed LPG destination rail, while keeping chart single-owner',async()=>{
  const res=await onRequest({});
  assert.equal(res.status,200);
  const s=await res.text();
  new Function(s);
  for(const tok of [
    'PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1','netbackTariffBridges',
    'WORKING_CONFIRMED','marketSourceRef',
    'ЖД тариф ','Индикативно, не коммерческая оферта.',
    'MARKET_REFERENCE_NOT_CONFIRMED','source-only-v7'
  ])assert.ok(s.includes(tok),'Runtime missing '+tok);
  assert.equal((s.match(/function adminCompactChart\(root,product,key\)/g)||[]).length,1,'No new SVG painter');
  assert.ok(!s.includes('source-observation-gaps-v13'));
  assert.ok(!s.includes('function renderAnalytics(){'));
  assert.ok(s.includes('if(!forecast||!hasPriceBase(product)){'),'Keep fail-closed original R4 missing-price guard');
});

test('No accidental LPG pricing data in client runtime and no authorized source provenance hidden',()=>{
  const client=read('assets/portal-runtime/client-market-intelligence-v1.js');
  assert.ok(!client.includes('netbackTariffBridges'));
  const sql=read('supabase/migrations/20261011011500_analytics_lpg_platts_netback_owner_tariff_v9.sql');
  assert.ok(sql.includes("v_forecast->>'sourceRef'"));
  assert.ok(sql.includes('approved_at'));
  assert.ok(sql.includes('source_refs'));
});
