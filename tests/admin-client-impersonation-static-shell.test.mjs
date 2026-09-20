import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal=readFileSync('functions/portal/[[path]].js','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const runtime=readFileSync('assets/portal-runtime/client-admin-impersonation-return-v1.js','utf8');

assert.ok(portal.includes("headers.set('x-rona-client-impersonation-shell','static-unmodified-v1')"),
  'impersonated Client response must expose static-unmodified shell marker');
assert.ok(portal.includes("return secureResponse(direct,session.setCookies,true)"),
  'impersonated Client must return the direct static response');
const clientBlock=portal.slice(portal.indexOf("if(kind==='client'){"),portal.indexOf("const agentPresence="));
assert.ok(!clientBlock.includes("new HeadPrepend(bridge)"),
  'impersonated Client must not use server-side head HTMLRewriter');
assert.ok(!clientBlock.includes(".on('head'"),
  'impersonated Client must not transform the document head');
assert.ok(pkg.scripts.build.includes('attach-client-admin-impersonation-return-v1.mjs'),
  'static Admin-return runtime must be attached during Client build');
for(const token of [
  'RONA_CLIENT_ADMIN_IMPERSONATION_RETURN_V1',
  "new URLSearchParams(location.search).get('impSession')",
  '/portal/admin-authority/impersonation/end',
  "'x-rona-impersonation-tab':session"
])assert.ok(runtime.includes(token),'static Client impersonation runtime missing '+token);
assert.ok(!/RONA-C\d{3}|DEAL-2026-\d{3}/.test(runtime),'static Client impersonation runtime must be entity-generic');

console.log('CLIENT_IMPERSONATION_STATIC_SHELL=PASS mode=NO_SERVER_HTML_REWRITE return_runtime=STATIC_EXTERNAL');
