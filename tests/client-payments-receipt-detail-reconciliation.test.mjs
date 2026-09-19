import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hardening=await readFile('supabase/functions/rona-portal-api/payments-v8-production-hardening.ts','utf8');
const runtime=await readFile('assets/portal-runtime/client-payments-authoritative-v1.js','utf8');

for(const marker of [
  'CLIENT_RECEIPT_DETAIL_RECONCILIATION_V1',
  "'/v1/client/context'",
  "'/v1/client/payments'",
  "p.payment_direction::text='INCOMING'",
  "p.payment_kind::text='CLIENT_PAYMENT'",
  "p.bank_fact_status::text='RECEIVED_UNVERIFIED'",
  "p.finance_verification_status::text='VERIFIED'",
  "p.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'",
  "OWNER_CONFIRMED_RECEIPT_MATERIALIZED",
  "client_receipt_status",
  "FINANCE_CONFIRMED",
  "other_cl.client_id<>",
  "other_ct.contract_id<>"
]) assert.ok(hardening.includes(marker),`hardening missing ${marker}`);

assert.ok(hardening.includes("bank_fact_status:String(row?.bank_fact_status||'')"),'original bank fact must be preserved');
assert.ok(!hardening.includes("payment.bank_fact_status='BANK_CONFIRMED'"),'must not spoof bank confirmation');
assert.ok(!/RONA-C\d{3}|DEAL-2026-\d{3}|FARGONA|SOLYARIS/iu.test(hardening),'hardcoded business entity forbidden');

for(const marker of [
  '20260919-client-payments-authoritative-v3-receipt-reconciliation',
  'client_receipt_status',
  "safe==='FINANCE_CONFIRMED'",
  "safe==='BANK_CONFIRMED'"
]) assert.ok(runtime.includes(marker),`runtime missing ${marker}`);
assert.ok(!/RONA-C\d{3}|DEAL-2026-\d{3}/.test(runtime),'runtime business hardcode forbidden');

console.log('CLIENT_PAYMENTS_RECEIPT_DETAIL_RECONCILIATION=PASS');
