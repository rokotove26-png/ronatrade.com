import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gateway = readFileSync('supabase/functions/rona-mcp-gateway/index.ts', 'utf8');
const finance = readFileSync('supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs', 'utf8');

test('MCP gateway keeps the canonical single Deno.serve owner', () => {
  assert.match(gateway, /const originalServe = Deno\.serve\.bind\(Deno\)/);
  assert.equal((gateway.match(/\(Deno\)\.serve = function/g) || []).length, 1);
  assert.doesNotMatch(gateway, /mutableDeno|financeServe|FINANCE_GATEWAY_UPSTREAM_HANDLER_NOT_CAPTURED/);
  assert.doesNotMatch(gateway, /await import\(UPSTREAM\)/);
  assert.match(gateway, /36727a94820e1e85e95d4abfc5d6aab8234c5c18\/supabase\/functions\/rona-mcp-gateway\/index\.js/);
});

test('Finance extension is hooked only inside the existing canonical request wrapper', () => {
  assert.match(gateway, /createFinancePaymentsV7NativeHooks/);
  assert.match(gateway, /const financeHooks = createFinancePaymentsV7NativeHooks\(\{ sql \}\)/);
  assert.match(gateway, /name === "finance_event_submit"/);
  assert.match(gateway, /financeHooks\.toolCall\(req, msg\)/);
  assert.match(gateway, /financeHooks\.toolsList\(req, res\)/);
});

test('finance_event_submit remains Finance Pilot scoped', () => {
  assert.match(finance, /name:'finance_event_submit'/);
  assert.match(finance, /ctx\.role!=='FINANCE'/);
  assert.match(finance, /ctx\.identity_id!=='AI-FINANCE'/);
  assert.match(finance, /ctx\.server_slug!=='rona-mcp-finance-pilot'/);
  assert.match(finance, /mcp:coordinate/);
});
