// ADMIN-only, single-click, local PDF renderer for verified RONA Trade Agent Acts.
// Assets come from authenticated canonical endpoints and MUST match approved hashes.
// Emits a real A4 PDF Blob; no browser print dialog and no external scripts/fonts.
function ronaActPdfRuntime(){
  'use strict';
  if(window.RONA_AGENT_ACT_PDF_ENGINE)return;
  const W=2480,H=3508,MM=W/210,LEFT=23*MM,RIGHT=W-23*MM,WIDTH=RIGHT-LEFT;
  const HASHES=Object.freeze({
    'canonical-letterhead':'fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b',
    'canonical-signature':'7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085',
    'canonical-seal':'0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b'
  });
  const safe=v=>String(v==null?'':v).trim();
  function needed(v,label){if(!safe(v)||/^(?:TO_VERIFY|UNKNOWN|N\/A)$/i.test(safe(v)))throw new Error('ACT_PDF_MISSING_'+label);return safe(v)}
  function dateRu(v){const s=needed(v,'DATE');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new Error('ACT_PDF_INVALID_DATE');return s.slice(8)+'.'+s.slice(5,7)+'.'+s.slice(0,4)}
  function drawContain(ctx,img,x,y,w,h){
    const scale=Math.min(w/img.width,h/img.height);
    const realW=img.width*scale,realH=img.height*scale;
    ctx.drawImage(img,x+(w-realW)/2,y+(h-realH)/2,realW,realH);
  }
  async function imageFor(requestId,name){
    const route='/portal/agent-reward-workflow?requestId='+encodeURIComponent(requestId)+'&action='+name;
    const response=await fetch(route,{credentials:'same-origin',cache:'no-store',headers:{accept:'image/png,image/jpeg'}});
    if(!response.ok)throw new Error('ACT_PDF_CANONICAL_ASSET_DENIED_'+name+':HTTP_'+response.status);
    const bytes=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
      .map(b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==HASHES[name])throw new Error('ACT_PDF_CANONICAL_SHA256_MISMATCH_'+name);
    const mime=name==='canonical-seal'?'image/jpeg':'image/png';
    const blob=new Blob([bytes],{type:mime});
    if(typeof createImageBitmap==='function')return await createImageBitmap(blob);
    return await new Promise((resolve,reject)=>{
      const image=new Image(),url=URL.createObjectURL(blob);
      image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('ACT_PDF_IMAGE_DECODING_FAILED_'+name))};
      image.src=url;
    });
  }
  function font(ctx,px,bold){ctx.font=(bold?'700 ':'400 ')+px+'px "Arial Narrow", Arial, sans-serif';ctx.fillStyle='#182027';ctx.textBaseline='alphabetic'}
  function wrap(ctx,value,maxWidth){
    const items=safe(value).split(/\s+/).filter(Boolean),lines=[];let line='';
    for(const raw of items){
      if(ctx.measureText(raw).width>maxWidth){
        if(line){lines.push(line);line=''}
        let piece='';
        for(const letter of raw){
          if(piece&&ctx.measureText(piece+letter).width>maxWidth){lines.push(piece);piece=letter}else piece+=letter
        }
        line=piece;continue
      }
      if(line&&ctx.measureText(line+' '+raw).width>maxWidth){lines.push(line);line=raw}
      else line+=(line?' ':'')+raw
    }
    if(line)lines.push(line);
    return lines;
  }
  function paragraph(ctx,value,x,y,width,options){
    const optionsSafe=options||{},size=optionsSafe.size||46,lineHeight=optionsSafe.lineHeight||Math.round(size*1.31);
    font(ctx,size,!!optionsSafe.bold);
    const lines=wrap(ctx,value,width);
    for(const line of lines){ctx.fillText(line,x,y);y+=lineHeight}
    return y+(optionsSafe.after==null?16:optionsSafe.after)
  }
  function center(ctx,text,y,size,bold){
    font(ctx,size,bold!==false);ctx.textAlign='center';ctx.fillText(text,W/2,y);ctx.textAlign='left'
  }
  function line(ctx,x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
  function encode(v){return new TextEncoder().encode(v)}
  function makePdf(canvases){
    if(!Array.isArray(canvases)||!canvases.length||canvases.length>8)
      throw new Error('ACT_PDF_PAGE_COUNT_INVALID');
    const frames=canvases.map(canvas=>{
      const encoded=canvas.toDataURL('image/jpeg',0.95).split(',')[1];
      if(!encoded)throw new Error('ACT_PDF_CANVAS_ENCODING_FAILED');
      const binary=atob(encoded),bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return bytes;
    });
    const pageW='595.2756',pageH='841.8898',parts=[],offsets=[0];let offset=0;
    const add=bytes=>{parts.push(bytes);offset+=bytes.length},str=t=>add(encode(t));
    const begin=i=>{offsets[i]=offset;str(i+' 0 obj\n')},end=()=>str('\nendobj\n');
    const ids=frames.map((_,i)=>({page:3+i*3,image:4+i*3,stream:5+i*3}));
    str('%PDF-1.4\n%RONA\n');
    begin(1);str('<< /Type /Catalog /Pages 2 0 R >>');end();
    begin(2);str('<< /Type /Pages /Kids ['+ids.map(x=>x.page+' 0 R').join(' ')+
      '] /Count '+frames.length+' >>');end();
    for(let i=0;i<frames.length;i++){
      const o=ids[i],jpg=frames[i];
      begin(o.page);str('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+
        pageW+' '+pageH+'] /Resources << /XObject << /Im0 '+
        o.image+' 0 R >> >> /Contents '+o.stream+' 0 R >>');end();
      begin(o.image);str('<< /Type /XObject /Subtype /Image /Width '+W+' /Height '+H+
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+
        jpg.length+' >>\nstream\n');add(jpg);str('\nendstream');end();
      const command='q '+pageW+' 0 0 '+pageH+' 0 0 cm /Im0 Do Q\n';
      begin(o.stream);str('<< /Length '+encode(command).length+
        ' >>\nstream\n'+command+'endstream');end();
    }
    const total=2+3*frames.length,xref=offset;
    str('xref\n0 '+(total+1)+'\n0000000000 65535 f \n');
    for(let i=1;i<=total;i++)str(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    str('trailer\n<< /Size '+(total+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
    const blob=new Blob(parts,{type:'application/pdf'});
    if(blob.size<5000)throw new Error('ACT_PDF_TOO_SMALL');
    return blob;
  }
  const fmtMoney=(v,currency)=>new Intl.NumberFormat('ru-RU',
    {minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(v))+
    (currency?' '+currency:'');
  const fmtSigned=v=>(v<0?'−':v>0?'+':'')+fmtMoney(v);
  function appendCanvas(data,number,date,deal,letterhead){
    const a=data||{};
    if(a.contract!=='RONA_ACT_APPENDIX_V1'||a.dealId!==deal
      ||!Number.isInteger(Number(a.correctionVersion))||a.currency!=='USD'
      ||!Array.isArray(a.payments)||!a.payments.length
      ||!Array.isArray(a.bankFees)||!a.bankFees.length
      ||!Array.isArray(a.adjustmentComponents)||!a.adjustmentComponents.length)
      throw new Error('ACT_PDF_APPENDIX_SOURCE_MISSING');
    const sum=(xs)=>xs.reduce((q,x)=>q+Number(x.amount),0);
    const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
    if([a.revenue,a.paymentTotal,a.bankFeeTotal,a.adjustment,a.cashResult,a.profit,
      a.tax,a.net,a.positiveBasis,a.agentReward,a.ronaResult].some(
        x=>typeof x!=='number'||!Number.isFinite(x))
      ||Math.abs(r2(sum(a.payments))+a.paymentTotal)>.011
      ||Math.abs(r2(sum(a.bankFees))+a.bankFeeTotal)>.011
      ||Math.abs(r2(a.revenue-a.paymentTotal-a.bankFeeTotal)-a.cashResult)>.011
      ||Math.abs(r2(a.cashResult+a.adjustment)-a.profit)>.011
      ||Math.abs(r2(a.profit-a.tax)-a.net)>.011
      ||Math.abs(r2(a.net-a.agentReward)-a.ronaResult)>.011)
      throw new Error('ACT_PDF_APPENDIX_ARITHMETIC_MISMATCH');
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('ACT_PDF_APPENDIX_CANVAS_UNAVAILABLE');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.drawImage(letterhead,0,0,W,H);
    center(ctx,'ПРИЛОЖЕНИЕ № 1',566,62,true);
    center(ctx,'к Акту выполненных работ № '+number,635,41,true);
    center(ctx,'от '+date+' · сделка '+deal,693,37,false);
    ctx.strokeStyle='#9da5ae';ctx.lineWidth=2;line(ctx,LEFT,734,RIGHT,734);
    center(ctx,'ПОСТАТЕЙНЫЙ РАСЧЁТ ФИНАНСОВОГО РЕЗУЛЬТАТА',800,45,true);
    center(ctx,'Сохранённая корректировка № '+a.correctionVersion+
      (a.correctionDate?' от '+dateRu(a.correctionDate):'')+' · '+a.currency,
      856,34,false);
    const x0=LEFT,x1=LEFT+116,x2=RIGHT-430;
    let y=912;
    const drawRow=(idx,label,value,{section=false,subtotal=false,final=false,
       indent=false,header=false}={})=>{
      const size=section?34:header?35:subtotal?34:33;
      font(ctx,size,section||subtotal||final||header);
      const width=x2-x1-(indent?30:0)-38;
      const words=wrap(ctx,label,width);
      const height=section?74:Math.max(62,28+(words.length*38));
      if(y+height>3120)throw new Error('ACT_PDF_APPENDIX_PAGE_OVERFLOW');
      ctx.fillStyle=header?'#e8edf1':section?'#f0f2f3':
        final?'#e8edee':subtotal?'#fafafa':'#fff';
      ctx.fillRect(x0,y,RIGHT-x0,height);
      ctx.strokeStyle='#d3d8dd';ctx.lineWidth=1;line(ctx,x0,y+height,RIGHT,y+height);
      font(ctx,size,section||subtotal||final||header);
      ctx.fillStyle='#182027';
      if(idx)ctx.fillText(String(idx),x0+17,y+height/2+10);
      const x=x1+14+(indent?30:0),lineHeight=37;
      let py=y+height/2-(words.length-1)*lineHeight/2+11;
      for(const part of words){ctx.fillText(part,x,py);py+=lineHeight}
      if(value!==null&&value!==undefined){
        ctx.textAlign='right';ctx.fillText(value,RIGHT-15,y+height/2+10);ctx.textAlign='left';
      }
      y+=height;
    };
    drawRow('№','Статья расчёта','Сумма, '+a.currency,{header:true});
    drawRow('','I. ПОСТУПЛЕНИЯ',null,{section:true});
    let ix=1;
    drawRow(ix++,'Поступление от покупателя '+safe(a.buyerName),fmtSigned(a.revenue));
    drawRow('','Итого поступления',fmtMoney(a.revenue),{subtotal:true});
    drawRow('','II. ВЫПЛАТЫ И БАНКОВСКИЕ КОМИССИИ',null,{section:true});
    for(const x of a.payments)drawRow(ix++,safe(x.label),fmtSigned(x.amount));
    drawRow('','Итого выплаты контрагентам','-'+fmtMoney(a.paymentTotal),{subtotal:true});
    for(const x of a.bankFees)drawRow(ix++,safe(x.label),fmtSigned(x.amount));
    drawRow('','Итого банковские комиссии','-'+fmtMoney(a.bankFeeTotal),{subtotal:true});
    drawRow('','Итого выплаты и банковские комиссии',
      '-'+fmtMoney(a.paymentTotal+a.bankFeeTotal),{subtotal:true});
    drawRow('','III. ФИНАНСОВЫЙ РЕЗУЛЬТАТ И ВОЗНАГРАЖДЕНИЕ',null,{section:true});
    drawRow(ix++,'Денежный результат: поступления за вычетом выплат и комиссий',
      fmtMoney(a.cashResult));
    const adjustmentId=ix++;
    drawRow(adjustmentId,'Корректировка незакрытых взаиморасчётов, в том числе:',
      fmtSigned(a.adjustment),{subtotal:true});
    a.adjustmentComponents.forEach((x,k)=>drawRow(adjustmentId+'.'+(k+1),
      safe(x.label),fmtSigned(x.amount),{indent:true}));
    drawRow(ix++,'Финансовый результат до налогообложения',fmtSigned(a.profit),
      {subtotal:true});
    drawRow(ix++,'Расчётный налог (10% только при положительной прибыли)',
      fmtMoney(a.tax));
    drawRow(ix++,'Чистый финансовый результат сделки',fmtSigned(a.net),{subtotal:true});
    drawRow(ix++,'Положительная база вознаграждения агента',
      fmtMoney(a.positiveBasis));
    drawRow(ix++,'Агентское вознаграждение (50% положительной маржи)',
      fmtMoney(a.agentReward),{subtotal:true});
    drawRow(ix++,'Результат RONA после агентского вознаграждения',
      fmtSigned(a.ronaResult),{final:true});
    y+=40;
    y=paragraph(ctx,'Корректировка раскрывает открытые взаиморасчёты с покупателем, '+
      'поставщиками и логистическими компаниями. Указанные остатки управленческого '+
      'расчёта не являются дополнительными банковскими списаниями.',
      LEFT,y,WIDTH,{size:28,lineHeight:39,after:20});
    y=paragraph(ctx,'Составляющие корректировки округлены до 0,1 '+a.currency+
      '; общий финансовый результат показан с точностью 0,01 '+a.currency+'. '+
      'Итог раздела RONA Trade: '+fmtSigned(Math.round(a.ronaResult*10)/10)+
      ' '+a.currency+'.',LEFT,y,WIDTH,{size:28,lineHeight:39,after:0});
    if(y>3240)throw new Error('ACT_PDF_APPENDIX_FOOTER_OVERFLOW');
    return canvas;
  }
  async function render(data,requestId){
    if(!/^[0-9a-f-]{36}$/i.test(safe(requestId)))throw new Error('ACT_PDF_REQUEST_ID_INVALID');
    const d=data||{},number=needed(d.documentNumber,'DOCUMENT_NUMBER'),
      date=dateRu(d.documentDate),place=needed(d.signingPlace,'SIGNING_PLACE'),
      issuer=needed(d.issuer,'ISSUER'),issuerSigner=needed(d.issuerSigner,'ISSUER_SIGNER'),
      issuerDetails=needed(d.issuerRequisites,'ISSUER_REQUISITES'),
      agent=needed(d.agentLegalName,'AGENT'),agentSigner=needed(d.agentSignatory,'AGENT_SIGNER'),
      service=needed(d.services,'SERVICES'),period=needed(d.servicePeriod,'SERVICE_PERIOD'),
      ds=needed(d.addendumReference,'ADDENDUM'),deal=needed(d.dealId,'DEAL'),
      authorization=needed(d.facsimileAuthorizationRef,'FACSIMILE_AUTHORIZATION'),
      currency=needed(d.currency,'CURRENCY'),amount=Number(d.amount);
    if(!Number.isFinite(amount)||amount<0)throw new Error('ACT_PDF_AMOUNT_NOT_APPROVED');
    if(d.documentStandard!=='RONA-DOC-STANDARD v2')throw new Error('ACT_PDF_STANDARD_MISMATCH');
    if(d.signatureMethod!=='OWNER_APPROVED_GRAPHIC_FACSIMILE_NOT_QES')throw new Error('ACT_PDF_SIGNING_METHOD_MISMATCH');
    if(d.dealId==='DEAL-2026-004'){
      const m=d.shipmentMarginSource||{},margin=Number(m.margin),
        exchange=m.exchangeRate==null?1:Number(m.exchangeRate);
      const ownerManagement=m.basisSourceKind==='OWNER_APPROVED_SECTION'
        &&/^[0-9a-f-]{36}$/i.test(safe(m.ownerCorrectionId))
        &&Number.isInteger(Number(m.ownerCorrectionVersion));
      if(m.basis!=='SHIPMENT_MARGIN'||Number(m.rate)!==0.5
        ||!Number.isFinite(margin)||!Number.isFinite(exchange)||exchange<=0
        ||!safe(m.marginCurrency)
        ||(!ownerManagement&&(!safe(m.factoryDocumentRef)||!safe(m.guDocumentRef)))
        ||Math.abs(Math.round(Math.max(0,margin)*0.5*exchange*100)/100-amount)>0.111)
        throw new Error('ACT_PDF_SHIPMENT_MARGIN_SOURCE_REQUIRED');
    }
    const assets=await Promise.all([
      imageFor(requestId,'canonical-letterhead'),
      imageFor(requestId,'canonical-signature'),
      imageFor(requestId,'canonical-seal')
    ]);
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('ACT_PDF_CANVAS_UNAVAILABLE');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.drawImage(assets[0],0,0,W,H);
    center(ctx,'АКТ ВЫПОЛНЕННЫХ РАБОТ',590,57,true);
    center(ctx,'(ОКАЗАННЫХ АГЕНТСКИХ УСЛУГ)',658,47,true);
    center(ctx,'№ '+number,720,47,true);
    font(ctx,42,false);ctx.textAlign='right';ctx.fillText(place+' · '+date,RIGHT,790);ctx.textAlign='left';
    let y=884;
    y=paragraph(ctx,issuer+', именуемое в дальнейшем «Заказчик», в лице '+issuerSigner+
      ', с одной стороны, и '+agent+', именуемое в дальнейшем «Исполнитель», в лице '+
      agentSigner+', с другой стороны, составили настоящий акт.',LEFT,y,WIDTH,{size:46,lineHeight:61,after:36});
    y=paragraph(ctx,'Основание: '+ds+'. Сделка: '+deal+'.',LEFT,y,WIDTH,{size:45,lineHeight:58,after:20});
    y=paragraph(ctx,'Период оказания услуг: '+period+'.',LEFT,y,WIDTH,{size:45,lineHeight:58,after:36});
    y=paragraph(ctx,'Исполнителем оказаны следующие агентские услуги:',LEFT,y,WIDTH,{size:45,lineHeight:57,after:14});
    const tableY=y,half=LEFT+WIDTH*0.73;ctx.strokeStyle='#525b62';ctx.lineWidth=2;
    font(ctx,42,true);ctx.fillText('НАИМЕНОВАНИЕ УСЛУГ',LEFT+15,y+48);
    ctx.fillText('СТОИМОСТЬ',half+17,y+48);
    y+=75;line(ctx,LEFT,y,RIGHT,y);
    const serviceStart=y+60, serviceEnd=paragraph(ctx,service,LEFT+15,serviceStart,half-LEFT-35,{size:43,lineHeight:56,after:0});
    const amountString=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount)+' '+currency;
    font(ctx,43,true);ctx.fillText(amountString,half+17,serviceStart);
    y=Math.max(serviceEnd+18,serviceStart+64);
    line(ctx,LEFT,y,RIGHT,y);
    y+=66;
    font(ctx,47,true);ctx.fillText('ИТОГО:',LEFT+15,y);ctx.textAlign='right';ctx.fillText(amountString,RIGHT-15,y);ctx.textAlign='left';
    y+=74;line(ctx,LEFT,y,RIGHT,y);y+=48;
    if(d.shipmentMarginSource?.basis==='SHIPMENT_MARGIN'){
      const m=d.shipmentMarginSource,displayMargin=new Intl.NumberFormat('ru-RU',
        {minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(m.margin));
      y=paragraph(ctx,'Основа расчёта: подтверждённая маржа Принципала по поставке — '+
        displayMargin+' '+safe(m.marginCurrency)+'. Доля агента по ДС: 50%.',
        LEFT,y,WIDTH,{size:39,lineHeight:52,after:18});
      if(m.basisSourceKind==='OWNER_APPROVED_SECTION'){
        y=paragraph(ctx,'Основание суммы: утверждённый расчёт владельца по корректировке №'+
          safe(m.ownerCorrectionVersion)+'.',LEFT,y,WIDTH,
          {size:33,lineHeight:44,after:18});
      }else{
        y=paragraph(ctx,'Основания расчёта: документы завода '+safe(m.factoryDocumentRef)+
          '; ГУ '+safe(m.guDocumentRef)+'.',LEFT,y,WIDTH,
          {size:33,lineHeight:44,after:18});
      }
      y=paragraph(ctx,'Оплата агентского вознаграждения в российских рублях по курсу ЦБ РФ '+
        'на дату фактической оплаты.',LEFT,y,WIDTH,{size:33,lineHeight:44,after:22});
    }
    y=paragraph(ctx,'Размер вознаграждения установлен на основании подписанного ДС и подтверждённого расчёта.',
      LEFT,y,WIDTH,{size:40,lineHeight:52,after:34});
    const signTop=Math.max(y+50,2235);
    if(signTop+750>3220)throw new Error('ACT_PDF_PAGE_OVERFLOW');
    const colWidth=WIDTH*0.47,rightX=RIGHT-colWidth;
    ctx.strokeStyle='#727b84';line(ctx,LEFT,signTop,LEFT+colWidth,signTop);line(ctx,rightX,signTop,RIGHT,signTop);
    font(ctx,41,true);ctx.fillText('ЗАКАЗЧИК',LEFT,signTop+61);ctx.fillText('ИСПОЛНИТЕЛЬ',rightX,signTop+61);
    const leftDetails=paragraph(ctx,issuerDetails,LEFT,signTop+123,colWidth-20,{size:36,lineHeight:48,after:0});
    const rightDetails=paragraph(ctx,agent+'; '+safe(d.agentTaxId)+'; '+safe(d.agentAddress)+
      '; '+safe(d.agentCountry),rightX,signTop+123,colWidth-15,{size:35,lineHeight:47,after:0});
    const assetTop=Math.max(signTop+280,leftDetails+20);
    if(assetTop+432>3190||rightDetails>3180)throw new Error('ACT_PDF_SIGNATURE_OVERFLOW');
    drawContain(ctx,assets[1],LEFT+35,assetTop,550,305);
    // Exactly 35 x 35 mm: single seal in the Seller signature section only.
    drawContain(ctx,assets[2],LEFT+500,assetTop-25,35*MM,35*MM);
    font(ctx,34,false);ctx.fillText(issuerSigner,LEFT+12,assetTop+370);
    ctx.fillText(agentSigner,rightX+12,assetTop+370);
    ctx.strokeStyle='#333';line(ctx,rightX+20,assetTop+330,RIGHT-25,assetTop+330);
    // No legal/technical implementation note is printed in the Owner-approved form.
    // Canonical signature and seal remain visually present above.
    const ownerMode=d.sourceMode==='OWNER_SIGNED_SECTION_NOT_FINANCE_PAYABLE';
    if(ownerMode&&!d.financialAppendix)
      throw new Error('ACT_PDF_APPENDIX_REQUIRED_FOR_OWNER');
    const canvases=[canvas];
    if(d.financialAppendix){
      if(Number(d.financialAppendix.agentReward)!==amount||
         Number(d.financialAppendix.correctionVersion)!==
           Number(d.ownerSectionCorrectionVersion))
        throw new Error('ACT_PDF_APPENDIX_DOCUMENT_MISMATCH');
      canvases.push(appendCanvas(d.financialAppendix,number,date,deal,assets[0]));
    }
    return {blob:makePdf(canvases),pageCount:canvases.length,filename:'RONA_Act_'+safe(deal).replace(/[^A-Za-z0-9_-]/g,'_')+
      '_'+safe(number).replace(/[^A-Za-z0-9_-]/g,'_')+'.pdf'};
  }
  window.RONA_AGENT_ACT_PDF_ENGINE=Object.freeze({render,version:'v5-two-page-canonical-financial-appendix'});
}
const SCRIPT='('+ronaActPdfRuntime.toString()+')();';
export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'x-content-type-options':'nosniff',
    'x-rona-agent-act-pdf':'CANONICAL_ONE_CLICK_V1'
  }});
}
