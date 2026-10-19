import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../../functions/portal/deals-current-state-ui.js';

async function runtime(){
 const response=await onRequest();
 const source=await response.text();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-rona-deals-basis'),'agreed-basis-only-v3');
 new Function(source);
 return source;
}

test('Deals table displays ONLY the agreed Incoterms basis, no price-list or destination commentary',async()=>{
 const source=await runtime();
 assert.match(source,/function basisCell\(d\)/);
 assert.match(source,/function basisText\(d\)\{var raw=/);
 assert.match(source,/basisText\(d\)/);
 assert.doesNotMatch(source,/По прайсу: /);
 assert.doesNotMatch(source,/Базис уточняется/);
 assert.doesNotMatch(source,/basisReferenceNeedsApproval\(/);
 assert.doesNotMatch(source,/DEAL-2026-01[2-6]/);
});

test('Keep exact confirmed place independent from client downstream station',async()=>{
 const source=await runtime();
 assert.match(source,/String\(d&&d\.delivery_basis\|\|''\)\.trim\(\)/);
 assert.ok(source.includes('Incoterms'),'basis formatter must retain Incoterms normalization');
 assert.match(source,/function basisCell\(d\)\{var box=el\('div','rona-current-deal-cell'\)/);
 assert.doesNotMatch(source,/published_basis_reference/);
 assert.doesNotMatch(source,/published_price_reference/);
});

test('Canonical V4 read and navigation freshness remain',async()=>{
 const source=await runtime();
 assert.match(source,/api\('\/admin\/deals-current-v4'\)/);
 assert.match(source,/NAVIGATION_INVALIDATED_NO_INTERVAL_V2/);
 assert.match(source,/__RONA_DEALS_CURRENT_PENDING_INVALIDATION__/);
 assert.match(source,/post_rail_completion_attention/);
});

test('Backend migration resolves delivered-price basis at source and guards registration',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261019210000_client_delivery_basis_source_truth_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/client_intake_requested_delivery_basis_v1/);
 assert.match(sql,/destination_price_requested/);
 assert.match(sql,/REQUEST_DELIVERED_PRICE/);
 assert.match(sql,/DELIVERED_BASIS_EXACT_STATION_REQUIRED/);
 assert.match(sql,/return 'DAP ст\. '\|\|station\|\|', Incoterms 2020'/);
 assert.match(sql,/portal_private\.materialize_client_application_v2/);
 assert.match(sql,/p#>>''\{shipment,source_basis\}''/);
 assert.match(sql,/DEAL_DELIVERED_BASIS_NOT_SOURCE_LOCKED/);
 assert.match(sql,/DEAL_PUBLISHED_BASIS_NOT_SOURCE_LOCKED/);
 assert.match(sql,/BEFORE_CLIENT_DELIVERED_BASIS_SOURCE_20261019/);
 assert.match(sql,/BEFORE_DELIVERY_BASIS_SOURCE_LOCK_20261019/);
 assert.doesNotMatch(sql,/UPDATE\s+portal_private\.client_applications\s+SET/i);
 assert.doesNotMatch(sql,/DEAL-2026-01[2-6]/);
});
