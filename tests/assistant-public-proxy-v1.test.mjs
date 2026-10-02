import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source=readFileSync('functions/assistant/[[path]].js','utf8');
const transport=readFileSync('functions/_mcp_transport.js','utf8');
const consent=readFileSync('functions/_mcp_consent_bridge.js','utf8');
const token=readFileSync('functions/_mcp_oauth_token_bridge.js','utf8');
const prepare=readFileSync('functions/assistant/authorize/prepare.js','utf8');
const complete=readFileSync('functions/assistant/authorize/complete.js','utf8');
const routes=JSON.parse(readFileSync('_routes.json','utf8'));

test('Assistant public route uses the canonical shared RONA role entry',()=>{
  assert.match(source,/proxyBoundRoleRequest/);
  assert.match(source,/proxyOAuthTokenIfApplicable/);
  assert.match(source,/'assistant'/);
  assert.doesNotMatch(source,/rona-mcp-gateway\/assistant/);
});

test('Assistant bespoke exact authorize handler is retired',()=>{
  assert.equal(existsSync('functions/assistant/authorize.js'),false);
});

test('Assistant public consent continuation routes are materialized',()=>{
  assert.match(prepare,/prepareConsent/);
  assert.match(prepare,/'assistant'/);
  assert.match(complete,/completeConsent/);
  assert.match(complete,/'assistant'/);
});

test('Assistant is enabled in shared public transport and OAuth bridges',()=>{
  assert.match(transport,/SEGMENTS=new Set\([^\n]*'assistant'/);
  assert.match(transport,/COORDINATE_SEGMENTS=new Set\([^\n]*'system-admin'[^\n]*'assistant'/);
  assert.match(consent,/SEGMENTS=new Set\([^\n]*'assistant'/);
  assert.match(token,/SEGMENTS=new Set\([^\n]*'assistant'/);
});

test('Assistant public transport supports GET-only MCP-relative discovery',()=>{
  assert.match(transport,/relativeProtectedDiscovery/);
  assert.match(transport,/relativeAuthorizationDiscovery/);
  assert.match(transport,/path==='\/mcp\/\.well-known\/oauth-protected-resource'/);
  assert.match(transport,/path==='\/mcp\/\.well-known\/oauth-authorization-server'/);
  assert.match(transport,/request\.method!=='GET'/);
  assert.match(transport,/allow:'GET, OPTIONS'/);
});

test('Assistant public authorize page is rewritten to the canonical RONA action',()=>{
  assert.match(transport,/rewriteConsentHtml/);
  assert.match(transport,/canonicalAction=\`\$\{externalBase\(segment\)\}\/authorize\`/);
  assert.match(transport,/form-action 'self'/);
  assert.match(source,/proxyBoundRoleRequest/);
});

test('Assistant routes include both bare and descendant public paths',()=>{
  assert.ok(routes.include.includes('/assistant'));
  assert.ok(routes.include.includes('/assistant/*'));
  assert.ok(!routes.exclude.includes('/assistant'));
  assert.ok(!routes.exclude.includes('/assistant/*'));
});
