import { readFile, writeFile } from 'node:fs/promises';

const ADMIN='dist/portal/admin.html';
const CSS='dist/assets/portal-admin-operations-readability-v1.css';
const HREF='/assets/portal-admin-operations-readability-v1.css?v=20260831-readability-v1';
const LINK=`<link rel="stylesheet" href="${HREF}" data-rona-admin-operations-readability="v1">`;

let html=await readFile(ADMIN,'utf8');
const css=await readFile(CSS,'utf8');
for(const marker of [
  '#page-home .rona-ops-v4__commandbar>:first-child{display:none!important}',
  '#page-home .rona-ops-v4-metric__label{font-size:12px!important',
  '#page-home .rona-ops-v4-deal__id{font-size:13px!important'
]){
  if(!css.includes(marker))throw new Error('ADMIN_OPERATIONS_READABILITY_CSS_INVALID:'+marker);
}
if(!html.includes('data-rona-admin-operations-readability="v1"')){
  if(!html.includes('</head>'))throw new Error('ADMIN_HEAD_NOT_FOUND');
  html=html.replace('</head>',`  ${LINK}\n</head>`);
  await writeFile(ADMIN,html);
}
console.log('ADMIN_OPERATIONS_READABILITY=PASS');
