import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../supabase/functions/rona-owner-ai-sync/owner-confirmed-receipt-projection.mjs', import.meta.url), 'utf8');

test('canonical receipt resolver is writer-neutral across authoritative Finance materializers', () => {
  assert.match(source, /OWNER_CONFIRMED_RECEIPT_RESOLVER_V2/);
  assert.match(source, /FINANCE_OWNER_CONFIRMED_RECEIPT_V1/);
  assert.match(source, /pa\.source_version=p\.source_version/);
  assert.match(source, /attr\.source_version=p\.source_version/);
  assert.match(source, /fe\.source_version=p\.source_version/);
  assert.match(source, /attr\.authority_kind=\$\{OWNER_ATTRIBUTION_KIND\}/);
  assert.match(source, /attr\.source_locked=true/);
  assert.match(source, /attr\.attribution_mode='EXACT'/);
  assert.match(source, /attr\.decision_type='BIND_TO_DEAL'/);
  assert.match(source, /attr\.materialization_status='MATERIALIZED'/);
  assert.match(source, /coalesce\(\(fe\.result_snapshot->>'accepted'\)::boolean,false\)=true/);
  assert.match(source, /coalesce\(\(fe\.result_snapshot->>'materialized'\)::boolean,false\)=true/);
  assert.match(source, /fe\.result_snapshot->>'payment_key'=p\.id::text/);
  assert.match(source, /fe\.result_snapshot->>'allocation_id'=pa\.id::text/);
  assert.doesNotMatch(source, /p\.source_version=\$\{LEGACY_OWNER_SOURCE_VERSION\}/);
  assert.doesNotMatch(source, /pa\.source_version=\$\{LEGACY_OWNER_SOURCE_VERSION\}/);
  assert.doesNotMatch(source, /receipt_authority.*OWNER_CONFIRMED/);
});

test('canonical receipt resolver contains no production deal, payment, or amount patch literals', () => {
  for (const forbidden of [
    /DEAL-2026-\d+/,
    /PAYEV-2026-\d+/,
    /94125|131775|225900|35574\.47|190325\.53|527100/,
  ]) assert.doesNotMatch(source, forbidden);
});
