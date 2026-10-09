import {readFile} from 'node:fs/promises';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const chunks=await Promise.all(Array.from({length:10},(_,i)=>readFile('portal-src/current/client/payload.'+String(i).padStart(2,'0'),'utf8')));
const client=brotliDecompressSync(Buffer.from(chunks.join(''),'base64')).toString('utf8');
const source=await readFile('functions/portal/analytics-v2-approved-base.js','utf8');
const packed=source.match(/const GZIP_B64='([^']+)'/);
if(!packed)throw Error('APPROVED_SOURCE_GZIP_MISSING');
const admin=gunzipSync(Buffer.from(packed[1],'base64')).toString('utf8');
const scripts=[...client.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const analysis=scripts.map((v,i)=>({i,start:v.index,size:v[2].length,sha:sha(v[2]),hasView:v[2].includes('RONA_ANALYTICS_VIEW'),hasData:v[2].includes('const DATA='),hasRoot:v[2].includes('rona-analytics-v2'),hasAdminApi:v[2].includes('/portal/api/v1/admin/analytics'),pre:v[2].slice(0,170).replace(/\s+/g,' '),post:v[2].slice(-140).replace(/\s+/g,' ')}));
const focus=analysis.filter(x=>x.hasView||x.hasData||x.hasRoot);
const markers=['const DATA=','RONA_ANALYTICS_VIEW','function renderChart','function render()','function renderAnalytics','function showSeries','id="rona-analytics-v2"',"getElementById('rona-analytics-v2')",'#rona-analytics-v2','/portal/api/v1/admin/analytics'];
const around=(s,p)=>{const x=s.indexOf(p);return x<0?null:{at:x,excerpt:s.slice(Math.max(0,x-110),x+210).replace(/\s+/g,' ')}};
console.log('ADMIN_CLIENT_CANONICAL_SOURCE_AUDIT',JSON.stringify({admin:{sha:sha(admin),size:admin.length,markers:Object.fromEntries(markers.map(m=>[m,around(admin,m)])),head:admin.slice(0,500)},client:{sha:sha(client),size:client.length,markers:Object.fromEntries(markers.map(m=>[m,around(client,m)])),scripts:focus},client_screens:client.includes('id="page-analytics"'),admin_in_client:client.includes('approved-v4.3.2-pricing-bridge-single-owner')}));

const snippets=['function ensure()','function shell()','function controls(','function render()','window.RONA_ANALYTICS_VIEW=','document.readyState','data-product','data-an2-product','function chart(','function kpis(','function showSeries('];
console.log('ADMIN_CLIENT_CANONICAL_DECISION_PROBES',JSON.stringify({
 admin:Object.fromEntries(snippets.map(token=>[token,(()=>{const i=admin.indexOf(token);return i<0?null:admin.slice(Math.max(0,i-200),i+1050)})()])),
 client:{script10:focus.find(z=>z.hasView)?.pre,charts:focus.find(z=>z.hasRoot&&!z.hasView)?.pre}
}));
if(!focus.length||!admin.includes('RONA_ANALYTICS_VIEW'))throw Error('PARITY_SOURCES_ABSENT');


const styleTags=[...client.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];
const analyticsStyles=styleTags.map((v,i)=>({i,attr:v[1],length:v[2].length,
  relevant:v[2].includes('page-analytics')||v[2].includes('rona-analytics-v2')||
    v[2].includes('rona-market-chart')||v[2].includes('.an2-')||v[2].includes('.an2{'),
  snippet:v[2].slice(0,280).replace(/\s+/g,' ')})).filter(x=>x.relevant);
console.log('CLIENT_ANALYTICS_ORIGINAL_STYLE_OVERLAPS',JSON.stringify({
  total:styleTags.length,relevant:analyticsStyles
}));
