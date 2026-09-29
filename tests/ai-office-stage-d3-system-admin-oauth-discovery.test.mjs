import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const gateway=readFileSync(new URL('../supabase/functions/rona-mcp-gateway/index.ts',import.meta.url),'utf8');

test('Stage D.3 exposes role-scoped OAuth discovery metadata for ChatGPT MCP',()=>{
  assert.match(gateway,/oauthProtectedMetadataForSegment/);
  assert.match(gateway,/oauthAuthorizationMetadataForSegment/);
  assert.match(gateway,/registration_endpoint/);
  assert.match(gateway,/code_challenge_methods_supported:\s*\["S256"\]/);
  assert.match(gateway,/scopes_supported:\s*oauthScopesForSegment/);
  assert.match(gateway,/authorization_response_iss_parameter_supported:\s*false/);
});

test('Stage D.3 supports both role-relative and RFC-style well-known discovery paths',()=>{
  assert.match(gateway,/\$\{segment\}\/\.well-known\/oauth-protected-resource/);
  assert.match(gateway,/\$\{segment\}\/\.well-known\/oauth-authorization-server/);
  assert.match(gateway,/\.well-known\/oauth-protected-resource\/\$\{segment\}\/mcp/);
  assert.match(gateway,/\.well-known\/oauth-authorization-server\/\$\{segment\}/);
});

test('Unauthenticated MCP GET advertises OAuth instead of looking like a non-OAuth server',()=>{
  assert.match(gateway,/req\.method === "GET"/);
  assert.match(gateway,/oauthUnauthorizedResponse\(segment\)/);
  assert.match(gateway,/www-authenticate/);
  assert.match(gateway,/resource_metadata=/);
});

test('401 challenges are normalized to reachable role-relative protected-resource metadata',()=>{
  assert.match(gateway,/normalizeOauthChallenge/);
  assert.match(gateway,/publicRoleBase\(segment\)\/\.well-known\/oauth-protected-resource/);
});

test('Pilot discovery advertises coordinate and offline scopes',()=>{
  assert.match(gateway,/endsWith\("-pilot"\)[\s\S]{0,160}\["mcp:read","mcp:coordinate","offline_access"\]/);
});

test('Tool catalog declares per-tool OAuth security schemes',()=>{
  assert.match(gateway,/addOAuthSecuritySchemesToTools/);
  assert.match(gateway,/securitySchemes\s*=\s*\[\{/);
  assert.match(gateway,/readOnly \? \["mcp:read"\] : \["mcp:coordinate"\]/);
  assert.match(gateway,/addOAuthSecuritySchemesResponse/);
});


test('public Cloudflare transport exposes SYSTEM_ADMIN Pilot OAuth discovery',()=>{
  const routes=readFileSync(new URL('../_routes.json',import.meta.url),'utf8');
  const transport=readFileSync(new URL('../functions/_mcp_transport.js',import.meta.url),'utf8');
  const pilot=readFileSync(new URL('../functions/system-admin-pilot/[[path]].js',import.meta.url),'utf8');
  const build=readFileSync(new URL('../scripts/admin-payments-v7-cloudflare-build.mjs',import.meta.url),'utf8');
  assert.match(routes,/\/system-admin-pilot\/\*/);
  assert.match(transport,/system-admin-pilot/);
  assert.match(transport,/COORDINATE_SEGMENTS[\s\S]{0,300}system-admin-pilot/);
  assert.match(transport,/oauth-protected-resource[\s\S]{0,500}system-admin-pilot/);
  assert.match(transport,/oauth-authorization-server[\s\S]{0,500}system-admin-pilot/);
  assert.match(pilot,/proxyOAuthTokenIfApplicable\(context,'system-admin-pilot'\)/);
  assert.match(pilot,/proxyBoundRoleRequest\(context,'system-admin-pilot'\)/);
  assert.match(build,/MCP_OAUTH_COMPATIBILITY_OVERRIDES/);
  assert.match(build,/SYSTEM_ADMIN_PILOT_PUBLIC_OAUTH_DISCOVERY=READY/);
});
