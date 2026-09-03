import { readFile, writeFile } from 'node:fs/promises';

const runtimePath='assets/portal-runtime/client-contract-download-v3.js';
const buildPath='scripts/build-pages-direct-canonical.mjs';

let runtime=await readFile(runtimePath,'utf8');
const oldFn=`function hideRedundantCompanyAlias(displayLeaf,card){
  if(!displayLeaf)return false;const main=document.querySelector('main,[role="main"]'),roots=[];let root=card;
  for(let depth=0;root&&root!==main&&depth<4;depth++,root=root.parentElement)roots.push(root);
  const displayRect=displayLeaf.getBoundingClientRect(),seen=new Set(),candidates=[];
  for(const scope of roots)for(const el of scope.querySelectorAll('small,span,strong,div')){
    if(seen.has(el)||el===displayLeaf||el.childElementCount!==0||!visible(el))continue;seen.add(el);
    const text=norm(el.textContent);if(!/^[A-Z][A-Z0-9&.' -]{4,}$/u.test(text)||/^RONA-C/u.test(text)||/RONA TRADE/u.test(text)||/CLIENT DIRECTORY/u.test(text))continue;
    const r=el.getBoundingClientRect(),vertical=displayRect.top-r.bottom,horizontal=Math.abs(r.left-displayRect.left);
    if(vertical>=-8&&vertical<=90&&horizontal<=220)candidates.push({el,score:vertical+horizontal/8});
  }
  candidates.sort((a,b)=>a.score-b.score);const alias=candidates[0]?.el||null;if(!alias)return false;
  alias.style.setProperty('display','none','important');alias.setAttribute('aria-hidden','true');alias.dataset.ronaRedundantCompanyAlias='hidden';return true;
}`;
const newFn=`function hideRedundantCompanyAlias(card){
  if(!card)return false;let hidden=0;
  for(const el of card.querySelectorAll('small,span,strong,p,div')){
    if(el.childElementCount!==0)continue;
    const text=norm(el.textContent);if(!text)continue;
    if(!/^[A-Z][A-Z0-9&.' -]{4,}$/u.test(text))continue;
    if(/^RONA(?:[-\\s]|$)/u.test(text)||/^CLIENT DIRECTORY$/u.test(text)||/^PDF$/u.test(text))continue;
    el.style.setProperty('display','none','important');el.setAttribute('aria-hidden','true');el.dataset.ronaRedundantCompanyAlias='hidden';hidden++;
  }
  return hidden>0;
}`;
if(!runtime.includes(oldFn))throw new Error('COMPANY_ALIAS_OLD_FUNCTION_NOT_FOUND');
runtime=runtime.replace(oldFn,newFn);
const oldCall=`  const refreshed=leafNodes(card),displayLeaf=refreshed.find(el=>norm(el.textContent)===display)||null;\n  hideRedundantCompanyAlias(displayLeaf,card);`;
const newCall=`  hideRedundantCompanyAlias(card);`;
if(!runtime.includes(oldCall))throw new Error('COMPANY_ALIAS_OLD_CALL_NOT_FOUND');
runtime=runtime.replace(oldCall,newCall)
  .replace("const MARK='20260904-client-contract-v5-company-directory-authority';","const MARK='20260904-client-contract-v6-company-alias-slot-removed';")
  .replaceAll("v5-company-directory-authority","v6-company-alias-slot-removed");
await writeFile(runtimePath,runtime,'utf8');

let build=await readFile(buildPath,'utf8');
const oldSrc='/assets/portal-runtime/client-contract-download-v3.js?v=20260904-company-directory-alias-v1';
const newSrc='/assets/portal-runtime/client-contract-download-v3.js?v=20260904-company-directory-alias-v2';
if(!build.includes(oldSrc))throw new Error('CLIENT_CONTRACT_BUILD_SRC_V1_NOT_FOUND');
build=build.replaceAll(oldSrc,newSrc);
await writeFile(buildPath,build,'utf8');

console.log('CLIENT_COMPANY_ALIAS_SLOT_V2=PASS');
