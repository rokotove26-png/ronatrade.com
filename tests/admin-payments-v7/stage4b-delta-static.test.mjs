import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const deltaPath='supabase/migrations/20260913181100_admin_payments_v7_stage4b_owner_persistence_delta.sql';
const fullPath='supabase/migrations/20260913160703_admin_payments_v7_stage3a_authority_core.sql';
const delta=fs.readFileSync(deltaPath,'utf8');
const full=fs.readFileSync(fullPath,'utf8');

function functionBlock(sql){
  const start=sql.search(/create(?: or replace)? function portal_private\.persist_owner_payment_decision_v7\(/i);
  assert.notEqual(start,-1,'persistence function block missing');
  const tail=sql.slice(start);
  const end=tail.indexOf('\n$$;');
  assert.notEqual(end,-1,'persistence function terminator missing');
  return tail.slice(0,end+4).replace(/^create or replace function/i,'create function');
}

function executableSql(sql){
  return sql.replace(/--.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
}

test('Stage 4B delta function body is byte-for-byte source-locked to sealed branch contract',()=>{
  assert.equal(functionBlock(delta),functionBlock(full));
});

test('Stage 4B delta is schema-only and does not replay substrate or mutate business data',()=>{
  const sql=executableSql(delta).toLowerCase();
  for(const forbidden of [
    /\bcreate\s+table\b/,/\bcreate\s+view\b/,/\bcreate\s+role\b/,/\balter\s+table\b/,
    /\binsert\s+into\b/,/\bupdate\s+[a-z_]/,/\bdelete\s+from\b/,/\btruncate\b/,/\bgrant\b/
  ]) assert.equal(forbidden.test(sql),false,`forbidden Stage 4B delta statement: ${forbidden}`);
  assert.match(sql,/alter function portal_private\.persist_owner_payment_decision_v7\(uuid,jsonb,jsonb\)\s+set search_path\s*=\s*pg_catalog, portal_private/);
  assert.match(sql,/revoke execute on function portal_private\.persist_owner_payment_decision_v7\(uuid,jsonb,jsonb\)\s+from public, anon, authenticated, service_role, rona_payments_v7_reader/);
});

test('Stage 4B lineage regression forbids treating repository 160703 body as production physical state',()=>{
  assert.match(full,/create or replace function portal_private\.persist_owner_payment_decision_v7/);
  for(const marker of [
    '20260913160742_admin_payments_v7_stage3a_validation_function.sql',
    '20260913160902_admin_payments_v7_stage3a_immutability.sql',
    '20260913160927_admin_payments_v7_stage3a_owner_audit.sql',
    '20260913161026_admin_payments_v7_stage3a_finance_authority.sql'
  ]){
    const body=fs.readFileSync(`supabase/migrations/${marker}`,'utf8');
    assert.match(body,/Production applied/i);
  }
});
