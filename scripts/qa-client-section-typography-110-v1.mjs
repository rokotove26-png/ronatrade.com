import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const TYPOGRAPHY_FINALIZATION_BASE='0d3f4363e124647d9f3b72d377eb24240c5a4574';
const EXPECTED_CORRECTION_PARENT='15ddfae3b5de2ff98b7ff40c25047bbdb2e7ba6a';
const TYPOGRAPHY_VISUAL_BASE='d1a25b07624dd86633fbdf090afa356683eeb1dd';
const RUNTIME='assets/portal-runtime/client-contract-download-v3.js';
const FREEZE='scripts/qa-client-portal-visual-freeze.mjs';
const GOVERNANCE='governance/client-section-typography-110-owner-approval-20260909.json';
const SELF='scripts/qa-client-section-typography-110-v1.mjs';
const FRAME_MARKER='scripts/qa-client-typography-frame-overflow-freeze-v1.mjs';
const FINALIZATION_CHANGED=[GOVERNANCE,FREEZE,SELF,FRAME_MARKER].sort();
const CORRECTIVE_CHANGED=[GOVERNANCE,FREEZE,SELF].sort();
const WIDTHS=[1920,1366];
const GEOMETRY_TOLERANCE=1;
const TYPO_BOUNDARY="const OWNER_TYPO_MARK='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED';";
const SECTION_MARK='RONA_CLIENT_OWNER_SECTION_TYPOGRAPHY_110_V4_EXACT_PARENT';
const sh=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const assert=(ok,code,detail={})=>{if(!ok)throw new Error(`${code} ${JSON.stringify(detail)}`)};
const near=(value,target,tolerance)=>Number.isFinite(value)&&Math.abs(value-target)<=tolerance;

const head=sh('rev-parse','HEAD');
const headParent=sh('rev-parse','HEAD^');
assert(headParent===EXPECTED_CORRECTION_PARENT,'EXACT_CORRECTION_PARENT_GUARD',{expected:EXPECTED_CORRECTION_PARENT,actual:headParent,head});
const correctiveChanged=sh('diff','--name-only',EXPECTED_CORRECTION_PARENT,head).split(/\r?\n/).filter(Boolean).sort();
assert(JSON.stringify(correctiveChanged)===JSON.stringify(CORRECTIVE_CHANGED),'CORRECTIVE_CHANGESET_ALLOWLIST',{correctiveChanged,allowed:CORRECTIVE_CHANGED});
const changed=sh('diff','--name-only',TYPOGRAPHY_FINALIZATION_BASE,head).split(/\r?\n/).filter(Boolean).sort();
assert(JSON.stringify(changed)===JSON.stringify(FINALIZATION_CHANGED),'FINALIZATION_EXACT_FOUR_FILE_SET',{changed,expected:FINALIZATION_CHANGED});
assert(!correctiveChanged.some(path=>path===RUNTIME||path.startsWith('assets/portal-runtime/')),'PRODUCT_RUNTIME_CORRECTIVE_DELTA',{correctiveChanged});
assert(!correctiveChanged.some(path=>/agent|xlsx|commission/i.test(path)),'AGENT_XLSX_COMMISSION_SCOPE',{correctiveChanged});
assert(!correctiveChanged.some(path=>/backend|supabase|rail|application|company|context|contract/i.test(path)&&!CORRECTIVE_CHANGED.includes(path)),'BUSINESS_RUNTIME_SCOPE',{correctiveChanged});

const candidate=await readFile(RUNTIME,'utf8');
const finalizationBaseRuntime=sh('show',`${TYPOGRAPHY_FINALIZATION_BASE}:${RUNTIME}`);
const correctionParentRuntime=sh('show',`${EXPECTED_CORRECTION_PARENT}:${RUNTIME}`);
const visualBase=sh('show',`${TYPOGRAPHY_VISUAL_BASE}:${RUNTIME}`);
assert(candidate===finalizationBaseRuntime,'RUNTIME_FINALIZATION_MUST_BE_BYTE_IDENTICAL_TO_BASE');
assert(candidate===correctionParentRuntime,'RUNTIME_CORRECTION_MUST_BE_BYTE_IDENTICAL_TO_PARENT');
assert(candidate.includes(SECTION_MARK),'SECTION_TYPOGRAPHY_RUNTIME_MARKER');
assert(!visualBase.includes(SECTION_MARK),'TYPOGRAPHY_VISUAL_BASE_MUST_PRECEDE_SECTION_LAYER');

const approval=JSON.parse(await readFile(GOVERNANCE,'utf8'));
assert(approval?.system_admin_comment_id===5602689478,'GOVERNANCE_TYPOGRAPHY_APPROVAL_COMMENT_ID');
assert(approval?.correction_system_admin_comment_id===5603758040,'GOVERNANCE_CORRECTION_COMMENT_ID');
assert(approval?.parent_sha===TYPOGRAPHY_FINALIZATION_BASE,'GOVERNANCE_HISTORICAL_BASE_PARENT_SHA');
assert(approval?.typography_finalization_base_sha===TYPOGRAPHY_FINALIZATION_BASE,'GOVERNANCE_FINALIZATION_BASE_SHA');
assert(approval?.correction_parent_sha===EXPECTED_CORRECTION_PARENT,'GOVERNANCE_CORRECTION_PARENT_SHA');
assert(JSON.stringify(approval?.exact_factual_chain_to_correction_parent)===JSON.stringify([TYPOGRAPHY_FINALIZATION_BASE,'ec718aac7efebf03a6d94637d3aa68d5dec276a3',EXPECTED_CORRECTION_PARENT]),'GOVERNANCE_FACTUAL_CHAIN');
assert(approval?.typography_visual_base_sha===TYPOGRAPHY_VISUAL_BASE,'GOVERNANCE_VISUAL_BASE_SHA');
assert(JSON.stringify([...(approval?.finalization_changed_files||[])].sort())===JSON.stringify(FINALIZATION_CHANGED),'GOVERNANCE_FINALIZATION_FILES');
assert(JSON.stringify([...(approval?.corrective_changed_files||[])].sort())===JSON.stringify(CORRECTIVE_CHANGED),'GOVERNANCE_CORRECTIVE_FILES');
assert(approval?.approved_qa_workflow_wiring?.path==='.github/workflows/client-owner-targeted-remediation-qa.yml','GOVERNANCE_QA_WIRING_PATH');
assert(approval?.approved_qa_workflow_wiring?.system_admin_comment_id===5602689478,'GOVERNANCE_QA_WIRING_APPROVAL_COMMENT');
assert(approval?.approved_qa_workflow_wiring?.authorized_blob_sha==='ae36d39a9081cf0da929c2340312d3098726be35','GOVERNANCE_QA_WIRING_BLOB');
assert(approval?.approved_qa_workflow_wiring?.historical_pr431_direct_fix_blob_sha==='7b9e1697daca02647c53b643b5d41e193fc02e26','GOVERNANCE_HISTORICAL_DIRECT_FIX_BLOB');
assert(approval?.approved_qa_workflow_wiring?.required_marker==='node scripts/qa-client-section-typography-110-v1.mjs','GOVERNANCE_QA_WIRING_MARKER');
assert(approval?.approved_qa_workflow_wiring?.scope==='TYPOGRAPHY_FINALIZATION_QA_WIRING_EXACT_ONLY','GOVERNANCE_QA_WIRING_SCOPE');
assert(approval?.approved_qa_workflow_wiring?.wildcard_exception===false,'GOVERNANCE_QA_WIRING_NO_WILDCARD');
assert(approval?.requirements?.exact_correction_parent_control===true,'GOVERNANCE_EXACT_CORRECTION_PARENT_CONTROL');
assert(approval?.requirements?.runtime_changed_in_finalization===false,'GOVERNANCE_RUNTIME_NO_CHANGE');
assert(JSON.stringify(approval?.requirements?.desktop_widths_proven)===JSON.stringify(WIDTHS),'GOVERNANCE_WIDTHS');

function typographyProgram(source){
  const start=source.indexOf(TYPO_BOUNDARY),end=source.lastIndexOf('})();');
  assert(start>=0&&end>start,'TYPOGRAPHY_TAIL_EXTRACT');
  return `(()=>{'use strict';const norm=v=>String(v??'').replace(/\\s+/g,' ').trim();\n${source.slice(start,end)}\n})();`;
}

function fixture(program){
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;font-family:Arial,sans-serif}body,nav,header,footer,.role-title,h1,p,td,span,strong,button{font-size:20px;line-height:1.2}
  body{display:grid;grid-template-columns:260px minmax(0,1fr);grid-template-rows:72px auto 54px;min-height:900px}
  #sidebar{grid-column:1;grid-row:1/4;width:260px;padding:20px;border-right:1px solid #777}
  #topbar{grid-column:2;grid-row:1;height:72px;padding:20px;border-bottom:1px solid #777}
  #role-title{position:absolute;right:28px;top:20px;width:130px;height:32px}
  main{grid-column:2;grid-row:2;padding:24px;min-width:0}
  #footer-shell{grid-column:2;grid-row:3;height:54px;padding:14px 24px;border-top:1px solid #777}
  #page-deals,#page-analytics{width:100%;min-width:0}
  .page-head{height:58px}.page-head h1{margin:0}
  .qa-panel{width:min(100%,1100px);height:520px;border:1px solid #666;padding:20px;overflow:visible}
  .qa-card{width:440px;height:128px;border:1px solid #666;padding:14px;margin-bottom:16px;overflow:visible}
  .qa-card p{display:block;width:100%;margin:0 0 10px}.qa-card span{display:block;width:100%}
  .qa-table-frame{width:540px;height:76px;border:1px solid #666;padding:8px;margin-bottom:16px;overflow:visible}.qa-table-frame table{width:100%;table-layout:fixed;border-collapse:collapse}.qa-table-frame td{width:100%;padding:6px;overflow:visible}
  .qa-label-frame{width:360px;height:72px;border:1px solid #666;padding:8px;margin-bottom:16px;overflow:visible}.qa-label-frame span{display:block;width:100%;white-space:normal}
  .qa-controls{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;width:100%}
  .qa-action{appearance:none;width:300px;height:76px;border:1px solid #666;padding:8px 12px;white-space:normal;overflow:visible;text-overflow:clip}
  #wrap-action{width:260px;height:76px;white-space:normal;overflow-wrap:normal;word-break:normal}
  button[data-rona-contract-download-v3]{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;width:220px!important;height:56px!important;min-height:0!important;padding:6px 11px!important;border:1px solid #666!important;border-radius:999px!important;font-family:inherit!important;font-size:10.5px!important;line-height:1.15!important;font-weight:820!important;letter-spacing:.02em!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}
  #page-analytics{margin-top:20px}.analytics-frame{width:620px;height:104px;border:1px solid #666;padding:14px;display:flex;gap:30px;align-items:center}
  </style></head><body>
  <nav id="sidebar">Навигация клиента</nav>
  <header id="topbar" class="topbar">Верхняя панель клиента</header>
  <div id="role-title" class="role-title">Клиент</div>
  <main>
    <section id="page-deals" data-page-panel="deals">
      <div class="page-head"><h1 id="section-heading">Сделки</h1></div>
      <div id="panel-frame" class="qa-panel" data-qa-frame>
        <div id="card-frame" class="qa-card" data-qa-frame>
          <p id="body-text">Текущая сделка находится в исполнении</p>
          <span id="card-text">Авторитетный статус и коммерческие условия</span>
        </div>
        <div id="table-frame" class="qa-table-frame" data-qa-frame><table><tbody><tr><td id="table-text">Поставка по действующему контракту без изменения рамки</td></tr></tbody></table></div>
        <div id="label-frame" class="qa-label-frame" data-qa-frame><span id="long-label">Длинная подпись текущего этапа исполнения договорных обязательств</span></div>
        <div class="qa-controls">
          <button id="long-action" class="qa-action" data-qa-frame>Открыть паспорт текущей сделки и статус исполнения</button>
          <button id="wrap-action" class="qa-action" data-qa-frame>Подтверждение условий поставки и оплаты</button>
          <button id="contract-action" data-rona-contract-download-v3 data-qa-frame>Скачать договор PDF</button>
        </div>
      </div>
    </section>
    <section id="page-analytics" data-page-panel="analytics">
      <div id="analytics-frame" class="analytics-frame" data-qa-frame><span id="analytics-label">Выручка</span><strong id="analytics-number">123 456</strong></div>
    </section>
  </main>
  <footer id="footer-shell" data-footer-shell>Подвал кабинета</footer>
  <script>${program.replace(/<\/script/gi,'<\\/script')}</script>
  </body></html>`;
}

const ELIGIBLE=['body-text','table-text','card-text','long-label','long-action','wrap-action','contract-action'];
const EXCLUDED=['section-heading','analytics-label','analytics-number','sidebar','topbar','role-title','footer-shell'];
const FRAMES=['panel-frame','card-frame','table-frame','label-frame','long-action','wrap-action','contract-action','analytics-frame'];
const ANALYTICS=['analytics-frame','analytics-label','analytics-number'];
const SHELL=['sidebar','topbar','role-title','footer-shell'];

async function measure(browser,program,width){
  const page=await browser.newPage({viewport:{width,height:900}});
  try{
    await page.setContent(fixture(program),{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(120);
    return await page.evaluate(({eligible,excluded,frames,analytics,shell})=>{
      const ids=[...new Set([...eligible,...excluded,...frames])];
      const rect=el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      const textBounds=el=>{
        const nodes=[...el.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&String(node.textContent||'').trim());
        if(!nodes.length)return{rect:null,lines:0};
        const range=document.createRange();range.selectNodeContents(el);const rs=[...range.getClientRects()];if(!rs.length)return{rect:null,lines:0};
        const out={left:Math.min(...rs.map(r=>r.left)),top:Math.min(...rs.map(r=>r.top)),right:Math.max(...rs.map(r=>r.right)),bottom:Math.max(...rs.map(r=>r.bottom))};
        return{rect:{...out,width:out.right-out.left,height:out.bottom-out.top},lines:rs.length};
      };
      const out={};
      for(const id of ids){
        const el=document.getElementById(id);if(!el){out[id]={missing:true};continue}
        const s=getComputedStyle(el),owner=el.closest('[data-qa-frame]')||el,t=textBounds(el);
        out[id]={font:parseFloat(s.fontSize),rect:rect(el),owner:rect(owner),clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,whiteSpace:s.whiteSpace,textOverflow:s.textOverflow,overflowX:s.overflowX,overflowY:s.overflowY,textRect:t.rect,lines:t.lines,sectionMark:el.hasAttribute('data-rona-owner-section-typo-scaled-v4')};
      }
      return{items:out,analyticsMarks:[...document.querySelectorAll('#page-analytics [data-rona-owner-section-typo-scaled-v4]')].length,shellMarks:shell.reduce((n,id)=>n+(document.getElementById(id)?.hasAttribute('data-rona-owner-section-typo-scaled-v4')?1:0),0),bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,viewport:innerWidth,analytics,eligible,excluded,frames};
    },{eligible:ELIGIBLE,excluded:EXCLUDED,frames:FRAMES,analytics:ANALYTICS,shell:SHELL});
  }finally{await page.close()}
}

const browser=await chromium.launch({headless:true});
const proofs=[];
try{
  for(const width of WIDTHS){
    const base=await measure(browser,typographyProgram(visualBase),width);
    const target=await measure(browser,typographyProgram(candidate),width);
    assert(base.viewport===width&&target.viewport===width,'VIEWPORT_PROOF',{width,base:base.viewport,target:target.viewport});
    const typography=ELIGIBLE.map(id=>({id,base:base.items[id]?.font,target:target.items[id]?.font,ratio:target.items[id]?.font/base.items[id]?.font}));
    assert(typography.every(x=>Number.isFinite(x.ratio)&&x.ratio>=1.09&&x.ratio<=1.11),'TYPOGRAPHY_110_CONTENT',{width,typography});
    const titleRatio=target.items['section-heading'].font/base.items['section-heading'].font;
    assert(near(titleRatio,1,0.01),'SECTION_TITLES_UNCHANGED',{width,titleRatio});
    const analyticsProof=ANALYTICS.map(id=>({id,fontRatio:target.items[id].font/base.items[id].font,widthDelta:target.items[id].rect.width-base.items[id].rect.width,heightDelta:target.items[id].rect.height-base.items[id].rect.height}));
    assert(target.analyticsMarks===0&&analyticsProof.every(x=>near(x.fontRatio,1,0.01)&&Math.abs(x.widthDelta)<=GEOMETRY_TOLERANCE&&Math.abs(x.heightDelta)<=GEOMETRY_TOLERANCE),'ANALYTICS_UNCHANGED',{width,analyticsProof,marks:target.analyticsMarks});
    const shellProof=SHELL.map(id=>({id,fontRatio:target.items[id].font/base.items[id].font,widthDelta:target.items[id].rect.width-base.items[id].rect.width,heightDelta:target.items[id].rect.height-base.items[id].rect.height}));
    assert(target.shellMarks===0&&shellProof.every(x=>near(x.fontRatio,1,0.01)&&Math.abs(x.widthDelta)<=GEOMETRY_TOLERANCE&&Math.abs(x.heightDelta)<=GEOMETRY_TOLERANCE),'SHELL_UNCHANGED',{width,shellProof,marks:target.shellMarks});
    const geometry=FRAMES.map(id=>({id,base:base.items[id].rect,target:target.items[id].rect,widthDelta:target.items[id].rect.width-base.items[id].rect.width,heightDelta:target.items[id].rect.height-base.items[id].rect.height}));
    assert(geometry.every(x=>x.widthDelta<=GEOMETRY_TOLERANCE&&x.heightDelta<=GEOMETRY_TOLERANCE&&Math.abs(x.widthDelta)<=GEOMETRY_TOLERANCE&&Math.abs(x.heightDelta)<=GEOMETRY_TOLERANCE),'FRAME_GEOMETRY_UNCHANGED',{width,geometry});
    const overflow=ELIGIBLE.map(id=>{const x=target.items[id],tr=x.textRect,or=x.owner;const leaves=tr?tr.left<or.left-GEOMETRY_TOLERANCE||tr.right>or.right+GEOMETRY_TOLERANCE||tr.top<or.top-GEOMETRY_TOLERANCE||tr.bottom>or.bottom+GEOMETRY_TOLERANCE:false;const horizontal=x.scrollWidth-x.clientWidth;const vertical=x.scrollHeight-x.clientHeight;const clipped=(x.textOverflow==='ellipsis')||((x.overflowX==='clip'||x.overflowX==='hidden')&&horizontal>GEOMETRY_TOLERANCE)||((x.overflowY==='clip'||x.overflowY==='hidden')&&vertical>GEOMETRY_TOLERANCE);return{id,horizontal,vertical,leaves,clipped,lines:x.lines,whiteSpace:x.whiteSpace,owner:or,text:tr}});
    assert(target.bodyOverflow<=GEOMETRY_TOLERANCE&&overflow.every(x=>x.horizontal<=GEOMETRY_TOLERANCE&&!x.leaves&&!x.clipped),'TEXT_OVERFLOW',{width,bodyOverflow:target.bodyOverflow,overflow});
    const wrap=overflow.find(x=>x.id==='wrap-action'),contract=overflow.find(x=>x.id==='contract-action'),longAction=overflow.find(x=>x.id==='long-action'),longLabel=overflow.find(x=>x.id==='long-label');
    assert(wrap&&wrap.lines>=2&&wrap.whiteSpace!=='nowrap'&&wrap.horizontal<=GEOMETRY_TOLERANCE&&!wrap.leaves&&!wrap.clipped,'WRAP_WHERE_REQUIRED',{width,wrap});
    assert(contract&&contract.whiteSpace==='nowrap'&&contract.horizontal<=GEOMETRY_TOLERANCE&&!contract.leaves&&!contract.clipped,'CONTRACT_NOWRAP_PROVED_SAFE',{width,contract});
    assert(longAction&&longLabel,'LONG_LABEL_BUTTON_ACTION_COVERAGE',{width,longAction,longLabel});
    proofs.push({width,typography,analyticsProof,shellProof,geometry,overflow,wrap,contract});
  }
}finally{await browser.close()}

console.log('EXACT_CORRECTION_PARENT_GUARD=PASS',JSON.stringify({correction_parent:EXPECTED_CORRECTION_PARENT,head,correctiveChanged}));
console.log('TYPOGRAPHY_FINALIZATION_BASE_CHAIN=PASS',JSON.stringify({base:TYPOGRAPHY_FINALIZATION_BASE,changed}));
console.log('RUNTIME_FINALIZATION_NO_CHANGE=PASS');
console.log('TYPOGRAPHY_FRAME_PROOF',JSON.stringify(proofs));
console.log('TYPOGRAPHY_110_CONTENT=PASS');
console.log('SECTION_TITLES_UNCHANGED=PASS');
console.log('ANALYTICS_UNCHANGED=PASS');
console.log('SHELL_UNCHANGED=PASS');
console.log('FRAME_GEOMETRY_UNCHANGED=PASS');
console.log('TEXT_OVERFLOW=ZERO');
console.log('WRAP_WHERE_REQUIRED=PASS');
console.log('FRAME_OVERFLOW_ACCEPTANCE_OWNER=SECTION_QA_AUTHORITATIVE');
console.log('BUG1_NO_TOUCH=PASS');
console.log('BUG2_NO_TOUCH=PASS');
console.log('BACKGROUND_RESTORATION_NO_TOUCH=PASS');
console.log('CLIENT_SECTION_TYPOGRAPHY_TARGETED_QA=PASS');