import { readFile, writeFile } from 'node:fs/promises';

const path='functions/portal/[[path]].js';
let s=await readFile(path,'utf8');
const v1='RONA_CANONICAL_RUNTIME_ADAPTER_V1';
const v2='RONA_CANONICAL_RUNTIME_ADAPTER_V2';
if(s.includes(v2)){
  console.log('CANONICAL_RUNTIME_ADAPTER=ALREADY_APPLIED_V2');
  process.exit(0);
}
if(!s.includes(v1)) throw new Error('Expected V1 runtime adapter missing; refusing ambiguous mutation');

// Preserve Agent geometry: keep the live bootstrap bridge, remove its injected visible logout control.
const agentStart=s.indexOf('const AGENT_BRIDGE = `');
const bodyStart=s.indexOf('\nclass BodyAppend',agentStart);
if(agentStart<0||bodyStart<0) throw new Error('Agent bridge boundary missing');
const agentBridge=`const AGENT_BRIDGE = \`<script id="rona-g82-agent-same-origin-bridge">(()=>{'use strict';async function boot(){try{const r=await fetch('/portal/api/v1/agent/bootstrap',{credentials:'same-origin',headers:{accept:'application/json'}});if(r.status===401){location.replace('/portal/login?next=%2Fportal%2Fagent');return}const j=await r.json();if(!r.ok||!j?.data){window.RONA_AGENT_PORTAL?.failClosed?.(j?.code||'Серверный доступ агента не подтверждён.');return}window.RONA_AGENT_PORTAL?.boot?.(j.data)}catch(_e){window.RONA_AGENT_PORTAL?.failClosed?.('Не удалось получить подтверждённый серверный контекст.')}}addEventListener('DOMContentLoaded',boot)})();<\\/script>\`;`;
s=s.slice(0,agentStart)+agentBridge+s.slice(bodyStart);

// Bind the already-existing canonical Admin "Выйти" button to same-origin server logout; add no visible element.
const bodyAnchor=`class BodyAppend { constructor(value) { this.value = value; } element(el) { el.append(this.value, { html: true }); } }`;
if(!s.includes(bodyAnchor)) throw new Error('BodyAppend anchor missing');
const adminBridge=`\nconst ADMIN_SESSION_BRIDGE = \`<script id="rona-admin-server-session-bridge">(()=>{'use strict';addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('adminLogoutBtn');if(b){b.hidden=false;b.addEventListener('click',async e=>{e.preventDefault();try{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin'})}finally{location.replace('/portal/login')}})}})})();<\\/script>\`;`;
s=s.replace(bodyAnchor,bodyAnchor+adminBridge);

const oldUnlock=`// ${v1}: server-authenticated technical adapter only; no canonical visual redesign.\nclass RemoveCanonicalLegacyAuthNode { element(el) { el.remove(); } }\nclass UnlockCanonicalAdminBody {\n  element(el) {\n    const classes=String(el.getAttribute('class')||'').split(/\\s+/).filter(Boolean).filter(x=>x!=='admin-auth-locked');\n    if(classes.length) el.setAttribute('class',classes.join(' ')); else el.removeAttribute('class');\n  }\n}`;
const newUnlock=`// ${v2}: server-authenticated technical adapter only; no canonical visual redesign.\nclass RemoveCanonicalLegacyAuthNode { element(el) { el.remove(); } }\nclass UnlockCanonicalAdminBody {\n  element(el) {\n    const classes=String(el.getAttribute('class')||'').split(/\\s+/).filter(Boolean).filter(x=>x!=='admin-auth-locked');\n    if(classes.length) el.setAttribute('class',classes.join(' ')); else el.removeAttribute('class');\n    el.append(ADMIN_SESSION_BRIDGE,{html:true});\n  }\n}`;
if(!s.includes(oldUnlock)) throw new Error('Admin V1 unlock anchor missing');
s=s.replace(oldUnlock,newUnlock);

await writeFile(path,s);
console.log('CANONICAL_RUNTIME_ADAPTER=APPLIED_V2');
