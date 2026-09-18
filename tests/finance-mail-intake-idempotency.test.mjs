import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../supabase/migrations/20260918005000_payments_final_automation_hardening.sql',import.meta.url),'utf8');
const bridge=await readFile(new URL('../supabase/functions/rona-role-mail-bridge/index.ts',import.meta.url),'utf8');

test('finance mail intake is idempotent on mailbox uid-validity and imap uid',()=>{
  assert.match(migration,/unique\(mailbox,uid_validity,imap_uid\)/i);
  assert.match(migration,/m\.imap_uid>c\.baseline_uid/);
  assert.match(migration,/on conflict\(mailbox,uid_validity,imap_uid\) do nothing/i);
  assert.doesNotMatch(migration,/\bUID90\b|\bimap_uid\s*=\s*90\b/i);
});

test('existing 5-minute role mailbox sync drives full Finance source intake',()=>{
  assert.match(bridge,/syncInbox\(mailbox:string\)/);
  assert.match(bridge,/processFinanceIntake\(mailbox\)/);
  assert.match(bridge,/fetchMessage\(mailbox,Number\(item\.imap_uid\),true\)/);
  assert.match(bridge,/finance_mail_intake_complete_v1/);
  assert.match(bridge,/attachments:Array\.isArray\(fetched\?\.attachments\)/);
});

test('technical source is routed to AI-FINANCE without creating Finance business facts',()=>{
  assert.match(migration,/portal_private\.source_objects/);
  assert.match(migration,/assigned_functional_role[\s\S]*'FINANCE'/);
  assert.match(migration,/FINANCE_MAIL_SOURCE_V1/);
  for(const forbidden of [/insert\s+into\s+portal_private\.payments/i,/insert\s+into\s+portal_private\.payment_allocations/i,/insert\s+into\s+portal_private\.deal_finance_authority_v7/i,/bank_fact_status\s*=/i])assert.doesNotMatch(bridge,forbidden);
});

test('retry and permanent technical alert paths remain observable',()=>{
  assert.match(migration,/state='RETRY'/);
  assert.match(migration,/state='DEAD_LETTER'/);
  assert.match(migration,/finance_mail_intake_alerts_v1/);
  assert.match(bridge,/finance_mail_intake_fail_v1/);
});


test('bridge source remains parseable around Finance intake SQL tags',()=>{
  const start=bridge.indexOf('async function processFinanceIntake');
  const end=bridge.indexOf('\nfunction clean',start);
  const block=bridge.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.equal(block.includes('\\`'),false);
  assert.equal(block.includes('\\${'),false);
  assert.match(block,/finance_mail_intake_claim_v1\(8\)/);
});
