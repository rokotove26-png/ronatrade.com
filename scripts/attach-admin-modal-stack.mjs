import { readFile, writeFile } from 'node:fs/promises';

const ADMIN='dist/portal/admin.html';
const CSS='dist/assets/portal-admin-modal-stack-v1.css';
const HREF='/assets/portal-admin-modal-stack-v1.css?v=20260831-ops-readability-v2';
const LINK=`<link rel="stylesheet" href="${HREF}" data-rona-admin-modal-stack="v1">`;
const EXISTING_LINK=/<link\b[^>]*data-rona-admin-modal-stack="v1"[^>]*>/i;

let html=await readFile(ADMIN,'utf8');
const css=await readFile(CSS,'utf8');
if(!css.includes('.ca-modal-backdrop{z-index:2147483600!important}'))throw new Error('ADMIN_MODAL_STACK_CSS_INVALID');
if(!css.includes('RONA Trade Admin Operations Center readability fix'))throw new Error('ADMIN_OPERATIONS_READABILITY_CSS_MISSING');
if(!css.includes('#page-home .rona-ops-v4__commandbar>:first-child{display:none!important}'))throw new Error('ADMIN_OPERATIONS_SINGLE_TITLE_RULE_MISSING');

const before=html;
if(EXISTING_LINK.test(html)){
  html=html.replace(EXISTING_LINK,LINK);
}else{
  if(!html.includes('</head>'))throw new Error('ADMIN_HEAD_NOT_FOUND');
  html=html.replace('</head>',`  ${LINK}\n</head>`);
}
if(html!==before)await writeFile(ADMIN,html);
if(!html.includes(HREF))throw new Error('ADMIN_MODAL_STACK_CACHE_BUST_NOT_ATTACHED');
console.log('ADMIN_MODAL_STACK=PASS');
