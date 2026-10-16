// Authorized Owner's one-click signature on exact signed DS1 only.
// No fake Finance/Legal approvals, external payable or Agent signature.
const DS='e12c2e1f7527ed58a07e081396be9d2b51401d42558be8b3ba7c7be5e9431bab';
function reject(code:string,status=409):never{throw Object.assign(new Error(code),{status})}
const rounded=(x:number)=>Math.round((x+Number.EPSILON)*10)/10;
export function ownerActCandidate(row:any){
 const x=row?.source_snapshot?.ownerApprovedCalculation;
 return row?.deal_id==='DEAL-2026-004'&&x?.contract==='OWNER_SECTION_SAVED_CALCULATION_V1'
  &&x?.sourceKind==='OWNER_APPROVED_SECTION_AT_SAVE_NOT_FINANCE_PAYABLE'
  &&x?.createsPayable===false&&x?.signingAuthority===false
  &&x?.rewardStatus==='OWNER_DS1_SHIPMENT_MARGIN_SAVED_SECTION'
  &&String(x?.correctionId)===String(row?.owner_correction_key)
  &&Number(x?.correctionVersion)===Number(row?.correction_version)
}
export function checkedOwnerActAmounts(row:any){
 if(!ownerActCandidate(row))reject('ACT_OWNER_DIRECT_NOT_APPLICABLE');
 const a=row.source_snapshot.ownerApprovedCalculation,c=a.calculation||{};
 const keys=['income','expenses','actualFinancialResult','taxes','netProfit','reward','ronaProfit'];
 if(keys.some(k=>typeof c[k]!=='number'||!Number.isFinite(c[k])))
   reject('ACT_OWNER_DIRECT_REWARD_NOT_SAVED');
 const margin=c.actualFinancialResult,amount=c.reward;
 if(c.income<0||c.expenses<0||amount<0||
   Math.abs(margin-(c.income-c.expenses))>.21||
   Math.abs(c.netProfit-(margin-c.taxes))>.21||
   Math.abs(c.ronaProfit-(c.netProfit-amount))>.21||
   Math.abs(amount-rounded(Math.max(0,margin)*.5))>.11)
   reject('ACT_OWNER_DIRECT_MARGIN_MISMATCH');
 if(!/^[A-Z]{3}$/.test(String(a.currency||'')))reject('ACT_OWNER_DIRECT_CURRENCY_INVALID');
 return{margin,amount,currency:a.currency};
}
export async function ownerSignedActIssue(sql:any,ctx:any,row:any){
 if(!ownerActCandidate(row)||String(row.requested_by)!==String(ctx.userId))
   reject('ACT_OWNER_DIRECT_ISSUE_NOT_AUTHORIZED',403);
 const owners=await sql`select distinct owner_portal_user_id from portal_private.mcp_oauth_tokens where owner_portal_user_id is not null limit 2`;
 if(owners.length!==1||String(owners[0].owner_portal_user_id)!==String(ctx.userId))
   reject('ACT_OWNER_DIRECT_ISSUE_NOT_AUTHORIZED',403);
 const m=checkedOwnerActAmounts(row);
 const saved=await sql`select id,created_by,correction_version from portal_private.agent_reward_owner_corrections_v1
   where deal_key=${row.deal_key}::uuid and assignment_id=${row.assignment_id}::uuid
   order by correction_version desc limit 1`;
 if(saved.length!==1||String(saved[0].id)!==String(row.owner_correction_key)
   ||String(saved[0].created_by)!==String(ctx.userId)
   ||Number(saved[0].correction_version)!==Number(row.correction_version))
   reject('ACT_OWNER_DIRECT_CORRECTION_SUPERSEDED');
 const docs=await sql`select a.document_id,a.sha256,a.uploaded_by,b.linked_by,b.document_reference,
  b.is_current,o.storage_state,l.legal_name
  from portal_private.agent_reward_deal_addenda_v1 b
  join portal_private.agent_agency_contract_documents a on a.id=b.agency_document_key
  join portal_private.storage_objects o on o.id=a.storage_object_key
  join portal_private.agent_legal_entities l on l.id=b.agent_legal_entity_key
  where b.id=${row.addendum_key}::uuid and b.deal_key=${row.deal_key}::uuid
    and b.assignment_id=${row.assignment_id}::uuid limit 2`;
 const d=docs[0];
 if(docs.length!==1||d.is_current!==true||d.storage_state!=='VERIFIED'
   ||d.sha256!==DS||d.document_id!=='AGENCY-S-005-945CF175'
   ||String(d.uploaded_by)!==String(ctx.userId)
   ||String(d.linked_by)!==String(ctx.userId)
   ||!/^ДС\s*№\s*1\b/i.test(String(d.document_reference||'')))
   reject('ACT_OWNER_DIRECT_DOC_SOURCE_DENIED');
 if(!['REVIEW_REQUESTED','FINANCE_LEGAL_REVIEW','DRAFT_READY','OWNER_SIGNED']
   .includes(String(row.request_status)))reject('ACT_OWNER_DIRECT_STATUS_INVALID');
 const ver=Number(row.correction_version),source='OWNER_SAVED_CORRECTION:'+String(row.owner_correction_key);
 const num='RT-ACT-2026-004-C'+String(ver).padStart(3,'0');
 const date=new Date(row.requested_at||Date.now()).toISOString().slice(0,10);
 // Signed PDF SHA locked metadata, not inferred from other deal addenda.
 return{
  requestId:row.id,dealId:row.deal_id,documentNumber:num,documentDate:date,
  signingPlace:'г. Бишкек',
  issuer:'Общество с ограниченной ответственностью «РОНА Трейд»',
  issuerSigner:'Генеральный директор Юсупов Марат Махмудович',
  issuerRequisites:'ИНН 02104202510169; регистрационный номер 315370-3301-ООО; Кыргызская Республика, г. Бишкек, ул. Гоголя, д. 109, кв. 50',
  agentLegalName:d.legal_name,agentSignatory:'Генеральный директор Токарев Илья Игоревич',
  agentTaxId:'ИНН 3664232477, КПП 366401001, ОГРН 1173668062061',
  agentAddress:'394055, г. Воронеж, ул. Моисеева, д. 65, кв. 7',
  agentCountry:'Российская Федерация',
  services:'Привлечение покупателя — ООО «FARG’ONA GAZ TO’LDIRISH STANSIYASI» — для поставки 315 тонн смеси пропана и бутана технических.',
  servicePeriod:'По сделке DEAL-2026-004, ДС №1 от 15.07.2026',
  addendumReference:'ДС №1 от 15.07.2026 к агентскому договору №351С/2026 от 07.05.2026',
  amount:m.amount,currency:m.currency,
  shipmentMarginSource:{
   basis:'SHIPMENT_MARGIN',margin:m.margin,marginCurrency:m.currency,rate:.5,
   basisSourceKind:'OWNER_APPROVED_SECTION',
   ownerCorrectionId:row.owner_correction_key,ownerCorrectionVersion:ver,
   factoryDocumentRef:null,guDocumentRef:null,exchangeRate:null,exchangeRateSourceRef:null,
   settlementNote:'Расчёт по сохранённой корректировке владельца. Оплата в рублях по курсу ЦБ РФ на дату фактической оплаты.'
  },
  ownerSectionCalculation:row.source_snapshot.ownerApprovedCalculation.calculation,
  ownerSectionCorrectionVersion:ver,
  financeEvidence:source,legalEvidence:'SIGNED_AGENT_DS1:'+DS,
  financeSourceRef:source,facsimileAuthorizationRef:'OWNER_SAVE_CORRECTION_V'+ver+'_RONA_DOC_STANDARD_V2',
  documentStandard:'RONA-DOC-STANDARD v2',
  signatureMethod:'OWNER_APPROVED_GRAPHIC_FACSIMILE_NOT_QES',
  signatureScope:'PRINCIPAL_ONLY__AGENT_NOT_SIGNED',
  createsPayable:false,sourceMode:'OWNER_SIGNED_SECTION_NOT_FINANCE_PAYABLE'
 }
}
