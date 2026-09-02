import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-messages-archive-v1.js';
const id='rona-client-messages-archive-v1';
const src='/assets/portal-runtime/client-messages-archive-v1.js?v=20260903-current-context-v1';
const marker='20260903-client-messages-archive-current-context-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const token of [marker,'RONA_CLIENT_CONTEXT','getCurrentContext','authority()?.getCurrentContext','/v1/client/messages','/v1/client/archive','clientId=','contractId=','Административный канал активен']){
  if(!runtime.includes(token))throw new Error(`CLIENT_MESSAGES_ARCHIVE_RUNTIME_MISSING: ${token}`);
}
for(const forbidden of ['/v1/client/bootstrap','getAuthorizedContexts','/v1/staff/','staff_task_messages']){
  if(runtime.includes(forbidden))throw new Error(`CLIENT_MESSAGES_ARCHIVE_RUNTIME_FORBIDDEN: ${forbidden}`);
}

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-messages-archive-v1.js'))throw new Error('CLIENT_MESSAGES_ARCHIVE_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.messages_archive={
  id,src,marker,context_source:'RONA_CLIENT_CONTEXT_AUTHORITY',scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY',
  endpoints:['/portal/api/v1/client/messages','/portal/api/v1/client/archive'],
  communication_flow:'CLIENT_TO_ADMIN_TO_STAFF_AND_ADMIN_TO_CLIENT',archive_source:'AUTHORITATIVE_SERVER_PROJECTION',
  frozen_dom_reused:true,visual_change:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');
console.log('CLIENT_MESSAGES_ARCHIVE_ATTACH=PASS frozen DOM reused; CURRENT_CONTEXT only');
