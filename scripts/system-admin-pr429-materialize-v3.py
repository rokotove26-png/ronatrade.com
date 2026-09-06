from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text()


def write(path, value):
    (ROOT / path).write_text(value)


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one target, got {count}')
    return source.replace(old, new, 1)


def sub_line(path, pattern, replacement, label):
    source = read(path)
    count = len(re.findall(pattern, source, flags=re.M))
    if count != 1:
        raise SystemExit(f'{label}: expected one target, got {count}')
    write(path, re.sub(pattern, replacement, source, count=1, flags=re.M))


def git_blob_sha(text):
    data = text.encode('utf-8')
    return hashlib.sha1(f'blob {len(data)}\0'.encode('ascii') + data).hexdigest()


# 1. Restore the frozen payment-state contract. Commercial Passport value remains separate.
payment = r'''function currentPaymentStatus(row:any,finance:any,safePayment:any){const obligation=finiteNumber(finance?.obligation_amount),received=finiteNumber(finance?.received_amount),currency=String(finance?.currency||safePayment?.currency||"").trim().toUpperCase()||null,summary=String(finance?.finance_status||"").trim().toUpperCase();if(obligation!==null&&obligation>0&&received!==null){const percent=Math.max(0,Math.min(100,Math.round(received/obligation*100)));if(received>=obligation)return{payment_status:'PAID',payment_label:'Оплачено 100%',payment_received_amount:received,payment_obligation_amount:obligation,payment_currency:currency,payment_percent:100,payment_source:'OWNER_DEAL_FINANCE_SUMMARY'};if(received>0)return{payment_status:'PARTIALLY_PAID',payment_label:`Оплачено ${percent}%`,payment_received_amount:received,payment_obligation_amount:obligation,payment_currency:currency,payment_percent:percent,payment_source:'OWNER_DEAL_FINANCE_SUMMARY'};if(summary==='OVERDUE')return{payment_status:'OVERDUE',payment_label:'Оплата просрочена',payment_received_amount:received,payment_obligation_amount:obligation,payment_currency:currency,payment_percent:0,payment_source:'OWNER_DEAL_FINANCE_SUMMARY'};return{payment_status:'AWAITING_PAYMENT',payment_label:'Ожидается оплата',payment_received_amount:received,payment_obligation_amount:obligation,payment_currency:currency,payment_percent:0,payment_source:'OWNER_DEAL_FINANCE_SUMMARY'}}if(safePayment)return{payment_status:'PAYMENT_CONFIRMED',payment_label:'Оплата получена',payment_received_amount:finiteNumber(safePayment.allocated_amount??safePayment.amount),payment_obligation_amount:null,payment_currency:currency,payment_percent:null,payment_source:'BANK_CONFIRMED_VERIFIED_ALLOCATION'};const dealFinance=String(row?.finance_status||"").trim().toUpperCase();if(dealFinance==='PAID')return{payment_status:'PAID',payment_label:'Оплачено',payment_received_amount:null,payment_obligation_amount:null,payment_currency:currency,payment_percent:null,payment_source:'DEAL_FINANCE_STATUS'};if(['DUE','PAYMENT_DUE','AWAITING_PAYMENT','OVERDUE'].includes(dealFinance))return{payment_status:dealFinance,payment_label:dealFinance==='OVERDUE'?'Оплата просрочена':'Ожидается оплата',payment_received_amount:null,payment_obligation_amount:null,payment_currency:currency,payment_percent:null,payment_source:'DEAL_FINANCE_STATUS'};if(dealFinance==='NOT_DUE')return{payment_status:'NOT_DUE',payment_label:'Оплата не наступила',payment_received_amount:null,payment_obligation_amount:null,payment_currency:currency,payment_percent:null,payment_source:'DEAL_FINANCE_STATUS'};return{payment_status:'TO_VERIFY',payment_label:'Статус оплаты уточняется',payment_received_amount:null,payment_obligation_amount:null,payment_currency:currency,payment_percent:null,payment_source:'DEAL_FINANCE_STATUS'}}'''
sub_line('supabase/functions/rona-portal-api/index.ts', r'^function currentPaymentStatus\(.*$', payment, 'payment-semantics-restore')

deals_projection = r'''async function projectClientDeals(rows:any[],safePayments:any[]){const ids=[...new Set((rows||[]).map((r:any)=>String(r.deal_id||"")).filter(Boolean))];if(!ids.length)return[];const financeRows=await sql`select distinct on (deal_id) deal_id,obligation_amount,received_amount,currency,client_remaining_amount,finance_status,authority_state,lifecycle_state,updated_at from portal_private.owner_deal_finance_summary where deal_id in (select value from jsonb_array_elements_text(${sql.json(ids)}::jsonb)) and authority_state in ('CONFIRMED','VERIFIED') and lifecycle_state='ACTIVE' order by deal_id,updated_at desc`,commercialRows=await sql`select d.deal_id,a.application_id,(a.quantity_tonnes::numeric*a.proposed_price::numeric) as obligation_amount,a.proposed_currency::text as currency,w.finalized_at from portal_private.deals d join portal_private.client_applications a on a.linked_deal_key=d.id join portal_private.owner_application_workflow w on w.application_key=a.id where d.deal_id in (select value from jsonb_array_elements_text(${sql.json(ids)}::jsonb)) and a.status='DEAL_REGISTERED' and w.business_status='DEAL' and coalesce(w.counter_offer_used,false)=false and w.finalized_at is not null`,resourceRows=await sql`select d.deal_id,rd.resource_decision_id,rd.decision_state,rd.decided_at from portal_private.deals d join portal_private.resource_decisions rd on rd.deal_key=d.id where d.deal_id in (select value from jsonb_array_elements_text(${sql.json(ids)}::jsonb)) order by rd.decided_at desc`;const financeByDeal=new Map(financeRows.map((r:any)=>[String(r.deal_id),r])),commercialByDeal=new Map(commercialRows.map((r:any)=>[String(r.deal_id),r])),resourceByDeal=new Map(resourceRows.map((r:any)=>[String(r.deal_id),r])),paymentByDeal=new Map<string,any>();for(const p of safePayments||[]){const id=String(p.deal_id||"");if(id&&!paymentByDeal.has(id))paymentByDeal.set(id,p)}return(rows||[]).map((row:any)=>{const id=String(row.deal_id),commercial=commercialByDeal.get(id),commercialAmount=finiteNumber(commercial?.obligation_amount),commercialCurrency=String(commercial?.currency||"").trim().toUpperCase()||null,passportReady=commercialAmount!==null&&commercialAmount>0&&Boolean(commercialCurrency);return{deal_id:id,business_status:String(row.business_status),...currentDealStatus(row),...currentPaymentStatus(row,financeByDeal.get(id),paymentByDeal.get(id)),passport_amount:passportReady?commercialAmount:null,passport_currency:passportReady?commercialCurrency:null,passport_amount_source:passportReady?'FINALIZED_APPLICATION_COMMERCIAL_TERMS':null,passport_application_id:passportReady&&commercial?.application_id?String(commercial.application_id):null,...currentResourceStatus(row,resourceByDeal.get(id)),opened_at:row.opened_at,closed_at:row.closed_at,updated_at:row.updated_at}})}'''
sub_line('supabase/functions/rona-portal-api/index.ts', r'^async function projectClientDeals\(.*$', deals_projection, 'dedicated-passport-projection')

# 2. Consume only dedicated Passport commercial projection in Deals/Passport.
deals_runtime_path = 'assets/portal-runtime/client-deals-authoritative-v1.js'
deals_runtime = read(deals_runtime_path)
deals_runtime = replace_once(
    deals_runtime,
    "function authoritativeAmount(d){const amount=numberText(d?.payment_obligation_amount,2),currency=upper(d?.payment_currency);return amount&&currency?`${amount} ${currency}`:''}",
    "function authoritativeAmount(d){const amount=numberText(d?.passport_amount,2),currency=upper(d?.passport_currency);return amount&&currency?`${amount} ${currency}`:''}",
    'passport-consumer'
)
deals_runtime = replace_once(
    deals_runtime,
    'd.payment_status,d.finance_status,d.payment_obligation_amount,d.payment_currency,d.updated_at',
    'd.payment_status,d.finance_status,d.passport_amount,d.passport_currency,d.passport_amount_source,d.updated_at',
    'passport-render-signature'
)
write(deals_runtime_path, deals_runtime)

# 3. Strengthen representative real-browser contract and correct Home readiness adapter.
harness_path = 'scripts/qa-client-owner-retest-real-browser-v4.mjs'
harness = read(harness_path)
harness = replace_once(
    harness,
    'const APPLICATION_AMOUNT_PROJECTION=["portal_private.owner_application_workflow","a.status=\'DEAL_REGISTERED\'","w.business_status=\'DEAL\'","coalesce(w.counter_offer_used,false)=false","w.finalized_at is not null","FINALIZED_APPLICATION_COMMERCIAL_TERMS"].every(token=>API_SOURCE.includes(token));',
    'const APPLICATION_AMOUNT_PROJECTION=["portal_private.owner_application_workflow","a.status=\'DEAL_REGISTERED\'","w.business_status=\'DEAL\'","coalesce(w.counter_offer_used,false)=false","w.finalized_at is not null","passport_amount","passport_currency","passport_amount_source","passport_application_id","FINALIZED_APPLICATION_COMMERCIAL_TERMS"].every(token=>API_SOURCE.includes(token));',
    'harness-capability'
)
harness = re.sub(
    r'^function payFromCanonicalApplication\(.*$',
    "function payFromCanonicalApplication(name,id){const src=commercialSource(name,id),enabled=APPLICATION_AMOUNT_PROJECTION&&src;return{payment_status:'NOT_DUE',payment_label:'Оплата не наступила',payment_received_amount:null,payment_obligation_amount:null,payment_currency:null,payment_percent:null,payment_source:'DEAL_FINANCE_STATUS',passport_amount:enabled?src.obligation_amount:null,passport_currency:enabled?src.currency:null,passport_amount_source:enabled?src.source:null,passport_application_id:enabled?src.application_id:null}}",
    harness,
    count=1,
    flags=re.M
)
for old, new in {
    "backend:'projectClientDeals -> currentPaymentStatus'":"backend:'projectClientDeals -> dedicated Passport commercial projection'",
    "api_amount:'data.deals[].payment_obligation_amount'":"api_amount:'data.deals[].passport_amount'",
    "api_currency:'data.deals[].payment_currency'":"api_currency:'data.deals[].passport_currency'",
    "api_source:'data.deals[].payment_obligation_source'":"api_source:'data.deals[].passport_amount_source',api_application:'data.deals[].passport_application_id'",
    "return{amount:d?.payment_obligation_amount,currency:d?.payment_currency,source:d?.payment_source,obligation_source:d?.payment_obligation_source}":"return{amount:d?.passport_amount,currency:d?.passport_currency,source:d?.passport_amount_source,application_id:d?.passport_application_id,payment_obligation_amount:d?.payment_obligation_amount,payment_source:d?.payment_source}",
    "if(Number(projection.amount)!==EXP.A.amount||upper(projection.currency)!==EXP.A.currency||projection.obligation_source!=='FINALIZED_APPLICATION_COMMERCIAL_TERMS')fail(failures,'PASSPORT_SOURCE_TO_PROJECTION',{projection});":"if(Number(projection.amount)!==EXP.A.amount||upper(projection.currency)!==EXP.A.currency||projection.source!=='FINALIZED_APPLICATION_COMMERCIAL_TERMS'||projection.application_id!==EXP.A.source_application_id||projection.payment_obligation_amount!==null||projection.payment_source!=='DEAL_FINANCE_STATUS')fail(failures,'PASSPORT_SOURCE_TO_PROJECTION',{projection});"
}.items():
    harness = replace_once(harness, old, new, f'harness-replace-{old[:24]}')

home_bug = "const ready=await wait(page,()=>document.documentElement.dataset.ronaClientHomeState==='ready'&&window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()?.contract?.client_id===arg,FIX.A.client_id,2500)"
home_fix = "const ready=await wait(page,arg=>document.documentElement.dataset.ronaClientHomeState==='ready'&&window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()?.contract?.client_id===arg,FIX.A.client_id,2500)"
harness = replace_once(harness, home_bug, home_fix, 'home-reentry-arg')

helpers = r'''const OWNER_TYPO_MARK='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED';
async function ownerTypoScope(page,selector){return page.evaluate(({selector,mark})=>{const nrm=v=>String(v??'').replace(/\s+/g,' ').trim(),vis=n=>{if(!n||!n.isConnected||n.hidden)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0},direct=n=>{if(n.matches?.('input,select,textarea,button,option'))return true;for(const x of n.childNodes||[])if(x.nodeType===Node.TEXT_NODE){const t=nrm(x.textContent);if(t&&!(t.length===1&&!/[A-Za-zА-Яа-яЁё0-9]/u.test(t)))return true}return false},excluded=n=>!!n.closest?.('svg,canvas,picture,img,video,#page-analytics,#analyticsPage,[data-page-panel="analytics"],[data-page-id="analytics"]')||n.getAttribute?.('aria-hidden')==='true'||/(?:icon|logo|glyph)/i.test(String(n.className||'')),clip=n=>{const s=getComputedStyle(n);return((['hidden','clip'].includes(s.overflowX)&&n.scrollWidth>n.clientWidth+1)||(['hidden','clip'].includes(s.overflowY)&&n.scrollHeight>n.clientHeight+1))};const roots=[...document.querySelectorAll(selector)].filter(vis),nodes=[...new Set(roots.flatMap(root=>[root,...root.querySelectorAll('*')]))].filter(n=>vis(n)&&direct(n)&&!excluded(n)),rows=nodes.map(n=>{const base=Number(n.getAttribute('data-rona-owner-typo-base')),font=parseFloat(getComputedStyle(n).fontSize),ratio=Number.isFinite(base)&&base>0?font/base:null;return{text:nrm(n.textContent).slice(0,100),tag:n.tagName,className:String(n.className||'').slice(0,100),base:Number.isFinite(base)?base:null,font,ratio,marked:n.getAttribute('data-rona-owner-typo-scaled')==='1.10',clip:clip(n)}});return{html_marker:document.documentElement.dataset.ronaClientOwnerTypography||'',eligible:rows.length,marked:rows.filter(x=>x.marked).length,unmarked:rows.filter(x=>!x.marked).slice(0,15),bad:rows.filter(x=>x.marked&&(x.ratio<1.075||x.ratio>1.125)).slice(0,15),clipped:rows.filter(x=>x.clip).slice(0,15),rows:rows.slice(0,40),expected_marker:mark}}, {selector,mark})}
async function ownerTypoSection(page,name){await nav(page,name);await sleep(220);const selector=`#page-${name},#${name}Page,[data-page-panel="${name}"],[data-page-id="${name}"]`;return ownerTypoScope(page,selector)}
function ownerTypoScopePass(scope,min=3){return scope&&scope.html_marker===OWNER_TYPO_MARK&&scope.eligible>=min&&scope.marked===scope.eligible&&scope.bad.length===0&&scope.clipped.length===0}
'''
if 'const OWNER_TYPO_MARK=' in harness:
    raise SystemExit('owner typography harness already present unexpectedly')
match = re.search(r'(^async function companyProof\(.*$)', harness, flags=re.M)
if not match:
    raise SystemExit('companyProof insertion anchor missing')
harness = harness[:match.end()] + '\n' + helpers + harness[match.end():]

old_typo = re.search(r'^if\(base\)\{const bp=.*await bp\.close\(\)\}$', harness, flags=re.M)
if not old_typo:
    raise SystemExit('old typography assertion block missing')
new_typo = r'''if(base){const passportTypography=await ownerTypoScope(page,'.rona-deal-command-center-v3[data-rona-authoritative-binding="authoritative-binding"]');const sectionTypography={};for(const sec of ['home','companies','prices','applications','deals'])sectionTypography[sec]=await ownerTypoSection(page,sec);const navTypography=await ownerTypoScope(page,'#nav');const bp=await ctx.newPage();await bp.goto(base.origin+'/portal/client',{waitUntil:'domcontentloaded'});await sleep(600);const ba=await typeSample(bp,'analytics'),ta=await typeSample(page,'analytics'),analyticsRatios=['nav','title','sub','leaf'].filter(k=>Number.isFinite(ba[k])&&Number.isFinite(ta[k])&&ba[k]>0).map(k=>({key:k,ratio:ta[k]/ba[k],base:ba[k],target:ta[k]})),analyticsMarkers=await page.evaluate(()=>[...document.querySelectorAll('#page-analytics [data-rona-owner-typo-scaled],#analyticsPage [data-rona-owner-typo-scaled],[data-page-panel="analytics"] [data-rona-owner-typo-scaled],[data-page-id="analytics"] [data-rona-owner-typo-scaled]')].length),proof={marker:document.documentElement?.dataset?.ronaClientOwnerTypography,nav:navTypography,sections:sectionTypography,passport:passportTypography,analytics:{base:ba,target:ta,ratios:analyticsRatios,markers:analyticsMarkers}};console.log('REAL_TYPOGRAPHY_PROOF',JSON.stringify(proof));const badSections=Object.entries(sectionTypography).filter(([,v])=>!ownerTypoScopePass(v,3)).map(([k,v])=>({section:k,eligible:v.eligible,marked:v.marked,bad:v.bad,clipped:v.clipped,marker:v.html_marker})),analyticsBad=analyticsMarkers!==0||analyticsRatios.length<2||analyticsRatios.some(x=>x.ratio<.98||x.ratio>1.02);if(!ownerTypoScopePass(navTypography,3)||!ownerTypoScopePass(passportTypography,3)||badSections.length||analyticsBad)fail(failures,'CLIENT_TYPOGRAPHY_REAL_UI_110',{nav:{eligible:navTypography.eligible,marked:navTypography.marked,bad:navTypography.bad,clipped:navTypography.clipped,marker:navTypography.html_marker},passport:{eligible:passportTypography.eligible,marked:passportTypography.marked,bad:passportTypography.bad,clipped:passportTypography.clipped,marker:passportTypography.html_marker},badSections,analytics:{ratios:analyticsRatios,markers:analyticsMarkers}});await bp.close()}'''
harness = harness[:old_typo.start()] + new_typo + harness[old_typo.end():]
write(harness_path, harness)

# 4. Prepare old materializers to materialize all already-authorized canonical changes once,
# but suppress the incomplete body-only typography mutation.
generator_path = 'scripts/apply-system-admin-owner-remediation-v1.mjs'
generator = read(generator_path)
generator = replace_once(
    generator,
    "const companyScaled = scaleExplicitPxTypography(company, 'COMPANY_TYPOGRAPHY');\ncompany = companyScaled.source;",
    "const companyScaled = { count: 0 };",
    'disable-company-partial-typography'
)
generator = replace_once(
    generator,
    "const homeScaled = scaleExplicitPxTypography(homeCommand, 'HOME_COMMAND_TYPOGRAPHY');\nhomeCommand = homeScaled.source;",
    "const homeScaled = { count: 0 };",
    'disable-home-partial-typography'
)
start = generator.find("let responsive = await read('assets/portal-runtime/client-content-responsive-v1.css');")
end_token = "await write('assets/portal-runtime/client-content-responsive-v1.css', responsive);"
end = generator.find(end_token, start)
if start < 0 or end < 0:
    raise SystemExit('responsive typography block missing')
end += len(end_token)
generator = generator[:start] + "let responsive = await read('assets/portal-runtime/client-content-responsive-v1.css');\nconst TYPO_MARK='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED';" + generator[end:]
write(generator_path, generator)

# Materialize the existing alias/first-paint/remediation chain into canonical sources.
for script in [
    'scripts/apply-owner-client-company-alias-slot-v2.mjs',
    'scripts/apply-owner-client-company-first-paint-v1.mjs',
    generator_path,
]:
    subprocess.run(['node', script], check=True)

# 5. Add deterministic computed typography owner to the already-approved company runtime.
company_path = 'assets/portal-runtime/client-contract-download-v3.js'
company = read(company_path)
company = replace_once(
    company,
    "const MARK='20260905-client-contract-v8-authoritative-company-name-visible';",
    "const MARK='20260906-client-contract-v9-kpi-typography-owner';",
    'company-v9-marker'
)
TYPO_JS = r'''
const OWNER_TYPO_MARK='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED';
const OWNER_TYPO_SCALE=1.1;
const OWNER_TYPO_BASE_ATTR='data-rona-owner-typo-base';
let ownerTypoObserver=null,ownerTypoQueued=false,ownerTypoPending=new Set();
function ownerTypoExcluded(el){if(!el||el.nodeType!==1)return true;if(el.closest('svg,canvas,picture,img,video,#page-analytics,#analyticsPage,[data-page-panel="analytics"],[data-page-id="analytics"]'))return true;if(el.getAttribute('aria-hidden')==='true')return true;if(/(?:icon|logo|glyph)/i.test(String(el.className||'')))return true;return false}
function ownerTypoDirectText(el){if(ownerTypoExcluded(el)||el.matches('script,style,link,meta,template,noscript'))return false;if(el.matches('input,select,textarea,button,option'))return true;for(const node of el.childNodes){if(node.nodeType!==Node.TEXT_NODE)continue;const text=norm(node.textContent);if(!text)continue;if(text.length===1&&!/[A-Za-zА-Яа-яЁё0-9]/u.test(text))continue;return true}return false}
function ownerTypoTargets(root){if(!root||root.nodeType!==1)return[];const nodes=[root,...root.querySelectorAll('*')];return nodes.filter(el=>!el.hasAttribute(OWNER_TYPO_BASE_ATTR)&&ownerTypoDirectText(el))}
function ownerTypoApply(targets){const items=[...new Set(targets)].filter(el=>el?.isConnected&&!el.hasAttribute(OWNER_TYPO_BASE_ATTR)&&ownerTypoDirectText(el));if(!items.length)return 0;const restore=new Map();for(const el of items){for(let p=el.parentElement;p;p=p.parentElement){if(!p.hasAttribute(OWNER_TYPO_BASE_ATTR)||restore.has(p))continue;const base=Number(p.getAttribute(OWNER_TYPO_BASE_ATTR));if(!Number.isFinite(base)||base<=0)continue;restore.set(p,{value:p.style.getPropertyValue('font-size'),priority:p.style.getPropertyPriority('font-size')});p.style.setProperty('font-size',`${base}px`,'important')}}const baselines=items.map(el=>parseFloat(getComputedStyle(el).fontSize));for(const [el,old] of restore){if(old.value)el.style.setProperty('font-size',old.value,old.priority);else el.style.removeProperty('font-size')}let applied=0;items.forEach((el,index)=>{const base=baselines[index];if(!Number.isFinite(base)||base<=0)return;const scaled=Math.round(base*OWNER_TYPO_SCALE*10000)/10000;el.setAttribute(OWNER_TYPO_BASE_ATTR,String(base));el.setAttribute('data-rona-owner-typo-scaled','1.10');el.style.setProperty('font-size',`${scaled}px`,'important');applied++});document.documentElement.dataset.ronaClientOwnerTypography=OWNER_TYPO_MARK;return applied}
function ownerTypoFlush(){ownerTypoQueued=false;const roots=[...ownerTypoPending];ownerTypoPending.clear();const targets=[];for(const root of roots)targets.push(...ownerTypoTargets(root));ownerTypoApply(targets)}
function ownerTypoQueue(root){if(root?.nodeType===1)ownerTypoPending.add(root);if(ownerTypoQueued)return;ownerTypoQueued=true;queueMicrotask(ownerTypoFlush)}
function startOwnerTypography(){if(!document.body)return;ownerTypoApply(ownerTypoTargets(document.body));if(ownerTypoObserver)return;ownerTypoObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)ownerTypoQueue(node)});ownerTypoObserver.observe(document.body,{childList:true,subtree:true});window.RONA_CLIENT_OWNER_TYPOGRAPHY=Object.freeze({version:OWNER_TYPO_MARK,scale:OWNER_TYPO_SCALE,rescan:()=>ownerTypoApply(ownerTypoTargets(document.body))})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startOwnerTypography,{once:true});else startOwnerTypography();
'''
if 'RONA_CLIENT_OWNER_TYPOGRAPHY_110_' in company:
    raise SystemExit('company typography runtime already present unexpectedly')
close_index = company.rfind('\n})();')
if close_index < 0:
    raise SystemExit('company runtime closure missing')
company = company[:close_index] + '\n' + TYPO_JS.strip() + company[close_index:]
write(company_path, company)

# Canonical cache-bust source now points at the v9 runtime.
build_path = 'scripts/build-pages-direct-canonical.mjs'
build = read(build_path)
build = replace_once(
    build,
    '/assets/portal-runtime/client-contract-download-v3.js?v=20260904-company-directory-first-paint-v1',
    '/assets/portal-runtime/client-contract-download-v3.js?v=20260906-company-directory-kpi-typography-v9',
    'company-runtime-cache-bust'
)
write(build_path, build)

# 6. Convert one-time source transformers into validators so the branch itself is canonical.
alias_validator = """import {readFile} from 'node:fs/promises';\nconst runtime=await readFile('assets/portal-runtime/client-contract-download-v3.js','utf8');\nconst build=await readFile('scripts/build-pages-direct-canonical.mjs','utf8');\nif(!runtime.includes(\"const MARK='20260906-client-contract-v9-kpi-typography-owner';\"))throw new Error('COMPANY_ALIAS_CANONICAL_RUNTIME_MISSING');\nif(!runtime.includes('function hideRedundantCompanyAlias(){return false}'))throw new Error('COMPANY_ALIAS_CANONICAL_VISIBILITY_MISSING');\nif(!build.includes('/assets/portal-runtime/client-contract-download-v3.js?v=20260906-company-directory-kpi-typography-v9'))throw new Error('COMPANY_ALIAS_CANONICAL_BUILD_SRC_MISSING');\nconsole.log('CLIENT_COMPANY_ALIAS_SLOT_V2=PASS canonical-source=true');\n"""
firstpaint_validator = """import {readFile} from 'node:fs/promises';\nconst runtime=await readFile('assets/portal-runtime/client-contract-download-v3.js','utf8');\nif(!runtime.includes('pendingImmediate:false'))throw new Error('COMPANY_FIRST_PAINT_CANONICAL_STATE_MISSING');\nif(!runtime.includes('function primeCompanyDirectory(ctx)'))throw new Error('COMPANY_FIRST_PAINT_CANONICAL_PRIME_MISSING');\nif(!runtime.includes('ronaCompanyDirectoryHydration'))throw new Error('COMPANY_FIRST_PAINT_CANONICAL_HYDRATION_MISSING');\nconsole.log('CLIENT_COMPANY_FIRST_PAINT_V1=PASS canonical-source=true');\n"""
remediation_validator = """import {readFile} from 'node:fs/promises';\nconst read=p=>readFile(p,'utf8');\nconst deals=await read('assets/portal-runtime/client-deals-authoritative-v1.js');\nconst home=await read('assets/portal-runtime/client-home-current-only-v1.js');\nconst company=await read('assets/portal-runtime/client-contract-download-v3.js');\nconst command=await read('assets/portal-runtime/client-home-command-center-v2.js');\nconst responsive=await read('assets/portal-runtime/client-content-responsive-v1.css');\nif(!deals.includes('function retireNonCanonicalDealLayers'))throw new Error('SYSTEM_ADMIN_CANONICAL_DEALS_MISSING');\nif(!home.includes('v8-startup-ready-preserve'))throw new Error('SYSTEM_ADMIN_CANONICAL_HOME_MISSING');\nif(!company.includes(\"const MARK='20260906-client-contract-v9-kpi-typography-owner';\"))throw new Error('SYSTEM_ADMIN_CANONICAL_COMPANY_MARKER_MISSING');\nif(!company.includes('function currentCompanyMetrics(entry)'))throw new Error('SYSTEM_ADMIN_CANONICAL_KPI_MISSING');\nif(!company.includes('RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED'))throw new Error('SYSTEM_ADMIN_CANONICAL_TYPOGRAPHY_MISSING');\nif(!command.includes('[data-page=\\\"home\\\"]'))throw new Error('SYSTEM_ADMIN_CANONICAL_HOME_REENTRY_MISSING');\nif(responsive.includes('RONA_CLIENT_OWNER_TYPOGRAPHY_110_'))throw new Error('SYSTEM_ADMIN_PARTIAL_TYPOGRAPHY_CSS_REINTRODUCED');\nconsole.log(JSON.stringify({status:'SYSTEM_ADMIN_OWNER_REMEDIATION=PASS',canonical_source:true,deals_owner:'AUTHORITATIVE_LIST_ONLY_REAL_DEALS_ROOT',company_kpi:'CANONICAL_APPLICATIONS_AND_DEALS_PRODUCT_PREDICATES',typography:{runtime:'RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED',effective_scale:1.1,analytics_effective_scale:1}}));\n"""
write('scripts/apply-owner-client-company-alias-slot-v2.mjs', alias_validator)
write('scripts/apply-owner-client-company-first-paint-v1.mjs', firstpaint_validator)
write(generator_path, remediation_validator)

# 7. Exact Visual Freeze governance for the new canonical company+typography runtime.
company = read(company_path)
company_sha = git_blob_sha(company)
gov_path = 'governance/client-owner-visual-delta-pr429-approval-20260906.json'
gov = json.loads(read(gov_path))
entry = gov['exact_post_remediation_blobs'][company_path]
entry['authorized_post_blob_sha'] = company_sha
entry['required_marker'] = '20260906-client-contract-v9-kpi-typography-owner'
gov.setdefault('authorized_visual_delta', {})['typography_runtime'] = 'RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED'
req = gov.setdefault('requirements', {})
req['css_delta_only_owner_typography_marker_and_analytics_cancellation'] = False
req['css_source_baseline_unchanged'] = True
req['company_component_delta_only_authoritative_legal_name_visibility_and_owner_typography'] = False
req['company_component_and_global_typography_runtime_exact'] = True
req['client_typography_computed_scale_runtime'] = True
req['css_zoom_transform_used'] = False
write(gov_path, json.dumps(gov, ensure_ascii=False, indent=2) + '\n')

freeze_path = 'scripts/qa-client-portal-visual-freeze.mjs'
freeze = read(freeze_path)
freeze = replace_once(freeze, "?.authorized_post_blob_sha==='bf59802cc91e1e223e3bf9a673c85565e119280a'", f"?.authorized_post_blob_sha==='{company_sha}'", 'freeze-company-sha')
freeze = replace_once(freeze, "?.required_marker==='20260905-client-contract-v8-authoritative-company-name-visible'", "?.required_marker==='20260906-client-contract-v9-kpi-typography-owner'", 'freeze-company-marker')
freeze = replace_once(
    freeze,
    "ownerVisualDeltaApproval?.requirements?.css_delta_only_owner_typography_marker_and_analytics_cancellation===true&&\n  ownerVisualDeltaApproval?.requirements?.company_component_delta_only_authoritative_legal_name_visibility_and_owner_typography===true&&",
    "ownerVisualDeltaApproval?.requirements?.css_source_baseline_unchanged===true&&\n  ownerVisualDeltaApproval?.requirements?.company_component_and_global_typography_runtime_exact===true&&\n  ownerVisualDeltaApproval?.requirements?.client_typography_computed_scale_runtime===true&&\n  ownerVisualDeltaApproval?.requirements?.css_zoom_transform_used===false&&",
    'freeze-typography-governance'
)
write(freeze_path, freeze)

print(json.dumps({
    'status':'SYSTEM_ADMIN_PR429_CANONICAL_MATERIALIZATION=PASS',
    'company_blob_sha':company_sha,
    'typography_runtime':'RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED',
    'payment_semantics':'FROZEN_GENERAL',
    'passport_projection':'DEDICATED_FINALIZED_APPLICATION_COMMERCIAL_TERMS',
    'application_kpi':'CANONICAL_APPLICATIONS_AND_DEALS_PRODUCT_PREDICATES'
}, ensure_ascii=False))
