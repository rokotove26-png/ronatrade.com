import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {onRequest as uiResponse} from '../functions/portal/agent-rewards-v1-ui.js';
import {onRequest as pdfScriptResponse} from '../functions/portal/agent-reward-act-pdf-engine.js';

test('One-click PDF contract preserves canonical source hashes and protected issuance',async()=>{
  const renderer=await(await pdfScriptResponse()).text();
  const index=readFileSync('supabase/functions/rona-agent-reward-workflow/index.ts','utf8');
  const acts=readFileSync('supabase/functions/rona-agent-reward-workflow/acts.ts','utf8');
  const proxy=readFileSync('functions/portal/agent-reward-workflow.js','utf8');
  const ui=await(await uiResponse()).text();
  for(const sha of [
    'fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b',
    '7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085',
    '0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b'
  ])assert.match(renderer,new RegExp(sha));
  assert.match(renderer,/%PDF-1\.4/);
  assert.match(renderer,/\/\/ Exactly 35 x 35 mm/);
  assert.match(renderer,/ACT_PDF_SHIPMENT_MARGIN_SOURCE_REQUIRED/);
  assert.match(index,/DS1_50_PERCENT_SHIPMENT_MARGIN_RUB/);
  assert.match(acts,/ACT_DS1_BASE_CONTRACT_REFERENCE_UNRESOLVED/);
  assert.doesNotMatch(acts,/ACT_VERIFIED_NET_PROFIT_BASIS_REQUIRED/);
  assert.match(index,/ACT_OWNER_SIGNING_ATTESTATION_REQUIRED/);
  assert.match(index,/CANONICAL_SIGNING_ASSET_HASH_MISMATCH/);
  assert.match(acts,/ACT_FUNCTIONAL_CONCLUSIONS_UNCONFIRMED/);
  assert.match(acts,/ACT_FINANCE_SOURCE_SNAPSHOT_MISMATCH/);
  assert.match(acts,/ACT_SIGNED_ADDENDUM_TERM_NOT_CURRENT/);
  assert.match(acts,/ACT_VERIFIED_SHIPMENT_MARGIN_REQUIRED/);
  assert.match(acts,/ACT_SHIPMENT_CLOSING_DOCUMENTS_REQUIRED/);
  assert.doesNotMatch(acts,/ACT_VERIFIED_NET_PROFIT_BASIS_REQUIRED/);
  assert.match(acts,/canonicalAutomaticIssue/);
  assert.match(acts,/sha256:sha/);
  assert.match(proxy,/action==='final-act'/);
  assert.match(proxy,/canonical-signature.*canonical-seal/);
  assert.match(ui,/await saveCorrectionAndDownloadSignedAct\(deal,approved\)/);
  assert.match(ui,/OWNER_SECTION_SAVED_CALCULATION_V1/);
  assert.match(index,/ACT_OWNER_CORRECTION_SNAPSHOT_MISMATCH/);
  assert.match(index,/ACT_OWNER_DISPLAYED_ARITHMETIC_MISMATCH/);
  assert.match(index,/ownerCalculationStored/);
  assert.match(ui,/import\('\/portal\/agent-reward-act-pdf-engine'\)/);
  assert.match(ui,/agentActDownloadBlob\(pdf\.blob,pdf\.filename\)/);
  assert.doesNotMatch(ui,/const act=docButton\('Акт выполненных работ'/);
  assert.doesNotMatch(ui,/const request=docButton\('Подготовить акт'/);
});
test('Click Save correction → finalize → archive SHA-verified PDF → browser download, without extra button',async()=>{
  const {chromium}=await import('playwright');
  const script=await(await uiResponse()).text();
  const dealId='DEAL-2026-004',assignmentId='11111111-1111-4111-8111-111111111111';
  const requestId='a1111111-1111-4111-8111-111111111111';
  const documentId='d1111111-1111-4111-8111-111111111111';
  const pdfBytes='%PDF-1.4\n'+('RONA_ONE_CLICK_TEST'.repeat(375))+'\n%%EOF\n';
  const pdfHash=createHash('sha256').update(pdfBytes).digest('hex');
  const deal={
    dealId,assignmentId,clientName:'QA Покупатель',agentName:'Представитель агента',
    agentLegalEntityId:'S-005',agentLegalName:'ООО «ИнКом»',
    businessStatus:'ACTIVE',receiptCurrency:'USD',financialCurrency:'USD',
    cashFlow:{status:'APPROVED_CASH_FLOW_DDS',currency:'USD',cashReceived:5000,
      counterpartyCashOut:3000,bankFees:20,netCashFlow:1980},
    financeSourceReconciliation:{status:'RECONCILED_CURRENT_FINANCE_V8'},
    cashPaymentLines:[{paymentId:'PAYMENT-1',counterparty:'Подтверждённый поставщик',
      canonicalCounterpartyId:'SUPPLIER:QA',counterpartyResolutionStatus:'RESOLVED',
      amount:3000,currency:'USD'}],
    ownerResultBridge:{recognition_status:'APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
      open_settlement_adjustment:{amount:0}},
    ownerCorrectionAuthority:{status:'APPROVED_FOR_OWNER_CORRECTION',
      contract:'PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'},
    ownerCorrection:{version:3,createdAt:'2026-10-14T12:00:00.000Z',
      payload:{paymentLineAmounts:{},openSettlementAdjustment:0}},
    agentTerm:{mode:'PERCENT',rate:0.5,status:'ACTIVE',lifecycleState:'ACTIVE',
      authorityState:'CONFIRMED',reference:'Addendum 2'}
  };
  const doc={
    dealId,assignmentId,agentCompanyId:'S-005',agentLegalName:'ООО «ИнКом»',
    agentName:'Представитель агента',assignmentStatus:'ACTIVE',
    term:null,ownerConfirmedTerm:{mode:'PERCENT',rate:0.5,basis:'SHIPMENT_MARGIN',paymentCurrency:'RUB',
      status:'SIGNED_SOURCE_TEXT_PENDING_FINANCE_LEGAL'},
    sourceReadiness:{termAligned:false,accountingStatus:'OPEN'},
    currentAddendum:{bindingId:'b1111111-1111-4111-8111-111111111111',
      documentId:'AGENCY-S-005-A1B2C3D4',filename:'Signed_QA.pdf',
      reference:'ДС №1 от 15.07.2026',ownerApprovedByUpload:true,
      sha256:'e12c2e1f7527ed58a07e081396be9d2b51401d42558be8b3ba7c7be5e9431bab'},
    ownerCorrection:{sourceId:'c1111111-1111-4111-8111-111111111111',version:3},
    acts:[]
  };
  const approved={
    requestId,dealId,documentNumber:'ACT-QA-001',documentDate:'2026-10-16',
    servicePeriod:'2026-10',services:'Агентские услуги',amount:891,currency:'RUB',
    issuer:'RONA Trade',issuerSigner:'Уполномоченный представитель',
    issuerRequisites:'Юридические реквизиты из Legal',
    signingPlace:'Минск',agentLegalName:'ООО «ИнКом»',agentSignatory:'Подписант агента',
    addendumReference:'ДС №1 от 15.07.2026',
    shipmentMarginSource:{basis:'SHIPMENT_MARGIN',margin:1782,marginCurrency:'RUB',rate:0.5,
      factoryDocumentRef:'FACTORY-QA',guDocumentRef:'GU-QA',exchangeRate:null,
      exchangeRateSourceRef:null,settlementNote:'Оплата в RUB по курсу ЦБ РФ на дату оплаты'},
    facsimileAuthorizationRef:'Owner canonical authorization',
    documentStandard:'RONA-DOC-STANDARD v2',
    signatureMethod:'OWNER_APPROVED_GRAPHIC_FACSIMILE_NOT_QES'
  };
  const actions=[];
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:920},acceptDownloads:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://localhost/portal/admin',r=>r.fulfill({status:200,
      contentType:'text/html',body:'<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><main id="page-agent-settlements" class="page active"></main></body></html>'}));
    await page.route('http://localhost/portal/owner-api**',async r=>{
      let data={deals:[deal]};
      if(r.request().method()==='POST'){
        actions.push('save');
        const input=JSON.parse(r.request().postData()||'{}');
        data={accepted:true,dealId,assignmentId,version:3,
          correctedPayload:input.correctedPayload};
      }
      await r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({ok:true,data})});
    });
    await page.route('http://localhost/portal/agent-reward-act-pdf-engine',r=>r.fulfill({
      status:200,contentType:'application/javascript',
      body:'window.RONA_AGENT_ACT_PDF_ENGINE={render:async function(data,id){if(id!=="'+requestId+'")throw Error("wrong request");'+
        'if(data.dealId!=="'+dealId+'")throw Error("wrong deal");'+
        'return {blob:new Blob(['+JSON.stringify(pdfBytes)+'],{type:"application/pdf"}),'+
        'filename:"RONA_Act_DEAL-2026-004_ACT-QA-001.pdf"}}};'
    }));
    await page.route('http://localhost/portal/agent-reward-workflow**',async r=>{
      const u=new URL(r.request().url()),action=u.searchParams.get('action')||'state';
      let data=doc;
      if(action==='request-act'){
        actions.push('request-act');
        const payload=JSON.parse(r.request().postData()||'{}');
        const approved=payload.ownerApprovedCalculation;
        assert.equal(approved.contract,'OWNER_SECTION_SAVED_CALCULATION_V1');
        assert.equal(approved.dealId,dealId);
        assert.equal(approved.assignmentId,assignmentId);
        assert.equal(approved.correctionVersion,3);
        assert.equal(approved.sourceKind,'OWNER_APPROVED_SECTION_AT_SAVE_NOT_FINANCE_PAYABLE');
        assert.equal(approved.currency,'USD');
        assert.equal(typeof approved.netProfit,'number');
        assert.equal(typeof approved.income,'number');
        assert.equal(typeof approved.expenses,'number');
        assert.equal(approved.reward,null,'Unapproved signed DS must not fabricate payable');
        doc.acts=[{id:requestId,owner_correction_key:doc.ownerCorrection.sourceId,
          addendum_key:doc.currentAddendum.bindingId,correction_version:3,
          request_status:'REVIEW_REQUESTED',review:{approved:true},
          ownerCalculationStored:true,ownerCalculationVersion:3,
          readiness:{missing:[]},documents:[]}];
        data={requestId,status:'REVIEW_REQUESTED',ownerCalculationStored:true};
      }else if(action==='final-act'){
        actions.push('final-act');
        assert.equal(u.searchParams.get('requestId'),requestId);
        assert.deepEqual(JSON.parse(r.request().postData()||'{}'),
          {ownerConfirmsSigning:true,ownerConfirmsFacsimile:true});
        data=approved;
      }else if(action==='upload-act'){
        actions.push('upload-act');
        assert.equal(u.searchParams.get('requestId'),requestId);
        assert.equal(u.searchParams.get('stage'),'OWNER_SIGNED');
        const body=r.request().postDataBuffer();
        assert(body.includes(Buffer.from('%PDF-1.4')));
        assert(body.includes(Buffer.from('canonicalAutomaticIssue')));
        data={documentId,sha256:pdfHash,filename:'RONA_Act_DEAL-2026-004_ACT-QA-001.pdf'};
        doc.acts[0].documents=[{stage:'OWNER_SIGNED',documentId,filename:data.filename}];
      }else if(action==='download-act'){
        actions.push('download-act');
        assert.equal(u.searchParams.get('requestId'),requestId);
        assert.equal(u.searchParams.get('documentId'),documentId);
        data={url:'https://storage.example.test/RONA_Act_DEAL-2026-004_ACT-QA-001.pdf'};
      }
      await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
    });
    await page.goto('http://localhost/portal/admin');
    await page.addScriptTag({content:script});
    await page.locator('.rona-ar-documents').getByText('ДС загружено и привязано к сделке')
      .waitFor({timeout:12000});
    assert.equal(await page.getByRole('button',{name:'Подготовить акт'}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Акт выполненных работ',exact:true}).count(),0);
    const button=page.locator('.rona-ar-col.owner').getByRole('button',{name:'Сохранить корректировку'});
    let download;
    try{[download]=await Promise.all([page.waitForEvent('download',{timeout:15000}),button.click()])}
    catch(e){throw new Error(String(e.message||e)+'; actual_sequence='+JSON.stringify(actions)+
      '; browser_errors='+JSON.stringify(errors)+
      '; dialog='+JSON.stringify(await page.locator('.rona-admin-dialog-backdrop').allInnerTexts()))}
    assert.equal(download.suggestedFilename(),'RONA_Act_DEAL-2026-004_ACT-QA-001.pdf');
    assert.equal(await download.failure(),null);
    assert.deepEqual(actions,['save','request-act','final-act','upload-act','download-act']);
    assert.deepEqual(errors,[]);
    await page.close();
  }finally{await browser.close()}
});
