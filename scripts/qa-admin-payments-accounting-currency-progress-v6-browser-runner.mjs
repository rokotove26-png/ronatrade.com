import fs from 'node:fs';
const src='scripts/qa-admin-payments-accounting-currency-progress-v6-browser.mjs';
const tmp='scripts/.qa-admin-payments-accounting-currency-progress-v6-browser-runner.tmp.mjs';
let code=fs.readFileSync(src,'utf8');
const old="pass('GLOBAL_TOTALS_GROUPED_BY_CURRENCY',norm.includes('31002300RUB')&&norm.includes('1073150USD'));";
const next="const grouped=await page.evaluate(()=>window.__RONA_PAYMENTS_CURRENT_STATE__?.totalToReceive||[]);pass('GLOBAL_TOTALS_GROUPED_BY_CURRENCY',grouped.some(x=>x.currency==='RUB'&&Number(x.amount)===31002300)&&grouped.some(x=>x.currency==='USD'&&Number(x.amount)===1073150));";
if(!code.includes(old))throw new Error('BROWSER_ASSERTION_PATCH_TARGET_MISSING');
fs.writeFileSync(tmp,code.replace(old,next));
try{await import('../'+tmp+'?ts='+Date.now())}finally{fs.rmSync(tmp,{force:true})}
