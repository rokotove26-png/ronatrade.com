import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile('supabase/migrations/20261008151500_market_source_ingestion_basis_v2.sql','utf8');

test('manual source backfill preserves ULSD FOB Med basis',()=>{
  assert.ok(sql.includes("market_intelligence.manual_source_backfill_v2"));
  assert.ok(sql.includes("ULSD_FOB_MED"));
  assert.ok(sql.includes("'FOB Med'"));
  assert.equal(sql.includes("ULSD_CIF_NWE"),false);
  assert.equal(sql.includes("Cargoes CIF NWE/Basis ARA"),false);
  assert.ok(sql.includes("excluded from BNK Diesel Composite"));
});

test('basis correction is authority locked',()=>{
  assert.ok(sql.includes('ace92d08-ab44-4178-9fcf-c23cad2267c8'));
  assert.ok(sql.includes('43e01959-3b26-46a8-a217-244d8364b36f'));
  assert.ok(sql.includes("functional_role::text='COMMERCIAL_DIRECTOR'"));
  assert.ok(sql.includes("functional_role::text='OPERATIONS_DIRECTOR'"));
});
