import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerActCandidate,checkedOwnerActAmounts,ownerSignedActIssue}
  from '../supabase/functions/rona-agent-reward-workflow/owner-signed-act.ts';
import {checkedGenericOwnerDeclaration,genericOwnerActPayload,genericOwnerActIssue}
  from '../supabase/functions/rona-agent-reward-workflow/generic-owner-act.ts';

const OWNER='c1111111-1111-4111-8111-111111111111';
const DS='AGENCY-S-010-ABCD1234';
const SHA='a'.repeat(64);
const REQUEST='a1111111-1111-4111-8111-111111111111';
const ASSIGNMENT='b1111111-1111-4111-8111-111111111111';
const CORRECTION='d1111111-1111-4111-8111-111111111111';
const BINDING='e1111111-1111-4111-8111-111111111111';
function fixture(dealId='DEAL-2026-010',reward=400){
 const calc={income:5000,expenses:3500,actualFinancialResult:1500,taxes:150,
   netProfit:1350,reward,ronaProfit:1350-reward};
 const declaration={contract:'RONA_OWNER_AGENCY_ACT_DECLARATION_V1',
   authority:'OWNER_ACT_BUTTON_APPROVAL',createsPayable:false,
   dealId,assignmentId:ASSIGNMENT,addendumDocumentId:DS,
   addendumBindingId:BINDING,addendumSha256:SHA,
   addendumReference:'ДС № 4 от 02.09.2026',amount:reward,currency:'USD'};
 const row={id:REQUEST,deal_id:dealId,
   deal_key:'f1111111-1111-4111-8111-111111111111',
   assignment_id:ASSIGNMENT,agent_legal_entity_key:'11111111-1111-4111-8111-111111111111',
   owner_correction_key:CORRECTION,correction_version:3,
   addendum_key:BINDING,requested_by:OWNER,
   requested_at:'2026-10-16T10:00:00Z',request_status:'REVIEW_REQUESTED',
   source_snapshot:{ownerApprovedCalculation:{
     contract:'OWNER_SECTION_SAVED_CALCULATION_V1',
     sourceKind:'OWNER_APPROVED_SECTION_AT_SAVE_NOT_FINANCE_PAYABLE',
     createsPayable:false,signingAuthority:false,
     correctionId:CORRECTION,correctionVersion:3,currency:'USD',
     ownerActDeclaration:declaration,calculation:calc
   }}};
 const doc={document_id:DS,sha256:SHA,uploaded_by:OWNER,linked_by:OWNER,
   document_reference:declaration.addendumReference,
   is_current:true,storage_state:'VERIFIED',
   legal_name:'Независимый агент',tax_identifier:'УНП-010',
   registered_address:'Подтверждённый адрес',registration_country:'Беларусь'};
 return {row,doc};
}
test('Owner is sole Act authorization across independently scoped deals',()=>{
 for(const dealId of ['DEAL-2026-010','DEAL-2026-011','DEAL-2027-050']){
   const {row,doc}=fixture(dealId);
   assert.equal(ownerActCandidate(row),true);
   assert.deepEqual(checkedOwnerActAmounts(row),{margin:1500,amount:400,currency:'USD'});
   assert.equal(checkedGenericOwnerDeclaration(row,doc).amount,400);
   const result=genericOwnerActPayload(row,doc);
   assert.equal(result.dealId,dealId);
   assert.equal(result.sourceMode,'OWNER_SIGNED_SECTION_NOT_FINANCE_PAYABLE');
   assert.equal(result.financialAppendix.contract,'RONA_OWNER_AGENT_ACT_APPENDIX_V1');
   assert.equal(result.financialAppendix.agentReward,400);
   assert.equal(result.financialAppendix.createsPayable,false);
   assert.equal(result.createsPayable,false);
   assert.equal(result.signatureScope,'PRINCIPAL_ONLY__AGENT_NOT_SIGNED');
   assert.equal(result.agentLegalName,doc.legal_name);
   assert.match(result.documentNumber,/^RT-ACT-20/);
 }
});
test('Fail closed on cross-deal DS, wrong correction amount, forged SHA or unverified archive',()=>{
 const {row,doc}=fixture();
 const wrongDeal=structuredClone(row);wrongDeal.deal_id='DEAL-2026-011';
 assert.throws(()=>checkedGenericOwnerDeclaration(wrongDeal,doc),/DOCUMENT_SCOPE_MISMATCH/);
 const wrongBinding=structuredClone(doc);wrongBinding.sha256='b'.repeat(64);
 assert.throws(()=>checkedGenericOwnerDeclaration(row,wrongBinding),/DOCUMENT_SCOPE_MISMATCH/);
 const missingArchive={...doc,storage_state:'TO_VERIFY'};
 assert.throws(()=>checkedGenericOwnerDeclaration(row,missingArchive),/VERIFIED_SOURCE_MISSING/);
 const wrongAmount=structuredClone(row);
 wrongAmount.source_snapshot.ownerApprovedCalculation.calculation.reward=600;
 assert.throws(()=>checkedGenericOwnerDeclaration(wrongAmount,doc),/ARITHMETIC_MISMATCH/);
 const missing=structuredClone(row);delete missing.source_snapshot.ownerApprovedCalculation.ownerActDeclaration;
 assert.equal(ownerActCandidate(missing),false);
});
test('Direct Owner issue uses signed addendum, saved correction and Owner identity, never AI conclusions',async()=>{
 const {row,doc}=fixture();
 const statements=[];
 const sql=async(parts,...args)=>{
   const q=parts.join(' ');statements.push(q);
   if(q.includes('mcp_oauth_tokens'))return[{owner_portal_user_id:OWNER}];
   if(q.includes('agent_reward_owner_corrections_v1'))
     return[{id:CORRECTION,created_by:OWNER,correction_version:3}];
   if(q.includes('agent_reward_deal_addenda_v1'))return[doc];
   throw Error('unexpected database call '+q.slice(0,80));
 };
 const output=await ownerSignedActIssue(sql,{userId:OWNER},row);
 assert.equal(output.amount,400);
 assert.equal(output.financialAppendix.agentReward,400);
 assert.equal(output.documentNumber,'RT-ACT-2026-010-AB11111-C003');
 assert.equal(statements.some(q=>q.includes('ai_coordination_records')),false);
 await assert.rejects(()=>ownerSignedActIssue(sql,{userId:'another-owner'},row),
   /ACT_OWNER_DIRECT_ISSUE_NOT_AUTHORIZED/);
 const unowned=async(parts,...args)=>{
   const q=parts.join(' ');
   if(q.includes('agent_reward_deal_addenda_v1'))
     return[{...doc,uploaded_by:'other-user'}];
   return sql(parts,...args);
 };
 await assert.rejects(()=>ownerSignedActIssue(unowned,{userId:OWNER},row),
   /ACT_OWNER_GENERIC_SIGNED_ADDENDUM_DENIED/);
});
test('Act code enforces request-scoped attestation, canonical signing assets and two real pages',()=>{
 const acts=readFileSync(new URL('../supabase/functions/rona-agent-reward-workflow/acts.ts',import.meta.url),'utf8');
 const index=readFileSync(new URL('../supabase/functions/rona-agent-reward-workflow/index.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../functions/portal/agent-rewards-v1-ui.js',import.meta.url),'utf8');
 const pdf=readFileSync(new URL('../functions/portal/agent-reward-act-pdf-engine.js',import.meta.url),'utf8');
 assert.match(acts,/metadata->>'requestId'/);
 assert.match(index,/metadata->>'requestId'/);
 assert.match(index,/ACT_OWNER_DECLARATION_SOURCE_INVALID/);
 assert.match(index,/ownerActDeclaration/);
 assert.match(acts,/if\(ownerActCandidate\(row\)\)return await ownerSignedActIssue/);
 assert.match(acts,/canonicalAutomatic&&ownerActCandidate/);
 assert.match(ui,/ownerActDeclaration\(deal,model,currency\)/);
 assert.match(ui,/if\(pdf.pageCount!==2\)/);
 assert.match(pdf,/appendOwnerCanvas\(d.financialAppendix/);
 assert.match(pdf,/RONA_OWNER_AGENT_ACT_APPENDIX_V1/);
 assert.match(pdf,/const canvases=\[canvas\]/);
});

test('Click generates and archives two-page Owner Act on another deal without AI approvals',async()=>{
 const {chromium}=await import('playwright');
 const {createHash}=await import('node:crypto');
 const {onRequest}=await import('../functions/portal/agent-rewards-v1-ui.js');
 const script=await(await onRequest()).text();
 const pdf='%PDF-1.4\n'+('GENERIC_OWNER_ACT_TEST'.repeat(400))+'\n%%EOF';
 const sha=createHash('sha256').update(pdf).digest('hex');
 const dealId='DEAL-2026-010',assignmentId=ASSIGNMENT,requestId=REQUEST;
 const docId='99999999-1111-4111-8111-111111111111';
 const deal={dealId,assignmentId,clientName:'Покупатель 010',agentName:'Агент 010',
   agentLegalName:'Независимый агент',businessStatus:'ACTIVE',
   financialCurrency:'USD',receiptCurrency:'USD',
   cashFlow:{status:'APPROVED_CASH_FLOW_DDS',currency:'USD',
     cashReceived:5000,counterpartyCashOut:3500,bankFees:0,netCashFlow:1500},
   financeSourceReconciliation:{status:'RECONCILED_CURRENT_FINANCE_V8'},
   cashPaymentLines:[{paymentId:'PAYMENT-010',counterparty:'Поставщик',
     canonicalCounterpartyId:'SUPPLIER:010',counterpartyResolutionStatus:'RESOLVED',
     amount:3500,currency:'USD'}],
   ownerResultBridge:{recognition_status:'APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
     open_settlement_adjustment:{amount:0}},
   ownerCorrectionAuthority:{status:'APPROVED_FOR_OWNER_CORRECTION',
     contract:'PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'},
   ownerCorrection:{version:3,payload:{paymentLineAmounts:{'PAYMENT-010':3500},
     openSettlementAdjustment:0}},
   agentTerm:{mode:'FIXED',status:'ACTIVE',lifecycleState:'ACTIVE',
     authorityState:'CONFIRMED',fixedAmount:400,currency:'USD',
     reference:'ДС №4 от 02.09.2026'}
 };
 const documents={dealId,assignmentId,agentCompanyId:'S-010',
   agentLegalName:'Независимый агент',agentName:'Агент 010',
   sourceReadiness:{termAligned:false,accountingStatus:'OPEN'},
   currentAddendum:{bindingId:BINDING,documentId:DS,reference:'ДС №4 от 02.09.2026',
     ownerApprovedByUpload:true,sha256:SHA,filename:'Signed_DS4.pdf'},
   ownerCorrection:{sourceId:CORRECTION,version:3},acts:[]};
 const browser=await chromium.launch({headless:true});
 try{
   const page=await browser.newPage({acceptDownloads:true});
   const actions=[],errors=[],dialogs=[];
   page.on('dialog',d=>{dialogs.push(d.message());d.accept(d.type()==='prompt'?'400':undefined)});
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://rona.owner/portal/admin',r=>r.fulfill({status:200,
     contentType:'text/html',body:'<!doctype html><html><body><main id="page-agent-settlements" class="page active"></main></body></html>'}));
   await page.route('http://rona.owner/portal/owner-api**',r=>r.fulfill({
     contentType:'application/json',body:JSON.stringify({ok:true,data:{deals:[deal]}})}));
   await page.route('http://rona.owner/portal/agent-reward-act-pdf-engine',r=>r.fulfill({
     contentType:'application/javascript',body:
       'window.RONA_AGENT_ACT_PDF_ENGINE={render:async function(data,id){'+
       'if(data.dealId!=="'+dealId+'"||id!=="'+requestId+'")throw Error("wrong scope");'+
       'return {blob:new Blob(['+JSON.stringify(pdf)+'],{type:"application/pdf"}),'+
       'pageCount:2,filename:"Owner_Act_010.pdf"}}};'}));
   await page.route('http://rona.owner/portal/agent-reward-workflow**',r=>{
     const url=new URL(r.request().url());
     const action=url.searchParams.get('action')||'state';
     let data=documents;
     if(action==='request-act'){
       actions.push(action);
       const x=JSON.parse(r.request().postData()||'{}').ownerApprovedCalculation;
       assert.equal(x.dealId,dealId);
       assert.equal(x.assignmentId,assignmentId);
       assert.equal(x.ownerActDeclaration?.contract,'RONA_OWNER_AGENCY_ACT_DECLARATION_V1');
       assert.equal(x.ownerActDeclaration?.addendumSha256,SHA);
       assert.equal(x.ownerActDeclaration?.amount,x.reward);
       assert.equal(x.ownerActDeclaration?.createsPayable,false);
       documents.acts=[{id:requestId,request_status:'REVIEW_REQUESTED',
         correction_version:3,owner_correction_key:CORRECTION,
         ownerCalculationStored:true,ownerCalculationVersion:3,ownerSignReady:true,
         review:{approved:false,finance:{status:'PENDING'},legal:{status:'PENDING'}},
         readiness:{missing:['FINANCE_CONCLUSION_REQUIRED','LEGAL_CONCLUSION_REQUIRED']},
         documents:[]}];
       data={requestId,ownerCalculationStored:true};
     }
     if(action==='final-act'){
       actions.push(action);
       assert.deepEqual(JSON.parse(r.request().postData()||'{}'),
         {ownerConfirmsSigning:true,ownerConfirmsFacsimile:true});
       data={dealId,sourceMode:'OWNER_SIGNED_SECTION_NOT_FINANCE_PAYABLE',
         financialAppendix:{contract:'RONA_OWNER_AGENT_ACT_APPENDIX_V1'}};
     }
     if(action==='upload-act'){
       actions.push(action);
       assert.equal(url.searchParams.get('stage'),'OWNER_SIGNED');
       assert(r.request().postDataBuffer().includes(Buffer.from('canonicalAutomaticIssue')));
       data={documentId:docId,sha256:sha,filename:'Owner_Act_010.pdf'};
     }
     if(action==='download-act'){
       actions.push(action);data={url:'https://storage.example.test/Owner_Act_010.pdf'};
     }
     return r.fulfill({contentType:'application/json',
       body:JSON.stringify({ok:true,data})});
   });
   await page.goto('http://rona.owner/portal/admin');
   await page.addScriptTag({content:script});
   const button=page.locator('.rona-ar-documents')
     .getByRole('button',{name:'Сформировать и скачать акт'});
   await button.waitFor({timeout:12000});
   let download;
   try{[download]=await Promise.all([page.waitForEvent('download',{timeout:8000}),button.click()])}
   catch(e){throw new Error('Generic Owner Act failure: '+String(e.message||e)+
     '; calls='+JSON.stringify(actions)+'; errors='+JSON.stringify(errors)+'; dialogs='+JSON.stringify(dialogs)+
     '; notices='+JSON.stringify(await page.locator('.rona-admin-dialog-backdrop').allInnerTexts())+
     '; documents='+JSON.stringify(await page.locator('.rona-ar-documents').allInnerTexts()))}
   assert.equal(download.suggestedFilename(),'Owner_Act_010.pdf');
   assert.deepEqual(actions,['request-act','final-act','upload-act','download-act']);
   assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
