import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile('supabase/migrations/20261008144500_analytics_client_freshness_gate_v2.sql','utf8');
const edge=await readFile('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');

test('Client Analytics market items require CURRENT freshness',()=>{
  for(const token of [
    "pi.product not in ('АИ-92','АИ-95','ДТ','НАФТА','СУГ / СПБТ')",
    "source_freshness_state",
    ")='CURRENT'",
    "PUBLISHED_DERIVED_DISTRIBUTION_ALLOWED_FRESHNESS_CURRENT_MARKET_ITEMS_ONLY"
  ]) assert.ok(migration.includes(token),'missing RPC freshness gate: '+token);
  for(const token of [
    "pi.product not in ('АИ-92','АИ-95','ДТ','НАФТА','СУГ / СПБТ')",
    "source_freshness_state",
    ")='CURRENT'",
    "PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_PUBLIC_CHART_FRESHNESS_CURRENT_MARKET_ITEMS_ONLY"
  ]) assert.ok(edge.includes(token),'missing Edge freshness gate: '+token);
});

test('Freshness gate is projection-only and visual-freeze safe',()=>{
  assert.equal(/update\s+portal_private\.market_intelligence_facts/i.test(migration),false);
  assert.equal(/delete\s+from\s+portal_private\.market_intelligence_facts/i.test(migration),false);
  assert.equal(edge.includes('document.'),false);
  assert.equal(edge.includes('style.'),false);
  assert.ok(migration.includes('0f5f4cf9-8f56-42a7-b553-53c28abd0616'));
  assert.ok(migration.includes('ccc1d077-266a-4261-9de3-daf5968be4ab'));
});
