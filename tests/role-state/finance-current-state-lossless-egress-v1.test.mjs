import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../supabase/functions/rona-mcp-gateway/index.ts', import.meta.url), 'utf8');

test('Finance current_state gets a larger raw budget without changing non-Finance budget', () => {
  assert.match(src, /DEFAULT_CURRENT_STATE_RAW_BUDGET_BYTES\s*=\s*24000/);
  assert.match(src, /FINANCE_CURRENT_STATE_RAW_BUDGET_BYTES\s*=\s*65536/);
  assert.match(src, /role === "FINANCE" \? FINANCE_CURRENT_STATE_RAW_BUDGET_BYTES : DEFAULT_CURRENT_STATE_RAW_BUDGET_BYTES/);
});

test('current_state transport compression is lossless and optional', () => {
  assert.match(src, /CompressionStream\("gzip"\)/);
  assert.match(src, /accept-encoding/);
  assert.match(src, /content-encoding", "gzip"/);
  assert.match(src, /falling back to identity/);
  assert.match(src, /Preserve the full authoritative state/);
});

test('Finance policy payload is not deleted or summarized in gateway', () => {
  assert.doesNotMatch(src, /delete\s+toolPayload\.data\.global_role_policies/);
  assert.doesNotMatch(src, /global_role_policies\s*=\s*\[\]/);
  assert.match(src, /ai_role_state_current_v2/);
  assert.match(src, /toolPayload\.data\s*=\s*rows\[0\]\.data/);
});

test('current_state remains the only wrapped read response', () => {
  assert.match(src, /if \(name === "current_state"\) res = await compactCurrentStateResponse\(res, req\)/);
});
