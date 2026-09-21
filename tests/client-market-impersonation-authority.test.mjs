import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [route,index,projection]=await Promise.all([
  readFile('functions/portal/api/v1/client/market-intelligence.js','utf8'),
  readFile('supabase/functions/rona-portal-api/index.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8')
]);

test('specific market route delegates active impersonation to canonical Edge authority',()=>{
  assert.match(route,/readBrowserImpersonation/);
  assert.match(route,/browserImpersonationInvalid/);
  assert.match(route,/applyBrowserImpersonation/);
  assert.match(route,/EFFECTIVE_CLIENT_FEED_API/);
  assert.match(route,/\/v1\/client\/market-intelligence/);
  assert.match(route,/if\(impersonation\.active\)/);
  assert.match(route,/IMPERSONATION_SESSION_INVALID/);
  assert.match(route,/owner_client_market_intelligence_feed_v1/);
});

test('canonical Edge owns effective Client market-intelligence dispatch',()=>{
  assert.match(index,/clientMarketIntelligenceForEffectiveClient/);
  assert.match(index,/route==="\/v1\/client\/market-intelligence"/);
  assert.match(index,/CLIENT_MARKET_CONTEXT_NOT_FOUND/);
});

test('effective Client feed is read-only and target-scoped',()=>{
  assert.match(projection,/c\.impersonation\?\.targetClientKey/);
  assert.match(projection,/client_user_bindings/);
  assert.match(projection,/client_user_has_contract_access/);
  assert.match(projection,/publication_client_targets/);
  assert.match(projection,/join authorized_clients ac on ac\.client_key=pct\.client_key/);
  assert.match(projection,/PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_PUBLIC_CHART_ONLY/);
  assert.match(projection,/PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_AUTHORITATIVE_SOURCE_DATE_7_CALENDAR_DATES_DEDUP/);
  assert.match(projection,/RONA_CLIENT_MARKET_INTELLIGENCE_V1/);
  assert.doesNotMatch(projection,/\b(?:insert|update|delete|alter|drop|truncate)\s+/i);
});
