export const ADMIN_RADIO_MESSAGE_CANONICAL_BRIDGE_VERSION='stage2a-message-canonical-bridge-v1';

const RUNTIME=String.raw`
let ronaRadioMessageBridgeState={items:[],loading:false,loadedAt:0,error:null};
async function ronaRadioCanonicalRequest(path,init={}){
  const headers={accept:'application/json','x-rona-client-source':'ADMIN_RADIO_MESSAGE_STAGE2A',...(init.headers||{})};
  const response=await fetch('/portal/api'+path,{credentials:'same-origin',cache:'no-store',...init,headers});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false){
    const err=new Error(String(payload?.code||payload?.error?.code||('HTTP_'+response.status)));
    err.code=String(payload?.code||payload?.error?.code||'REQUEST_FAILED');
    err.status=response.status;
    throw err;
  }
  return payload;
}
function ronaRadioCanonicalMessages(){
  return Array.isArray(ronaRadioMessageBridgeState.items)?ronaRadioMessageBridgeState.items:[];
}
async function ronaRadioLoadCanonicalMessages(force=false){
  if(ronaRadioMessageBridgeState.loading)return ronaRadioCanonicalMessages();
  if(!force&&ronaRadioMessageBridgeState.loadedAt&&Date.now()-ronaRadioMessageBridgeState.loadedAt<15000)return ronaRadioCanonicalMessages();
  ronaRadioMessageBridgeState.loading=true;
  try{
    const payload=await ronaRadioCanonicalRequest('/v1/admin/bootstrap');
    const incoming=Array.isArray(payload?.data?.client_intake)?payload.data.client_intake:[];
    ronaRadioMessageBridgeState.items=incoming.filter(x=>String(x?.event_type||'')==='CLIENT_MESSAGE_SUBMIT');
    ronaRadioMessageBridgeState.loadedAt=Date.now();
    ronaRadioMessageBridgeState.error=null;
    window.__RONA_ADMIN_RADIO_MESSAGE_CANONICAL_INTAKE__=ronaRadioMessageBridgeState.items;
    return ronaRadioMessageBridgeState.items;
  }catch(err){
    ronaRadioMessageBridgeState.error=String(err?.code||err?.message||err);
    window.__RONA_ADMIN_RADIO_MESSAGE_CANONICAL_ERROR__=ronaRadioMessageBridgeState.error;
    return ronaRadioCanonicalMessages();
  }finally{
    ronaRadioMessageBridgeState.loading=false;
  }
}
function ronaRadioMessageOptionText(x){
  const p=x&&typeof x.payload==='object'&&x.payload?x.payload:{};
  const subject=String(p.subject||'Сообщение');
  return [String(x?.legal_name||x?.client_id||'Клиент'),subject,String(x?.event_id||'')].filter(Boolean).join(' · ');
}
function ronaRadioMessageRows(){
  return ronaRadioCanonicalMessages().map(x=>{
    const p=x&&typeof x.payload==='object'&&x.payload?x.payload:{};
    return[
      'MESSAGE',
      String(x?.legal_name||x?.client_id||'—'),
      String(p.message||'—'),
      date(x?.created_at)
    ];
  });
}
function renderRadio(){
  const c=card('Радиорубка'),f=e('div',{class:'rona-owner-form'}),kind=e('select'),scope=e('select'),target=e('select'),body=e('textarea',{placeholder:'Сообщение'});
  [['MESSAGE','Сообщение'],['NOTIFICATION','Уведомление'],['ANNOUNCEMENT','Объявление']].forEach(([v,t])=>kind.append(e('option',{value:v,text:t})));
  [['ALL_CLIENTS','Все клиенты'],['CLIENT','Клиент'],['ALL_AGENTS','Все агенты'],['AGENT','Агент']].forEach(([v,t])=>scope.append(e('option',{value:v,text:t})));
  const syncTargets=()=>{
    target.replaceChildren(e('option',{value:'',text:'Получатель'}));
    if(kind.value==='MESSAGE'){
      if(scope.value==='CLIENT'){
        const rows=ronaRadioCanonicalMessages().filter(x=>!x?.client_response_published_at&&String(x?.acknowledgement_state||'')!=='REJECTED'&&x?.task_id);
        rows.forEach(x=>target.append(e('option',{value:String(x.event_id),text:ronaRadioMessageOptionText(x)})));
      }
      target.classList.toggle('rona-owner-hide',scope.value!=='CLIENT');
      return;
    }
    if(scope.value==='CLIENT')(adminData?.clients||[]).forEach(x=>target.append(e('option',{value:x.client_id,text:x.legal_name})));
    if(scope.value==='AGENT')(adminData?.agents||[]).forEach(x=>target.append(e('option',{value:x.agent_person_id,text:x.agent_name})));
    target.classList.toggle('rona-owner-hide',!['CLIENT','AGENT'].includes(scope.value));
  };
  kind.onchange=syncTargets;
  scope.onchange=syncTargets;
  const send=e('button',{text:'Отправить',onclick:async()=>{
    try{
      if(kind.value==='MESSAGE'){
        if(scope.value!=='CLIENT')return notify('Для ответа выберите адресный scope «Клиент».');
        const eventId=String(target.value||'');
        const item=ronaRadioCanonicalMessages().find(x=>String(x?.event_id||'')===eventId);
        if(!item)return notify('Выберите входящее сообщение клиента.');
        if(item.client_response_published_at)return notify('Ответ на это сообщение уже опубликован.');
        if(!item.task_id)throw Object.assign(new Error('SOURCE_TASK_REQUIRED'),{code:'SOURCE_TASK_REQUIRED'});
        const responseText=String(body.value||'').trim();
        if(!responseText)return notify('Введите ответ.');
        await ronaRadioCanonicalRequest('/v1/admin/client-intake/'+encodeURIComponent(eventId)+'/respond',{
          method:'POST',
          headers:{'content-type':'application/json',accept:'application/json'},
          body:JSON.stringify({response:responseText,source_task_id:String(item.task_id)})
        });
        body.value='';
        await ronaRadioLoadCanonicalMessages(true);
        await refreshAdmin('ADMIN_RADIO_MESSAGE_RESPONSE');
        return;
      }
      await post('/admin/radio',{kind:kind.value,scope:scope.value,targetId:target.value||null,body:body.value});
      body.value='';
      await refreshAdmin('ADMIN_RADIO_LEGACY_PUBLICATION');
    }catch(err){await notify(err.code||err.message,'Ошибка')}
  }});
  f.append(kind,scope,target,body,send);
  const legacyRows=(adminData?.radio||[]).map(x=>[x.item_kind,x.target_id||x.target_scope,x.body_text,date(x.created_at)]);
  const list=tbl(['Тип','Кому','Сообщение','Дата'],[...ronaRadioMessageRows(),...legacyRows]);
  c.append(f,e('h3',{class:'rona-owner-section-title',text:'Активные сообщения'}),list);
  replacePage('messages',c);
  syncTargets();
  if(!ronaRadioMessageBridgeState.loadedAt||Date.now()-ronaRadioMessageBridgeState.loadedAt>=15000)void ronaRadioLoadCanonicalMessages(false).then(()=>{const p=page('messages');if(p?.classList?.contains('active'))renderRadio()});
}
`;

export function patchAdminRadioMessageCanonicalBridgeV1(script){
  let patched=String(script||'');
  const startToken='function renderRadio(){';
  const endToken='\nfunction renderAnalytics(){';
  const start=patched.indexOf(startToken);
  const end=start<0?-1:patched.indexOf(endToken,start);
  if(start<0||end<=start)throw new Error('ADMIN_RADIO_STAGE2A_RENDER_SOURCE_MISMATCH');
  if(patched.indexOf(startToken,start+startToken.length)>=0)throw new Error('ADMIN_RADIO_STAGE2A_RENDER_NOT_UNIQUE');
  const legacy=patched.slice(start,end);
  if(!legacy.includes("post('/admin/radio'"))throw new Error('ADMIN_RADIO_STAGE2A_LEGACY_PUBLICATION_CONTRACT_MISSING');
  if(!legacy.includes("'MESSAGE','Сообщение'"))throw new Error('ADMIN_RADIO_STAGE2A_MESSAGE_KIND_MISSING');
  if(!legacy.includes("'NOTIFICATION','Уведомление'")||!legacy.includes("'ANNOUNCEMENT','Объявление'"))throw new Error('ADMIN_RADIO_STAGE2A_ADJACENT_KINDS_MISSING');
  patched=patched.slice(0,start)+RUNTIME+patched.slice(end);
  if(!patched.includes("'/v1/admin/client-intake/'"))throw new Error('ADMIN_RADIO_STAGE2A_CANONICAL_RESPONSE_ROUTE_MISSING');
  if(!patched.includes("'/v1/admin/bootstrap'"))throw new Error('ADMIN_RADIO_STAGE2A_CANONICAL_INTAKE_ROUTE_MISSING');
  if(!patched.includes("String(x?.event_type||'')==='CLIENT_MESSAGE_SUBMIT'"))throw new Error('ADMIN_RADIO_STAGE2A_MESSAGE_FILTER_MISSING');
  if(!patched.includes("await post('/admin/radio',{kind:kind.value"))throw new Error('ADMIN_RADIO_STAGE2A_LEGACY_NOTIFICATION_PATH_MISSING');
  if(!patched.includes("if(kind.value==='MESSAGE')"))throw new Error('ADMIN_RADIO_STAGE2A_MESSAGE_BRANCH_MISSING');
  return "window.__RONA_ADMIN_RADIO_MESSAGE_BRIDGE__='STAGE_2A_MESSAGE_CANONICAL_BRIDGE_V1';\n"+patched;
}
