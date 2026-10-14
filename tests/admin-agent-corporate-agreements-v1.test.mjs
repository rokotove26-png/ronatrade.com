import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/portal/clients-agents-current-ui.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('functions/portal/clients-agents-current-ui.js');
const proxy=read('functions/portal/agency-contracts.js');
const edge=read('supabase/functions/rona-agent-agreements/index.ts');
const migration=read('supabase/migrations/20261014070000_agent_agency_signed_documents_v1.sql');
const ownerAPI=read('functions/portal/owner-api.js');

test('Agent business identity is legal entity; persons remain solely representatives',()=>{
  assert.match(ui,/const agentCompanies=\(\)=>Array\.isArray\(agencyArchive\?\.agents\)/);
  assert.match(ui,/const companyAgent=\(clientId\)=>agentCompanies\(\)\.find/);
  assert.match(ui,/\['agents','Агенты'\]/);
  assert.match(ui,/ca-name',a\.legalName/);
  assert.match(ui,/a\.agentCompanyId/);
  assert.match(ui,/Представитель:/);
  assert.match(ui,/openEntityOptions\('AGENT',String\(reps\[0\]\.agent_person_id\)/);
  assert.doesNotMatch(ui,/function agentsView\(\)\{const s=norm\(S\.search\),xs=agents\(\)/);
  assert.match(ui,/if\(reps\.length!==1\)\{option\.disabled=true/);
  assert.match(ui,/agentPersonId:sel\.value\|\|null/);
  assert.doesNotMatch(ui,/agentLegalEntityId:.*send|agent_legal_entity_key.*update/);
});

test('Append-only agency signed archive is private and does not create business authority',()=>{
  assert.match(migration,/create table if not exists portal_private\.agent_agency_contract_documents/);
  assert.match(migration,/references portal_private\.agent_legal_entities\(id\) on delete restrict/);
  assert.match(migration,/storage_object_key uuid not null unique/);
  assert.match(migration,/document_id text not null unique/);
  assert.doesNotMatch(migration,/references portal_private\.documents\(id\)/);
  assert.doesNotMatch(migration,/update storage\.buckets/);
  assert.match(migration,/AGENCY_CONTRACT','AGENCY_ADDENDUM/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all .* from public, anon, authenticated/);
  assert.doesNotMatch(migration,/drop table|delete from|truncate table/i);

  assert.match(edge,/const BUCKET="rona-portal-private"/);
  assert.match(edge,/if\(!\(rows\[0\]\.roles\|\|\[\]\)\.map\(String\)\.includes\("ADMIN"\)\)/);
  assert.match(edge,/auth\.getUser\(token\)/);
  assert.match(edge,/resolve_portal_auth/);
  assert.match(edge,/join auth\.sessions/);
  assert.match(edge,/SESSION_INVALID|SESSION_INVALID/);
  assert.match(edge,/if\(String\(form\.get\("attestedSigned"\)\)!=="true"\)/);
  assert.match(edge,/PDF_SIGNATURE_INVALID/);
  assert.match(edge,/crypto\.subtle\.digest\("SHA-256",bytes\)/);
  assert.match(edge,/createSignedUrl\(String\(row\.object_name\),120/);
  assert.match(edge,/AGENCY_SIGNED_PDF_ARCHIVED/);
  assert.match(edge,/AGENCY_SIGNED_PDF_DOWNLOAD/);
  assert.match(migration,/SOURCE_RECEIVED/);
  assert.doesNotMatch(edge,/insert into portal_private\.documents|portal_private\.document_versions/);
  assert.match(edge,/insert into portal_private\.agent_agency_contract_documents/);
  assert.match(edge,/externalPayableCreated:false/);
  assert.match(edge,/await service\.storage\.from\(BUCKET\)\.remove\(\[objectName\]\)/);
  assert.doesNotMatch(edge,/agent_deal_terms|agent_settlements|agent_reward_owner_corrections_v1/);
  assert.doesNotMatch(ownerAPI,/AGENCY_UPSTREAM|rona-agent-agreements/);
});

test('Pages agency endpoint enforces same-origin writes and keeps auth cookies HTTP-only',()=>{
  assert.match(proxy,/originAllowed\(request\)/);
  assert.match(proxy,/if\(request\.method==='POST'&&!originAllowed\(request\)\)/);
  assert.match(proxy,/rota|route='\/admin\/agency-contracts'/);
  assert.match(proxy,/rona_portal_at/);
  assert.match(proxy,/HttpOnly; SameSite=Lax/);
  assert.match(proxy,/if\(!at\)return reply\(401/);
  assert.match(proxy,/fetch\(UPSTREAM\+route/);
  assert.match(proxy,/DOC\.test\(doc\)/);
  assert.doesNotMatch(proxy,/access-control-allow-origin/);
});

test('Rendered corporate agent list, secure download and signed upload workflow',async()=>{
  const {chromium}=await import('playwright');
  const script=await(await onRequest()).text();
  const companies=['FARGONA GAZ','UNVERSAL SOLYARIS','НИК-ОЙЛ','ГазОнэ'].map((x,i)=>({
    client_id:'RONA-C00'+(i+2),legal_name:'ООО '+x,agent_person_id:'AGP-2026-001'
  }));
  const companyA={agentCompanyId:'S-005',legalName:'Общество с ограниченной ответственностью «ИнКом»',
    clientCount:4,clientIds:companies.map(x=>x.client_id),
    representatives:[{agent_person_id:'AGP-2026-001',agent_name:'Артем Белов'}],
    documents:[{documentId:'AGENCY-S-005-AAAA0001',filename:'ИНКОМ_Договор_351C.pdf',
      kind:'AGENCY_CONTRACT',reference:'351C/2026',authority:'SOURCE_RECEIVED'}]};
  const companyB={agentCompanyId:'S-010',legalName:'Aeromarine Kinetics Pte Ltd',
    clientCount:0,clientIds:[],representatives:[],documents:[]};
  const business={clients:companies,agents:[
    {agent_person_id:'AGP-2026-001',agent_name:'Артем Белов'},
    {agent_person_id:'AGP-2026-002',agent_name:'Егор Кузнецов'}]};
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [1440,850,390]){
      const page=await browser.newPage({viewport:{width,height:950}});
      const errors=[],operations=[],requests=[],failures=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>requests.push(r.method()+' '+r.url()));
      page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
      page.on('popup',p=>void p.close());
      await page.route(/^http:\/\/rona\.test\/portal\/admin(?:\?.*)?$/,r=>r.fulfill({
        status:200,contentType:'text/html',
        body:'<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><section id="page-access"></section></body></html>'}));
      await page.route('http://rona.test/portal/owner-api**',r=>r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({ok:true,data:decodeURIComponent(new URL(r.request().url()).searchParams.get('path')||'').includes('access-workspace')?{users:[],events:[]} : business})}));
      await page.route(/^http:\/\/rona\.test\/portal\/admin-authority\/.*$/,r=>r.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{contracts:[],accessUsers:[]}})}));
      await page.route('http://rona.test/portal/agency-contracts**',async r=>{
        const u=new URL(r.request().url()),action=u.searchParams.get('action')||'list';
        operations.push({method:r.request().method(),action,company:u.searchParams.get('companyId'),
          doc:u.searchParams.get('documentId')});
        if(action==='upload'){
          assert.equal(r.request().method(),'POST');
          const body=r.request().postData()||'';
          assert.match(body,/AGENCY_ADDENDUM/);
          assert.match(body,/attestedSigned/);
          assert.match(body,/true/);
          companyB.documents.push({documentId:'AGENCY-S-010-BBBB0001',filename:'SIGNED_DS.pdf',
            kind:'AGENCY_ADDENDUM',reference:'DS1',authority:'SOURCE_RECEIVED'});
          await r.fulfill({status:201,contentType:'application/json',
            body:JSON.stringify({ok:true,data:{documentId:'AGENCY-S-010-BBBB0001'}})});
          return;
        }
        if(action==='download'){
          await r.fulfill({status:200,contentType:'application/json',
            body:JSON.stringify({ok:true,data:{url:'https://private.test/download?token=short-lived',
              filename:'ИНКОМ_Договор_351C.pdf'}})});
          return;
        }
        await r.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({ok:true,data:{agents:[companyA,companyB]}})});
      });
      await page.goto('http://rona.test/portal/admin?accessView=agents',{waitUntil:'load'});
      await page.addScriptTag({content:script});
      try{
        await page.waitForSelector('#rona-ca4 .ca-agreement-archive',{timeout:12000});
      }catch(e){
        const state=await page.evaluate(()=>({
          url:location.href,ready:window.__RONA_CLIENTS_AGENTS_CURRENT_READY__,
          status:window.__RONA_CLIENTS_AGENTS_CURRENT_STATE__,
          root:document.querySelector('#page-access')?.outerHTML?.slice(0,1900),
          body:document.body?.textContent?.slice(0,1300)
        }));
        throw new Error('CORPORATE_AGENT_VIEW_BOOTSTRAP_FAILED: '+JSON.stringify({state,errors,operations,requests,failures}),{cause:e})
      }
      const titles=await page.locator('#ca-current-body .ca-agent-choice .ca-name').allTextContents();
      assert.deepEqual(new Set(titles),new Set([companyA.legalName,companyB.legalName]),
        'Agent list entries must be legal entity names, not persons');
      assert(!titles.includes('Артем Белов'));
      assert(!titles.includes('Егор Кузнецов'));
      assert.equal(await page.locator('.rona-owner-kpi').nth(1).textContent(),'2');
      assert.equal(await page.locator('.rona-owner-kpi').nth(2).textContent(),'4');
      assert.equal(await page.locator('.ca-agents-workspace').count(),1);
      assert.equal(await page.locator('.ca-agent-choice').count(),2);
      assert.equal(await page.locator('.ca-agent-detail').count(),1);
      assert.equal(await page.locator('.ca-agreement-item').count(),1);
      assert.equal(await page.locator('[data-rona-agent-company-upload]').count(),1);
      const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
      assert(widths.scroll<=widths.inner+2,'Workspace must not overflow viewport: '+JSON.stringify(widths));
      const download=page.locator('[data-rona-agency-document="AGENCY-S-005-AAAA0001"]');
      await download.click();
      await page.waitForFunction(()=>document.querySelector('[data-rona-agency-document="AGENCY-S-005-AAAA0001"]')?.disabled===false);
      assert(operations.some(o=>o.action==='download'&&o.company==='S-005'&&o.doc==='AGENCY-S-005-AAAA0001'));

      await page.locator('[data-rona-agent-select="S-010"]').click();
      assert.equal(await page.locator('[data-rona-agent-select="S-010"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.ca-agent-title').textContent(),companyB.legalName);
      assert.equal(await page.locator('.ca-agreement-item').count(),0);
      const add=page.locator('[data-rona-agent-company-upload="S-010"]');
      await add.click();
      const dialog=page.locator('.ca-modal-backdrop [role="dialog"]');
      await dialog.locator('select').selectOption('AGENCY_ADDENDUM');
      await dialog.locator('input[maxlength="180"]').fill('DS1');
      await dialog.locator('input[type="file"]').setInputFiles({
        name:'SIGNED_DS.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n1 0 obj\n%%EOF')
      });
      await dialog.locator('input[type="checkbox"]').check();
      await dialog.getByRole('button',{name:'Сохранить документ'}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.ca-agreement-item').length===1,{timeout:10000});
      assert(operations.some(o=>o.action==='upload'&&o.company==='S-010'&&o.method==='POST'));
      assert.deepEqual(errors,[]);
      await page.close();
      companyB.documents=[]; // reset test state
    }
  }finally{await browser.close()}
});
