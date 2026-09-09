import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const EXPECTED_PARENT='d1a25b07624dd86633fbdf090afa356683eeb1dd';
const RUNTIME='assets/portal-runtime/client-contract-download-v3.js';
const WORKFLOW='.github/workflows/client-owner-targeted-remediation-qa.yml';
const SELF='scripts/qa-client-section-typography-110-v1.mjs';
const TYPO_BOUNDARY="const OWNER_TYPO_MARK='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED';";
const sh=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const assert=(ok,code,detail={})=>{if(!ok)throw new Error(`${code} ${JSON.stringify(detail)}`)};

const head=sh('rev-parse','HEAD');
const headParent=sh('rev-parse','HEAD^');
assert(headParent===EXPECTED_PARENT,'EXACT_PARENT_GUARD',{expected:EXPECTED_PARENT,actual:headParent,head});
const changed=sh('diff','--name-only',EXPECTED_PARENT,head).split(/\r?\n/).filter(Boolean).sort();
const allowed=[RUNTIME,WORKFLOW,SELF].sort();
assert(JSON.stringify(changed)===JSON.stringify(allowed),'CHANGESET_ALLOWLIST',{changed,allowed});

const candidate=await readFile(RUNTIME,'utf8');
const parent=sh('show',`${EXPECTED_PARENT}:${RUNTIME}`);
const parentBoundary=parent.indexOf(TYPO_BOUNDARY),candidateBoundary=candidate.indexOf(TYPO_BOUNDARY);
assert(parentBoundary>0&&candidateBoundary===parentBoundary,'TYPOGRAPHY_BOUNDARY',{parentBoundary,candidateBoundary});
assert(candidate.slice(0,candidateBoundary)===parent.slice(0,parentBoundary),'PRODUCT_SEMANTICS_PREFIX_PARITY');
assert(candidate.includes("RONA_CLIENT_OWNER_SECTION_TYPOGRAPHY_110_V4_EXACT_PARENT"),'SECTION_TYPOGRAPHY_RUNTIME_MARKER');
assert(!changed.some(path=>/agent|xlsx|commission/i.test(path)),'AGENT_XLSX_COMMISSION_SCOPE',{changed});
assert(!changed.some(path=>/\.html?$/i.test(path)),'SCRIPT_SOURCE_URL_FREEZE',{changed});

function typographyProgram(source){
  const start=source.indexOf(TYPO_BOUNDARY),end=source.lastIndexOf('})();');
  assert(start>=0&&end>start,'TYPOGRAPHY_TAIL_EXTRACT');
  return `(()=>{'use strict';const norm=v=>String(v??'').replace(/\\s+/g,' ').trim();\n${source.slice(start,end)}\n})();`;
}
function fixture(program){
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body,nav,header,footer,.role-title,h1,p,td,span,strong{font-size:20px;line-height:1.2}
  </style></head><body>
  <nav id="sidebar">Навигация клиента</nav>
  <header id="topbar" class="topbar">Верхняя панель</header>
  <div id="role-title" class="role-title">Клиент</div>
  <section id="page-deals" data-page-panel="deals">
    <div class="page-head"><h1 id="section-heading">Сделки</h1></div>
    <p id="body-text">Текст сделки</p>
    <table><tbody><tr><td id="table-text">Строка таблицы</td></tr></tbody></table>
    <div class="card"><span id="card-text">Текст карточки</span></div>
  </section>
  <section id="page-analytics" data-page-panel="analytics">
    <span id="analytics-label" data-analytics-label>Выручка</span>
    <strong id="analytics-number" data-analytics-value>123</strong>
  </section>
  <footer id="footer-shell" data-footer-shell>Подвал</footer>
  <pre id="qa-result"></pre>
  <script>${program.replace(/<\/script/gi,'<\\/script')}</script>
  <script>window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{const ids=['body-text','table-text','card-text','analytics-label','analytics-number','section-heading','sidebar','topbar','role-title','footer-shell'];const out={};for(const id of ids)out[id]=parseFloat(getComputedStyle(document.getElementById(id)).fontSize);document.getElementById('qa-result').textContent=JSON.stringify(out)},50),{once:true});</script>
  </body></html>`;
}
async function measure(program){
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.setContent(fixture(program),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#qa-result')?.textContent?.startsWith('{'),null,{timeout:3000});
    return JSON.parse(await page.textContent('#qa-result'));
  }finally{await browser.close()}
}

const base=await measure(typographyProgram(parent));
const target=await measure(typographyProgram(candidate));
const ratio=id=>target[id]/base[id];
const eligible=['body-text','table-text','card-text'];
const excluded=['analytics-label','analytics-number','section-heading','sidebar','topbar','role-title','footer-shell'];
const eligibleProof=eligible.map(id=>({id,base:base[id],target:target[id],ratio:ratio(id)}));
const excludedProof=excluded.map(id=>({id,base:base[id],target:target[id],ratio:ratio(id)}));
assert(eligibleProof.length>=3&&eligibleProof.every(x=>x.ratio>=1.09&&x.ratio<=1.11),'ELIGIBLE_SECTION_CONTENT_EXACT_110',{eligibleProof});
assert(excludedProof.length>=3&&excludedProof.every(x=>x.ratio>=0.99&&x.ratio<=1.01),'EXCLUDED_SURFACES_UNCHANGED',{excludedProof});
assert(['analytics-label','analytics-number','section-heading','role-title'].every(id=>excluded.includes(id)),'MANDATORY_EXCLUSIONS_COVERED');

console.log('EXACT_PARENT_GUARD=PASS',JSON.stringify({parent:EXPECTED_PARENT,head}));
console.log('CLIENT_SECTION_CONTENT_TYPOGRAPHY_110=PASS',JSON.stringify(eligibleProof));
console.log('CLIENT_TYPOGRAPHY_EXCLUSIONS=PASS',JSON.stringify(excludedProof));
console.log('PRODUCT_SEMANTICS_PREFIX_PARITY=PASS');
console.log('AGENT_XLSX_COMMISSION_UNCHANGED=PASS');
console.log('SCRIPT_SOURCE_URL_FREEZE=PASS');
console.log('CLIENT_SECTION_TYPOGRAPHY_TARGETED_QA=PASS');
