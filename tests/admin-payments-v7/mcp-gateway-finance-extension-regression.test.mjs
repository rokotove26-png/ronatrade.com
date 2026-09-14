import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  augmentFinancePilotToolsList,
  FINANCE_PAYMENTS_V7_TOOL,
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

function mcpRequest(segment) {
  return new Request(`https://example.supabase.co/functions/v1/rona-mcp-gateway/${segment}/mcp`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-only-token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} }),
  });
}

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

test('Finance Pilot tools/list is exactly legacy eight plus finance_event_submit', async () => {
  assert.equal(FINANCE_PILOT_LEGACY_TOOL_NAMES.length, 8);
  const legacy = FINANCE_PILOT_LEGACY_TOOL_NAMES.map((name, i) => tool(name, `legacy-${i}`));
  const upstream = toolsResponse([...legacy, tool('coordination_detail', 'upstream-helper')]);

  const response = await augmentFinancePilotToolsList(mcpRequest('finance-pilot'), upstream);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-rona-finance-tools-count'), '9');

  const body = await response.json();
  const names = body.result.tools.map(t => t.name);
  assert.deepEqual(names, [...FINANCE_PILOT_LEGACY_TOOL_NAMES, 'finance_event_submit']);
  assert.equal(body.result.tools.length, 9);
  assert.equal(names.filter(name => name === 'finance_event_submit').length, 1);
  assert.equal(names.includes('coordination_detail'), false);

  for (let i = 0; i < legacy.length; i += 1) {
    assert.deepEqual(body.result.tools[i], legacy[i], `legacy tool changed: ${legacy[i].name}`);
  }
  assert.deepEqual(body.result.tools[8], FINANCE_PAYMENTS_V7_TOOL);
});

test('finance_event_submit is not exposed on ordinary Finance or any other role route', async () => {
  const legacy = FINANCE_PILOT_LEGACY_TOOL_NAMES.map(name => tool(name));
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
    const response = await augmentFinancePilotToolsList(mcpRequest(route), toolsResponse(legacy));
    const body = await response.json();
    assert.deepEqual(body.result.tools.map(t => t.name), FINANCE_PILOT_LEGACY_TOOL_NAMES, route);
    assert.equal(body.result.tools.some(t => t.name === 'finance_event_submit'), false, route);
    assert.equal(response.headers.get('x-rona-finance-tools-count'), null, route);
  }
});

test('Finance Pilot without the complete legacy coordinated surface fails closed', async () => {
  const readOnly = FINANCE_PILOT_LEGACY_TOOL_NAMES.slice(0, 3).map(name => tool(name));
  const response = await augmentFinancePilotToolsList(mcpRequest('finance-pilot'), toolsResponse(readOnly));
  const body = await response.json();
  assert.deepEqual(body.result.tools.map(t => t.name), FINANCE_PILOT_LEGACY_TOOL_NAMES.slice(0, 3));
  assert.equal(body.result.tools.some(t => t.name === 'finance_event_submit'), false);
});

test('finance_event_submit call remains Finance Pilot scoped by OAuth context', () => {
  assert.match(finance, /name:'finance_event_submit'/);
  assert.match(finance, /ctx\.role!=='FINANCE'/);
  assert.match(finance, /ctx\.identity_id!=='AI-FINANCE'/);
  assert.match(finance, /ctx\.server_slug!=='rona-mcp-finance-pilot'/);
  assert.match(finance, /mcp:coordinate/);
  assert.match(finance, /path==='\/finance-pilot\/mcp'/);
  assert.match(finance, /rona-mcp-gateway\/finance-pilot\/mcp/);
});
