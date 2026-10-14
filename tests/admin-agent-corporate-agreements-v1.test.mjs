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


test('Rendered company master-detail keeps verified PDF and agent assignment workflows',async()=>{
  const {chromium}=await import('playwright');
  const script=await(await onRequest()).text();
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [1440,850,390]){
      const first={client_id:'RONA-QA-C001',
        legal_name:'Общество с ограниченной ответственностью «FARGONA GAZ»',
        contract_id:'QA-CTR-001',current_external_contract_number:'01/PT-01-1926',
        agent_person_id:'AGP-2026-001'};
      const second={client_id:'RONA-QA-C002',
        legal_name:'Совместное предприятие Общество с ограниченной ответственностью «UNIVERSAL SOLYARIS GRAND»',
        contract_id:'QA-CTR-002',current_external_contract_number:'01/PT-02-1926',
        agent_person_id:null};
      const business={clients:[first,second],agents:[]};
      let secondReady=false,agentAssigned=false;
      const mutations=[],errors=[],networkFailures=[];
      const registry={agents:[{agentCompanyId:'S-005',
        legalName:'Общество с ограниченной ответственностью «ИнКом»',
        clientCount:1,clientIds:[first.client_id],
        representatives:[{agent_person_id:'AGP-2026-001',agent_name:'Артем Белов'}],
        documents:[]}]};
      const authority=()=>({contracts:[
        {contractId:first.contract_id,clientId:first.client_id,contractStatus:'ACTIVE',
          companyName:first.legal_name,externalContractNumber:first.current_external_contract_number,
          bilateralSignedConfirmed:true,serverConfirmed:true},
        {contractId:second.contract_id,clientId:second.client_id,contractStatus:'ACTIVE',
          companyName:second.legal_name,externalContractNumber:second.current_external_contract_number}
      ],signedContractGate:{contracts:[
        {contractId:first.contract_id,bilateralSignedConfirmed:true,serverConfirmed:true},
        {contractId:second.contract_id,bilateralSignedConfirmed:secondReady,serverConfirmed:secondReady}
      ]}});
      const page=await browser.newPage({viewport:{width,height:950}});
      page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>networkFailures.push(r.url()+' '+r.failure()?.errorText));
      await page.route(/^http:\/\/rona\.test\/portal\/admin(?:\?.*)?$/,r=>r.fulfill({
        status:200,contentType:'text/html',body:'<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><section id="page-access"></section></body></html>'}));
      await page.route('http://rona.test/portal/owner-api**',async r=>{
        const url=new URL(r.request().url()),path=url.searchParams.get('path')||'';
        if(r.request().method()==='POST'&&path.endsWith('/agent')){
          const body=JSON.parse(r.request().postData()||'{}');
          mutations.push({action:'agent',path,body});
          agentAssigned=true;second.agent_person_id=body.agentPersonId;
          registry.agents[0].clientIds=[first.client_id,second.client_id];
          await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{assigned:true}})});
          return
        }
        const data=path.includes('access-workspace')?{
          users:[{id:'U-002',name:'QA Client Representative',login:'qa.client',role:'Клиент',status:'ACTIVE',
            bindings:[{company:second.legal_name,clientId:second.client_id,contractId:second.contract_id,status:'ACTIVE'}]}],
          events:[]}:business;
        await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})})
      });
      await page.route(/^http:\/\/rona\.test\/portal\/admin-authority\/.*$/,async r=>{
        const u=new URL(r.request().url());
        if(u.pathname.endsWith('/signed-document/attach')){
          const form=r.request().postDataBuffer()?.toString('utf8')||'';
          mutations.push({action:'signed-PDF',path:u.pathname,hasPdf:form.includes('%PDF')});
          secondReady=true;
          await r.fulfill({status:200,contentType:'application/json',
            body:JSON.stringify({ok:true,data:{documentId:'QA-DOC-002',serverConfirmed:true}})});
          return
        }
        if(u.pathname.includes('/impersonation/targets/company/')){
          await r.fulfill({status:200,contentType:'application/json',
            body:JSON.stringify({ok:true,data:{kind:'COMPANY',entityId:second.client_id,
              users:[],subjectMode:'ADMIN_ENTITY',canImpersonate:true}})});
          return
        }
        await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:authority()})})
      });
      await page.route('http://rona.test/portal/agency-contracts**',r=>r.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:registry})}));
      await page.goto('http://rona.test/portal/admin?accessView=companies',{waitUntil:'load'});
      await page.addScriptTag({content:script});
      await page.waitForSelector('.ca-company-workspace .ca-company-choice',{timeout:12000});
      assert.equal(await page.locator('.ca-company-choice').count(),2);
      assert.equal(await page.locator('.ca-company-detail').count(),1);
      assert.equal(await page.locator('.ca-company-contract-row').count(),1);
      assert.equal(await page.locator('.ca-company-contract-row .rona-current-state.ready').count(),1);
      assert.equal(await page.locator('[data-rona-company-select="RONA-QA-C001"]').getAttribute('aria-pressed'),'true');
      const layout=await page.evaluate(()=>({
        viewport:window.innerWidth,body:document.documentElement.scrollWidth,
        workspace:document.querySelector('.ca-company-workspace')?.getBoundingClientRect().width
      }));
      assert(layout.body<=layout.viewport+2,'Companies workspace overflows '+JSON.stringify(layout));
      await page.locator('[data-rona-company-select="RONA-QA-C002"]').click();
      assert.equal(await page.locator('[data-rona-company-select="RONA-QA-C002"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.ca-company-profile .ca-agent-title').textContent(),second.legal_name);
      assert.equal(await page.locator('.ca-company-contract-row .rona-current-state.missing').count(),1);
      assert.equal(await page.locator('[data-rona-company-contract-attach="true"]').count(),1);
      assert.equal(await page.locator('.ca-company-rep-list .ca-agent-entry').count(),1);
      assert.equal(await page.locator('.ca-company-rep-list').innerText().then(x=>x.includes('QA Client Representative')),true);
      const chooserPromise=page.waitForEvent('filechooser');
      await page.locator('[data-rona-company-contract-attach="true"]').click();
      const chooser=await chooserPromise;
      await chooser.setFiles({name:'SIGNED_QA_C002.pdf',mimeType:'application/pdf',
        buffer:Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n%%EOF')});
      await page.locator('.ca-modal-backdrop').last().getByRole('button',{name:'Подтвердить'}).click();
      await page.waitForSelector('.ca-company-contract-row .rona-current-state.ready',{timeout:10000});
      assert.equal(await page.locator('[data-rona-company-contract-attach="true"]').count(),0);
      assert(mutations.some(m=>m.action==='signed-PDF'&&m.path.endsWith('/QA-CTR-002/signed-document/attach')&&m.hasPdf));
      const notice=page.locator('.ca-modal-backdrop').last();
      await notice.getByRole('button',{name:'Закрыть'}).click();
      assert.equal(await page.locator('.ca-company-agent-form select').count(),0,'Unknown agent registry must not imply edit rights');
      await page.getByRole('button',{name:'Загрузить реестр агентов'}).click();
      const agentSelect=page.getByRole('combobox',{name:'Агент компании'});
      await agentSelect.waitFor({state:'visible',timeout:10000});
      assert.equal(await agentSelect.count(),1);
      await agentSelect.selectOption('AGP-2026-001');
      await page.getByRole('button',{name:'Сохранить назначение'}).click();
      await page.waitForFunction(()=>document.querySelector('.ca-company-agent-name')?.textContent.includes('ИнКом'),null,{timeout:10000});
      assert(agentAssigned);
      assert(mutations.some(m=>m.action==='agent'&&m.path.endsWith('/RONA-QA-C002/agent')
        &&m.body.agentPersonId==='AGP-2026-001'));
      const assignmentNotice=page.locator('.ca-modal-backdrop').last();
      await assignmentNotice.getByRole('button',{name:'Закрыть'}).click();
      await page.getByRole('button',{name:'Опция',exact:true}).click();
      const optionsModal=page.locator('.ca-modal-backdrop').last();
      await page.waitForFunction(()=>[...document.querySelectorAll('.ca-modal-backdrop')].some(
        el=>el.textContent.includes('административном режиме просмотра')),null,{timeout:10000});
      assert((await optionsModal.innerText()).includes('административном режиме просмотра'));
      await optionsModal.getByRole('button',{name:'Закрыть'}).click();
      await page.getByRole('button',{name:'Открыть управление доступами'}).click();
      assert.equal(await page.getByRole('button',{name:'Пользователи и доступы'}).getAttribute('aria-pressed'),'true');
      assert.equal(await page.getByText('QA Client Representative',{exact:true}).count(),1);
      assert.deepEqual(errors,[]);
      assert.deepEqual(networkFailures,[]);
      await page.close()
    }
  }finally{await browser.close()}
});
