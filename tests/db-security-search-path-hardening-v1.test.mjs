import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql=readFileSync(new URL('../supabase/migrations/20260920041200_client_application_price_trigger_search_path_hardening_v1.sql',import.meta.url),'utf8');

test('client application effective-price trigger uses fixed search_path',()=>{
  assert.match(sql,/alter function portal_private\.sync_client_application_effective_price\(\)[\s\S]*set search_path = pg_catalog, portal_private/i);
});

test('trigger function is not directly executable by portal roles',()=>{
  for(const role of ['public','anon','authenticated']){
    assert.match(sql,new RegExp('revoke all on function portal_private\\.sync_client_application_effective_price\\(\\) from '+role,'i'));
  }
  assert.match(sql,/grant execute on function portal_private\.sync_client_application_effective_price\(\) to postgres/i);
});
