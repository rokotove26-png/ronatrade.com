import { readFile, writeFile } from 'node:fs/promises';

const ADMIN='dist/portal/admin.html';
const CSS='dist/assets/portal-admin-modal-stack-v1.css';
const HREF='/assets/portal-admin-modal-stack-v1.css?v=20260830-modal-stack-v1';
const LINK=`<link rel="stylesheet" href="${HREF}" data-rona-admin-modal-stack="v1">`;

let html=await readFile(ADMIN,'utf8');
const css=await readFile(CSS,'utf8');
if(!css.includes('.ca-modal-backdrop{z-index:2147483600!important}'))throw new Error('ADMIN_MODAL_STACK_CSS_INVALID');
if(!html.includes('data-rona-admin-modal-stack="v1"')){
  if(!html.includes('</head>'))throw new Error('ADMIN_HEAD_NOT_FOUND');
  html=html.replace('</head>',`  ${LINK}\n</head>`);
  await writeFile(ADMIN,html);
}
console.log('ADMIN_MODAL_STACK=PASS');
