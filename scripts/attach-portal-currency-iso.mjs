import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const runtimePath='dist/assets/portal-runtime/portal-currency-iso-v1.js';
const integrityPath='dist/canonical-visual-integrity.json';
const marker='20260830-portal-currency-iso-v1';
const id='rona-portal-currency-iso-v1';
const src='/assets/portal-runtime/portal-currency-iso-v1.js?v=20260830-iso-currency-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`PORTAL_CURRENCY_RUNTIME_MARKER_MISSING: ${marker}`);

const outputs={};
for(const name of ['admin','agent','client']){
  const path=`dist/portal/${name}.html`;
  let html=await readFile(path,'utf8');
  if(html.includes(id)||html.includes('portal-currency-iso-v1.js'))throw new Error(`PORTAL_CURRENCY_BRIDGE_ALREADY_PRESENT: ${name}`);
  const close=html.toLowerCase().lastIndexOf('</body>');
  if(close<0)throw new Error(`PORTAL_BODY_CLOSE_MISSING: ${name}`);
  const bridge=`<script id="${id}" src="${src}" defer></script>`;
  html=html.slice(0,close)+bridge+html.slice(close);
  await writeFile(path,html,'utf8');
  const bytes=Buffer.from(html,'utf8');
  outputs[name]={sha256:sha256(bytes),bytes:bytes.length};
}

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.portal_currency_display={standard:'ISO_4217',scope:['ADMIN','AGENT','CLIENT'],runtime:{id,src,marker},source_visual_payloads_modified:false};
if(integrity.client_runtime){
  integrity.client_runtime.emitted_sha256=outputs.client.sha256;
  integrity.client_runtime.emitted_bytes=outputs.client.bytes;
  integrity.client_runtime.currency_display='ISO_4217';
}
if(integrity.admin_runtime){
  integrity.admin_runtime.emitted_sha256=outputs.admin.sha256;
  integrity.admin_runtime.emitted_bytes=outputs.admin.bytes;
  integrity.admin_runtime.currency_display='ISO_4217';
}
integrity.agent_runtime_overlay={...(integrity.agent_runtime_overlay||{}),emitted_sha256:outputs.agent.sha256,emitted_bytes:outputs.agent.bytes,currency_display:'ISO_4217',source_unchanged:true};
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`PORTAL_CURRENCY_ISO=PASS admin=${outputs.admin.sha256}/${outputs.admin.bytes} agent=${outputs.agent.sha256}/${outputs.agent.bytes} client=${outputs.client.sha256}/${outputs.client.bytes}`);
