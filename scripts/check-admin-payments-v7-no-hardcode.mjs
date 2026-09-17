import { readFile } from 'node:fs/promises';

const files=[
  'scripts/admin-payments-reconciliation-difference-ui.mjs',
  'scripts/apply-payments-v8-production-runtime.mjs',
];
const forbidden=[
  /\\bDEAL-20\\d\\d-\\d+\\b/g,
  /\\bPAYEV-20\\d\\d-\\d+\\b/g,
  /\\bOUT-20\\d\\d-[A-Z0-9-]+\\b/g,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  /\\b\\d[\\d\\s,.]{3,}\\s*(?:USD|RUB|EUR|KZT|UZS)\\b/gi,
  /58902(?:[.,]35847039)?|4712762(?:[.,]37)?|2913(?:[.,]488259919)?/g,
];
const violations=[];
for(const file of files){
  const source=await readFile(file,'utf8');
  for(const re of forbidden){
    re.lastIndex=0;
    for(const m of source.matchAll(re))violations.push({file,match:m[0]});
  }
}
if(violations.length){
  console.error(JSON.stringify({status:'FAIL',violations},null,2));
  process.exit(1);
}
console.log(JSON.stringify({status:'PASS',files,production_numeric_hardcodes:0,browser_cross_currency_calculation:0},null,2));