import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../functions/portal/api/[[path]].js',import.meta.url),'utf8');

test('specific /portal/api gateway forwards Admin impersonation to Client and Agent upstreams',()=>{
  for(const token of [
    "const IMPERSONATION_COOKIE='rona_admin_imp'",
    "const UUID_RE=",
    "const targetRoleRoute=/^\\/v1\\/(client|agent)(\\/|$)/.test(path)||path==='/v1/events'",
    "cookies[IMPERSONATION_COOKIE]",
    "request.headers.get('x-rona-impersonation-tab')",
    "IMPERSONATION_TAB_INVALID",
    "h.set('x-rona-admin-impersonation-token',impersonationToken)",
    "h.set('x-rona-impersonation-tab',impersonationTab)",
    "IMPERSONATION_SESSION_INVALID"
  ]) assert.ok(source.includes(token),`missing impersonation gateway contract: ${token}`);
});

test('impersonation token is scoped only to target Client/Agent API routes',()=>{
  const targetIndex=source.indexOf("const targetRoleRoute=/^\\/v1\\/(client|agent)(\\/|$)/.test(path)||path==='/v1/events'");
  const tokenIndex=source.indexOf("const impersonationToken=targetRoleRoute?");
  assert.ok(targetIndex>=0&&tokenIndex>targetIndex,'target-route guard must precede token extraction');
  assert.ok(source.includes("const impersonationToken=targetRoleRoute?String(cookies[IMPERSONATION_COOKIE]||'').trim():''"));
});

test('missing or malformed tab binding fails closed before upstream fetch',()=>{
  const invalidIndex=source.indexOf("if(impersonationToken&&!impersonationTab)return json({ok:false,code:'IMPERSONATION_TAB_INVALID'");
  const forwardIndex=source.indexOf('const forward=async token=>');
  assert.ok(invalidIndex>=0&&forwardIndex>invalidIndex,'tab validation must fail before upstream dispatch');
});
