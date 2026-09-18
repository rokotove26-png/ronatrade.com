import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20260918195000_finance_cash_reversal_effective_payment_v1.sql'),'utf8');

test('reversal matching is deterministic and source-locked, not amount-only',()=>{
  for(const token of [
    "source_locked=true",
    "p.account_identity=r.account_identity",
    "p.currency=r.currency",
    "p.bank_fee is not distinct from r.bank_fee",
    "p.canonical_counterparty_id=r.canonical_counterparty_id",
    "p.raw_party_key=r.raw_party_key",
    "p.source_bank_name is not distinct from r.source_bank_name",
    "p.payment_purpose_key=r.reversal_purpose_key",
    "p.payment_at<=r.reversal_at",
    "p.amount>=r.amount",
    "candidate_count=1"
  ]) assert.ok(sql.includes(token),token);
  assert.ok(!sql.includes("similarity("));
  assert.ok(!sql.includes("levenshtein("));
});

test('effective payment semantics expose raw, reversed and effective states',()=>{
  for(const token of [
    "raw_operation_type",
    "gross_amount",
    "reversed_amount",
    "effective_external_payment_amount",
    "effective_payment_status",
    "matched_original_operation_fingerprint",
    "matched_original_operation_ref",
    "matched_reversal_operation_refs",
    "reversal_pair_status",
    "reversal_pair_evidence",
    "'SETTLED'",
    "'REVERSED'",
    "'PARTIALLY_REVERSED'",
    "'NOT_APPLICABLE'",
    "'FINANCE_EFFECTIVE_PAYMENT_V1'"
  ]) assert.ok(sql.includes(token),token);
});

test('raw ledger remains authoritative and period projection adds effective payment separately',()=>{
  assert.ok(sql.includes("from portal_private.finance_cash_daily_summary_v1 d"));
  assert.ok(sql.includes("sum(external_payment)::numeric(30,8) as gross_external_payment"));
  assert.ok(sql.includes("effective_external_payment"));
  assert.ok(sql.includes("matched_external_payment_reversal"));
  assert.ok(sql.includes("reversal_count"));
  assert.ok(sql.includes("matched_reversal_count"));
  assert.ok(sql.includes("unresolved_reversal_count"));
});

test('unresolved or conflicting effective payment fails closed',()=>{
  assert.ok(sql.includes("then null::numeric"));
  assert.ok(sql.includes("'TO_VERIFY'"));
  assert.ok(sql.includes("'CONFLICT'"));
  assert.ok(sql.includes("effective_payment_unresolved_count"));
});
