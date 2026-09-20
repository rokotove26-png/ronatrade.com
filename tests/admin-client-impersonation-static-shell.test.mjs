import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal=readFileSync('functions/portal/[[path]].js','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const nativeBinding=readFileSync('scripts/apply-client-impersonation-tab-binding-v1.mjs','utf8');

assert.ok(portal.includes("headers.set('x-rona-client-impersonation-shell','static-unmodified-v1')"),
  'impersonated Client response must expose static-unmodified shell marker');
assert.ok(portal.includes("return secureResponse(direct,session.setCookies,true)"),
  'impersonated Client must return the direct static response');
const clientBlock=portal.slice(portal.indexOf("if(kind==='client'){"),portal.indexOf("const agentPresence="));
assert.ok(!clientBlock.includes("new HeadPrepend(bridge)"),
  'impersonated Client must not use server-side head HTMLRewriter');
assert.ok(!clientBlock.includes(".on('head'"),
  'impersonated Client must not transform the document head');
assert.ok(pkg.scripts.build.includes('apply-client-impersonation-tab-binding-v1.mjs'),
  'native Client impersonation tab binding must remain in the canonical build');
for(const token of [
  'RONA_CLIENT_IMPERSONATION_TAB_BINDING_V1',
  "new URLSearchParams(location.search).get('impSession')",
  "headers.set('x-rona-impersonation-tab',ronaImpersonationTab)",
  "url.pathname.startsWith('/portal/api/')"
])assert.ok(nativeBinding.includes(token),'native Client impersonation binding missing '+token);

console.log('CLIENT_IMPERSONATION_STATIC_SHELL=PASS mode=NO_SERVER_HTML_REWRITE native_tab_binding=CANONICAL_BUILD');
