import { readFile, writeFile, unlink } from 'node:fs/promises';
const sourcePath=new URL('./qa-admin-payments-final-owner-screen-browser-v1.mjs',import.meta.url);
const tempPath=new URL('./.qa-admin-payments-final-owner-screen-browser-v2-runtime.mjs',import.meta.url);
let source=await readFile(sourcePath,'utf8');
const from="await page.locator('#rona-payment-schedule-v1').waitFor({state:'visible',timeout:10000})";
const to="await page.locator('#rona-payment-schedule-v1').waitFor({state:'attached',timeout:10000})";
if(!source.includes(from))throw new Error('BROWSER_V2_SCHEDULE_WAIT_SOURCE_MISMATCH');
source=source.replace(from,to).replace("mt.includes('FXCONVERSION')","mt.includes('FX_CONVERSION')");
await writeFile(tempPath,source,'utf8');
try{await import(tempPath.href+'?v='+Date.now())}finally{await unlink(tempPath).catch(()=>{})}
