import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  augmentFinancePilotToolsList,
  createFinancePaymentsV7NativeHooks,
  FINANCE_PILOT_LEGACY_TOOL_NAMES,
} from '../../supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs';

const gateway = readFileSync('supabase/functions/rona-mcp-gateway/index.ts', 'utf8');
const finance = readFileSync('supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs', 'utf8');

function tool(name, marker = name) {
  return {
    name,
    title: `legacy:${marker}`,
    description: `legacy tool ${marker}`,
    inputSchema: { type: 'object', additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  };
}

function toolsResponse(tools) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 7, result: { tools } }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function mcpRequest(segment, method = 'tools/list', name = null) {
  return new Request(`https://example.supabase.co/functions/v1/rona-mcp-gateway/${segment}/mcp`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-only-token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 7, method, params: name ? { name, arguments: {} } : {} }),
  });
}

test('MCP gateway keeps the canonical single Deno.serve owner', () => {
  assert.match(gateway, /const originalServe = Deno\.serve\.bind\(Deno\)/);
  assert.equal((gateway.match(/\(Deno\)\.serve = function/g) || []).length, 1);
  assert.doesNotMatch(gateway, /mutableDeno|financeServe|FINANCE_GATEWAY_UPSTREAM_HANDLER_NOT_CAPTURED/);
  assert.doesNotMatch(gateway, /await import\(UPSTREAM\)/);
  assert.match(gateway, /36727a94820e1e85e95d4abfc5d6aab8234c5c18\/supabase\/functions\/rona-mcp-gateway\/index\.js/);
});

test('Finance Pilot tools/list is exactly the unchanged legacy eight', async () => {
  assert.equal(FINANCE_PILOT_LEGACY_TOOL_NAMES.length, 8);
  const legacy = FINANCE_PILOT_LEGACY_TOOL_NAMES.map((name, i) => tool(name, `legacy-${i}`));
  const upstream = toolsResponse([...legacy, tool('coordination_detail', 'upstream-helper'), tool('future-helper', 'future')]);

  const response = await augmentFinancePilotToolsList(mcpRequest('finance-pilot'), upstream);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-rona-finance-tools-count'), '8');

  const body = await response.json();
  const names = body.result.tools.map(t => t.name);
  assert.deepEqual(names, FINANCE_PILOT_LEGACY_TOOL_NAMES);
  assert.equal(body.result.tools.length, 8);

  for (let i = 0; i < legacy.length; i += 1) {
    assert.deepEqual(body.result.tools[i], legacy[i], `legacy tool changed: ${legacy[i].name}`);
  }
});

test('ordinary Finance and all other role routes remain untouched by Finance normalization', async () => {
  const legacy = FINANCE_PILOT_LEGACY_TOOL_NAMES.map(name => tool(name));
  const upstreamTools = [...legacy, tool('coordination_detail')];
  const routes = [
    'finance',
    'legal',
    'legal-pilot',
    'operations',
    'operations-pilot',
    'market-analyst',
    'market-analyst-pilot',
    'rail-logistics',
    'rail-logistics-pilot',
  ];

  for (const route of routes) {
    const response = await augmentFinancePilotToolsList(mcpRequest(route), toolsResponse(upstreamTools));
    const body = await response.json();
    assert.deepEqual(body.result.tools.map(t => t.name), upstreamTools.map(t => t.name), route);
    assert.equal(response.headers.get('x-rona-finance-tools-count'), null, route);
  }
});

test('Finance compatibility hook has no direct write tool implementation', async () => {
  const hooks = createFinancePaymentsV7NativeHooks({ sql: null });
  const direct = await hooks.toolCall(mcpRequest('finance-pilot', 'tools/call', 'finance_event_submit'), {
    jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'finance_event_submit', arguments: {} },
  });
  assert.equal(direct, null);
  assert.doesNotMatch(finance, /name:\s*['"]finance_event_submit['"]/);
  assert.doesNotMatch(finance, /persist_finance_event_v7/);
});

test('Finance Pilot with incomplete legacy surface fails closed without inventing tools', async () => {
  const readOnly = FINANCE_PILOT_LEGACY_TOOL_NAMES.slice(0, 3).map(name => tool(name));
  const response = await augmentFinancePilotToolsList(mcpRequest('finance-pilot'), toolsResponse(readOnly));
  const body = await response.json();
  assert.deepEqual(body.result.tools.map(t => t.name), FINANCE_PILOT_LEGACY_TOOL_NAMES.slice(0, 3));
});
