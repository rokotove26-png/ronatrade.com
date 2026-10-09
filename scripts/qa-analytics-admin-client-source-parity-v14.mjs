import {readFile} from 'node:fs/promises';
import {gunzipSync,brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const h=t=>createHash('sha256').update(t).digest('hex').slice(0,18);
const adminCompressed=await readFile('functions/portal/analytics-v2-approved-base.js','utf8');
const gzip=adminCompressed.match(/const GZIP_B64='([^']+)'/);
if(!gzip)throw new Error('ADMIN_APPROVED_VISUAL_BYTES_MISSING');
const admin=gunzipSync(Buffer.from(gzip[1],'base64')).toString('utf8');
const chunks=await Promise.all(Array.from({length:10},(_,i)=>readFile('portal-src/current/client/payload.'+String(i).padStart(2,'0'),'utf8')));
const html=brotliDecompressSync(Buffer.from(chunks.join(''),'base64')).toString('utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(z=>z[1]);
const index=scripts.findIndex(s=>s.includes('__RONA_ANALYTICS_APPROVED_SINGLE_OWNER__'));
const client=index>=0?scripts[index]:'';
const owners=[...html.matchAll(/id=["']rona-analytics-v2["']/g)].length;
const report={
  source:'ADMIN_APPROVED_V432_ONLY',adminBytes:admin.length,adminHash:h(admin),
  clientEmbeddedApprovedScriptFound:index>=0,clientApprovedBytes:client.length,clientApprovedHash:h(client),
  sameOriginalEngine:client.includes("const OWNER='20260827-approved-v431-single-owner'")&&admin.includes("const OWNER='20260827-approved-v431-single-owner'"),
  sameApprovedSource:client.includes("const DATA=")&&admin.includes("const DATA="),
  clientOwnerCount:owners,
  clientVisualSelectors:['.an2-kpis','.an2-controls','.an2-market-forecast','.an2-rona','.an2-comment'].map(x=>({selector:x,client:html.includes(x),admin:admin.includes(x)})),
  adminMarkers:['__RONA_ANALYTICS_APPROVED_SINGLE_OWNER__','RONA_ANALYTICS_VIEW','[data-chart-stage]'].map(x=>({name:x,found:admin.includes(x)}))
};
console.log('ANALYTICS_ADMIN_CLIENT_ORIGINAL_SOURCE_CONTRACT='+JSON.stringify(report));
if(!client||owners!==1||!report.sameOriginalEngine||!report.sameApprovedSource)process.exitCode=1;
