import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const asset = readFileSync('assets/g82/portal-home-inline-auth-v2.js','utf8');
const middleware = readFileSync('functions/_middleware.js','utf8');
const portalHandler = readFileSync('functions/portal/[[path]].js','utf8');

assert.ok(asset.includes("const ENDPOINT = '/portal/auth/login'"), 'public home auth must use explicit login endpoint');
assert.ok(asset.includes('async function authenticate(doc,panel)'), 'explicit credential submit flow must remain');
assert.ok(!asset.includes('resumeExisting'), 'public home must not auto-resume an Admin session');
assert.ok(!asset.includes("fetch('/portal/admin'"), 'public home must not probe protected Admin route');
assert.ok(!asset.includes("window.top.location.assign('/portal/admin')"), 'public home must not force Admin navigation');
assert.ok(!asset.includes('Сессия восстановлена. Открываем кабинет'), 'public home must not present or trigger silent session recovery');
assert.ok(middleware.includes('/assets/g82/portal-home-inline-auth-v2.js?v=20260920-security-no-auto-resume-v1'), 'middleware must cache-bust the fixed auth asset');
assert.ok(middleware.includes("x-rona-portal-entry','g8.2-home-inline-auth-v2-no-auto-resume-v1'"), 'middleware must expose fixed public auth boundary marker');
assert.ok(asset.includes("body:JSON.stringify({identifier:login,password:secret})"), 'inline auth must submit identifier JSON contract');
assert.ok(portalHandler.includes("body.email || body.identifier"), 'portal login handler must accept inline identifier');
assert.ok(portalHandler.includes("json({ok:true,redirect:target},200,tokenCookies(login.data))"), 'JSON login must return redirect contract instead of fetch-followed HTML');
assert.ok(portalHandler.includes("sessionIssued:true,redirect:recoveryTarget"), 'JSON login must expose recoverable issued-session state');

console.log('PUBLIC_HOME_AUTH_BOUNDARY=PASS');
