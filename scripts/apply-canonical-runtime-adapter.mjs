import { readFile, writeFile } from 'node:fs/promises';

const path='functions/portal/[[path]].js';
let s=await readFile(path,'utf8');
const v1='RONA_CANONICAL_RUNTIME_ADAPTER_V1';
const v2='RONA_CANONICAL_RUNTIME_ADAPTER_V2';
if(s.includes(v2)){
  console.log('CANONICAL_RUNTIME_ADAPTER=ALREADY_APPLIED_V2');
  process.exit(0);
}

// First installation: server role/session is authoritative; Client is fail-closed before static source delivery.
if(!s.includes(v1)){
  const anchor=`class BodyAppend { constructor(value) { this.value = value; } element(el) { el.append(this.value, { html: true }); } }`;
  if(!s.includes(anchor)) throw new Error('BodyAppend anchor missing; refusing ambiguous middleware mutation');
  const helpers=`\n// ${v1}: server-authenticated technical adapter only; no canonical visual redesign.\nclass RemoveCanonicalLegacyAuthNode { element(el) { el.remove(); } }\nclass UnlockCanonicalAdminBody {\n  element(el) {\n    const classes=String(el.getAttribute('class')||'').split(/\\s+/).filter(Boolean).filter(x=>x!=='admin-auth-locked');\n    if(classes.length) el.setAttribute('class',classes.join(' ')); else el.removeAttribute('class');\n  }\n}\nasync function requireRealClientContext(session) {\n  try {\n    const r=await upstream(session.access,'/v1/client/bootstrap');\n    const j=await r.json().catch(()=>null);\n    const contexts=Array.isArray(j?.data?.contexts)?j.data.contexts:[];\n    return { ok:r.ok && j?.ok===true && contexts.length>0, contexts };\n  } catch (_) { return { ok:false, contexts:[] }; }\n}\n`;
  s=s.replace(anchor,anchor+helpers);
  const old=`async function serveStaticProtected(context, session, kind) {\n  const roles = rolesOf(session.me);\n  const expected = kind === 'admin' ? '/portal/admin' : kind === 'agent' ? '/portal/agent' : '/portal/client';\n  if (!roleAllows(expected, roles)) return html(deniedPage('ROLE_MISMATCH'), 403, session.setCookies);\n  const response = await context.next();\n  if (!response.ok) return secureResponse(response, session.setCookies, false);\n  const contentType = response.headers.get('content-type') || '';\n  if (!contentType.toLowerCase().includes('text/html')) return secureResponse(response, session.setCookies, false);\n  if (kind === 'client' || kind === 'admin') return secureResponse(response, session.setCookies, true);\n  const transformed = new HTMLRewriter().on('body', new BodyAppend(AGENT_BRIDGE)).transform(response);\n  return secureResponse(transformed, session.setCookies, true);\n}`;
  const neu=`async function serveStaticProtected(context, session, kind) {\n  const roles = rolesOf(session.me);\n  const expected = kind === 'admin' ? '/portal/admin' : kind === 'agent' ? '/portal/agent' : '/portal/client';\n  if (!roleAllows(expected, roles)) return html(deniedPage('ROLE_MISMATCH'), 403, session.setCookies);\n\n  // CLIENT is fail-closed before any canonical standalone snapshot can be served.\n  if (kind === 'client') {\n    const gate = await requireRealClientContext(session);\n    if (!gate.ok) return html(deniedPage('CLIENT_CONTEXT_NOT_AUTHORIZED'), 403, session.setCookies);\n  }\n\n  const response = await context.next();\n  if (!response.ok) return secureResponse(response, session.setCookies, false);\n  const contentType = response.headers.get('content-type') || '';\n  if (!contentType.toLowerCase().includes('text/html')) return secureResponse(response, session.setCookies, false);\n\n  if (kind === 'admin') {\n    const transformed = new HTMLRewriter()\n      .on('body', new UnlockCanonicalAdminBody())\n      .on('#adminLoginGate', new RemoveCanonicalLegacyAuthNode())\n      .on('#rona-admin-auth-v3413', new RemoveCanonicalLegacyAuthNode())\n      .transform(response);\n    return secureResponse(transformed, session.setCookies, true);\n  }\n  if (kind === 'client') return secureResponse(response, session.setCookies, true);\n\n  const transformed = new HTMLRewriter().on('body', new BodyAppend(AGENT_BRIDGE)).transform(response);\n  return secureResponse(transformed, session.setCookies, true);\n}`;
  if(!s.includes(old)) throw new Error('serveStaticProtected exact anchor missing; refusing ambiguous middleware mutation');
  s=s.replace(old,neu);
}

// V2: keep Agent pixel geometry frozen (no injected visible logout button) and bind Admin's existing canonical logout button to server logout.
const agentRe=/const AGENT_BRIDGE = `<script id="rona-g82-agent-same-origin-bridge">[\\s\\S]*?<\\/script>`;\nclass BodyAppend/;
const agentReplacement=`const AGENT_BRIDGE = \`<script id="rona-g82-agent-same-origin-bridge">(()=>{'use strict';async function boot(){try{const r=await fetch('/portal/api/v1/agent/bootstrap',{credentials:'same-origin',headers:{accept:'application/json'}});if(r.status===401){location.replace('/portal/login?next=%2Fportal%2Fagent');return}const j=await r.json();if(!r.ok||!j?.data){window.RONA_AGENT_PORTAL?.failClosed?.(j?.code||'Серверный доступ агента не подтверждён.');return}window.RONA_AGENT_PORTAL?.boot?.(j.data)}catch(_e){window.RONA_AGENT_PORTAL?.failClosed?.('Не удалось получить подтверждённый серверный контекст.')}}addEventListener('DOMContentLoaded',boot)})();<\\/script>\`;\nclass BodyAppend`;
if(!agentRe.test(s)) throw new Error('Agent bridge anchor missing; refusing ambiguous visual mutation');
s=s.replace(agentRe,agentReplacement);

const bodyAnchor=`class BodyAppend { constructor(value) { this.value = value; } element(el) { el.append(this.value, { html: true }); } }`;
if(!s.includes('const ADMIN_SESSION_BRIDGE =')){
  const adminBridge=`\nconst ADMIN_SESSION_BRIDGE = \`<script id="rona-admin-server-session-bridge">(()=>{'use strict';addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('adminLogoutBtn');if(b){b.hidden=false;b.addEventListener('click',async e=>{e.preventDefault();try{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin'})}finally{location.replace('/portal/login')}})}})})();<\\/script>\`;`;
  if(!s.includes(bodyAnchor)) throw new Error('BodyAppend anchor missing for Admin bridge');
  s=s.replace(bodyAnchor,bodyAnchor+adminBridge);
}

const oldUnlock=`// ${v1}: server-authenticated technical adapter only; no canonical visual redesign.\nclass RemoveCanonicalLegacyAuthNode { element(el) { el.remove(); } }\nclass UnlockCanonicalAdminBody {\n  element(el) {\n    const classes=String(el.getAttribute('class')||'').split(/\\s+/).filter(Boolean).filter(x=>x!=='admin-auth-locked');\n    if(classes.length) el.setAttribute('class',classes.join(' ')); else el.removeAttribute('class');\n  }\n}`;
const newUnlock=`// ${v2}: server-authenticated technical adapter only; no canonical visual redesign.\nclass RemoveCanonicalLegacyAuthNode { element(el) { el.remove(); } }\nclass UnlockCanonicalAdminBody {\n  element(el) {\n    const classes=String(el.getAttribute('class')||'').split(/\\s+/).filter(Boolean).filter(x=>x!=='admin-auth-locked');\n    if(classes.length) el.setAttribute('class',classes.join(' ')); else el.removeAttribute('class');\n    el.append(ADMIN_SESSION_BRIDGE,{html:true});\n  }\n}`;
if(!s.includes(oldUnlock)) throw new Error('Admin unlock v1 anchor missing');
s=s.replace(oldUnlock,newUnlock);

await writeFile(path,s);
console.log('CANONICAL_RUNTIME_ADAPTER=APPLIED_V2');
