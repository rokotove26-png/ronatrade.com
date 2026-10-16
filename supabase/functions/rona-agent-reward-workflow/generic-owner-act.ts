// A direct Owner act is a controlled declaration, not AI Finance/Legal consent.
function reject(code:string):never{throw Object.assign(new Error(code),{status:409})}
const number=(v:any,code:string)=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e13)reject(code);return v};
const money=(v:number)=>Math.round((v+Number.EPSILON)*10)/10;
const str=(v:any)=>String(v??'').trim();
export function checkedGenericOwnerDeclaration(row:any,document:any){
 const snap=row?.source_snapshot?.ownerApprovedCalculation||{},c=snap.calculation||{};
 const declaration=snap.ownerActDeclaration||{};
 if(row?.deal_id==='DEAL-2026-004')reject('ACT_OWNER_GENERIC_DS1_SEPARATE');
 if(declaration.contract!=='RONA_OWNER_AGENCY_ACT_DECLARATION_V1'
   ||declaration.authority!=='OWNER_ACT_BUTTON_APPROVAL'
   ||declaration.createsPayable!==false
   ||str(declaration.dealId)!==str(row.deal_id)
   ||str(declaration.assignmentId)!==str(row.assignment_id)
   ||str(declaration.addendumDocumentId)!==str(document.document_id)
   ||str(declaration.addendumBindingId)!==str(row.addendum_key)
   ||str(declaration.addendumSha256).toLowerCase()!==str(document.sha256).toLowerCase()
   ||!/^[0-9a-f]{64}$/i.test(str(declaration.addendumSha256))
   ||str(declaration.currency)!==str(snap.currency))
   reject('ACT_OWNER_DECLARATION_DOCUMENT_SCOPE_MISMATCH');
 const keys=['income','expenses','actualFinancialResult','taxes','netProfit','reward','ronaProfit'];
 keys.forEach(k=>number(c[k],'ACT_OWNER_DECLARATION_CALCULATION_MISSING'));
 const a=number(c.reward,'ACT_OWNER_DECLARATION_AMOUNT_MISSING');
 if(a<0||c.income<0||c.expenses<0
   ||Math.abs(money(c.income-c.expenses)-money(c.actualFinancialResult))>.21
   ||Math.abs(money(c.actualFinancialResult-c.taxes)-money(c.netProfit))>.21
   ||Math.abs(money(c.netProfit-a)-money(c.ronaProfit))>.21
   ||Math.abs(money(Number(declaration.amount))-money(a))>.11)
   reject('ACT_OWNER_DECLARATION_ARITHMETIC_MISMATCH');
 if(!/^[A-Z]{3}$/.test(str(snap.currency)))reject('ACT_OWNER_DECLARATION_CURRENCY_INVALID');
 if(document.is_current!==true||document.storage_state!=='VERIFIED'
   ||str(document.document_reference)!==str(declaration.addendumReference)
   ||!str(document.legal_name)||!str(document.registration_country)
   ||!str(document.registered_address))
   reject('ACT_OWNER_DECLARATION_VERIFIED_SOURCE_MISSING');
 return{amount:a,currency:snap.currency,calculation:c,source:declaration}
}
export function genericOwnerActPayload(row:any,doc:any){
 const data=checkedGenericOwnerDeclaration(row,doc),v=Number(row.correction_version);
 const number='RT-ACT-'+str(row.deal_id).replace(/^DEAL-/,'')+
  '-A'+str(row.assignment_id).replace(/-/g,'').slice(0,6).toUpperCase()+
  '-C'+String(v).padStart(3,'0');
 const source='OWNER_SAVED_CORRECTION:'+str(row.owner_correction_key);
 const date=new Date(row.requested_at||Date.now()).toISOString().slice(0,10);
 const services='Агентские услуги в рамках сделки '+str(row.deal_id)+
  ' в соответствии с '+str(doc.document_reference);
 const sourceNote='Подписанное ДС: '+str(doc.document_reference)+
  '; SHA-256: '+str(doc.sha256);
 return{
  requestId:row.id,dealId:row.deal_id,documentNumber:number,documentDate:date,
  signingPlace:'г. Бишкек',
  issuer:'Общество с ограниченной ответственностью «РОНА Трейд»',
  issuerSigner:'Генеральный директор Юсупов Марат Махмудович',
  issuerRequisites:'ИНН 02104202510169; регистрационный номер 315370-3301-ООО; Кыргызская Республика, г. Бишкек, ул. Гоголя, д. 109, кв. 50',
  agentLegalName:str(doc.legal_name),
  agentSignatory:'Уполномоченный представитель (подпись агента отсутствует)',
  agentTaxId:str(doc.tax_identifier||'Уточняется по подписанному ДС'),
  agentAddress:str(doc.registered_address),agentCountry:str(doc.registration_country),
  services,servicePeriod:'По сделке '+str(row.deal_id),
  addendumReference:str(doc.document_reference),addendumDocumentId:str(doc.document_id),
  amount:data.amount,currency:data.currency,
  financialAppendix:{
   contract:'RONA_OWNER_AGENT_ACT_APPENDIX_V1',
   dealId:str(row.deal_id),correctionVersion:v,
   correctionId:str(row.owner_correction_key),currency:data.currency,
   agentReward:data.amount,ownerCalculation:data.calculation,
   signedAddendumId:str(doc.document_id),signedAddendumHash:str(doc.sha256),
   signedAddendumReference:str(doc.document_reference),
   sourceKind:'OWNER_APPROVED_SECTION_NOT_FINANCE_PAYABLE',
   sourceRef:source,
   ownerApprovedAmount:true,createsPayable:false
  },
  ownerSectionCalculation:data.calculation,ownerSectionCorrectionVersion:v,
  financeEvidence:source,legalEvidence:'OWNER_SIGNED_ADDENDUM:'+str(doc.sha256),
  financeSourceRef:source,
  facsimileAuthorizationRef:'OWNER_ACT_BUTTON_V'+v+'_RONA_DOC_STANDARD_V2',
  documentStandard:'RONA-DOC-STANDARD v2',
  signatureMethod:'OWNER_APPROVED_GRAPHIC_FACSIMILE_NOT_QES',
  signatureScope:'PRINCIPAL_ONLY__AGENT_NOT_SIGNED',
  createsPayable:false,sourceMode:'OWNER_SIGNED_SECTION_NOT_FINANCE_PAYABLE',
  ownerDeclarationSource:sourceNote
 }
}
