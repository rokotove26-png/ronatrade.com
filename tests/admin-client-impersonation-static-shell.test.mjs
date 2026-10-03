import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal=readFileSync('functions/portal/[[path]].js','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const nativeBinding=readFileSync('scripts/apply-client-impersonation-tab-binding-v1.mjs','utf8');

assert.ok(portal.includes("headers.set('x-rona-client-impersonation-shell','static-plus-radio-runtime-and-header-bridge-v2')"),
  'impersonated Client response must expose the bounded header-bridge shell marker');
const clientBlock=portal.slice(portal.indexOf("if(kind==='client'){"),portal.indexOf("const agentPresence="));
assert.ok(clientBlock.includes(".on('head',new HeadPrepend(bridge))"),
  'impersonated Client must prepend only the bounded Admin return bridge');
assert.ok(clientBlock.includes(".on('body',new BodyAppend(RADIO_BROADCAST_RUNTIME+CLAIMS_SECTION_RETIRE_RUNTIME))"),
  'impersonated Client must append the bounded Radio and Claims-retire runtime');
for(const selector of [
  '[data-page="claims"]',
  '#page-claims',
  '[data-section="claims"]',
  'script[src*="claims"]',
  'script[id*="claims"]',
  'link[href*="claims"]'
]){
  assert.ok(clientBlock.includes(".on('"+selector+"',new RemoveCanonicalLegacyAuthNode())"),
    'impersonated Client must retire Claims selector '+selector);
}
assert.ok(clientBlock.includes("return secureResponse(withMarker,session.setCookies,true)"),
  'impersonated Client must return the bounded transformed response');
const normalClientHeadRewriteAt=clientBlock.indexOf(".on('head',new HeadAppend(CLIENT_HOME_BOOT_PRIORITY))");
const impersonatedReturnAt=clientBlock.indexOf("return secureResponse(withMarker,session.setCookies,true)");
assert.ok(normalClientHeadRewriteAt>impersonatedReturnAt,
  'normal Client head bootstrap must remain outside the impersonated Client branch');
assert.ok(pkg.scripts.build.includes('apply-client-impersonation-tab-binding-v1.mjs'),
  'native Client impersonation tab binding must remain in the canonical build');
for(const token of [
  'RONA_CLIENT_IMPERSONATION_TAB_BINDING_V1',
  "new URLSearchParams(location.search).get('impSession')",
  "headers.set('x-rona-impersonation-tab',ronaImpersonationTab)",
  "url.pathname.startsWith('/portal/api/')"
])assert.ok(nativeBinding.includes(token),'native Client impersonation binding missing '+token);

console.log('CLIENT_IMPERSONATION_STATIC_SHELL=PASS mode=BOUNDED_HEADER_RADIO_REWRITE_V2 native_tab_binding=CANONICAL_BUILD claims=retired');
