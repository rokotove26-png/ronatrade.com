import {readFile} from 'node:fs/promises';
import {brotliDecompressSync} from 'node:zlib';

const dir='portal-src/current/client';
const chunks=['payload.00','payload.01','payload.02','payload.03','payload.04','payload.05','payload.06','payload.07','payload.08','payload.09'];
const encoded=(await Promise.all(chunks.map(n=>readFile(dir+'/'+n,'utf8')))).join('');
const html=brotliDecompressSync(Buffer.from(encoded,'base64')).toString('utf8');
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const hits=[...html.matchAll(/<(?:button|a)\b[^>]*data-page="([^"]+)"[^>]*>[\s\S]*?<\/(?:button|a)>/gi)].map(m=>({page:m[1],html:norm(m[0]).slice(0,1200)}));
console.log('CLIENT_HTML_BYTES='+Buffer.byteLength(html));
console.log('DATA_PAGE_CONTROLS='+JSON.stringify(hits,null,2));
for(const token of ['<nav','<aside','ОПЕРАЦИИ','РЫНОК','Платежи и взаиморас','Новости топливного рынка']){
  const i=html.indexOf(token);
  if(i>=0)console.log('\nTOKEN='+token+'\n'+html.slice(Math.max(0,i-2500),Math.min(html.length,i+9000)));
}
