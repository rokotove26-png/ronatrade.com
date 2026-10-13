import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const source=await readFile('dist/assets/portal-runtime/client-deal-documents-v5.js','utf8');
assert.ok(source.includes("authority.whenCurrentProjection('client-deal-documents-v5')"),'current projection materializer required');
assert.ok(source.includes('reloadRequested:true')===false,'reloadRequested must be a state flag, not hardcoded status');
assert.ok(source.includes('state.reloadRequested=true'),'pending context reread must be queued');
assert.ok(source.includes('if(queued&&contextAuthority()?.getCurrentContext())queueMicrotask(loadData)'),'coalesced reentry missing');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><html lang="ru"><body><h1>Сделки</h1><main>'+
    '<section id="a" style="width:720px;height:144px;padding:12px;"><span>DEAL-2099-001</span><button>Открыть</button></section>'+
    '<section id="b" style="width:720px;height:144px;padding:12px;display:none;"><span>DEAL-2099-002</span><button>Открыть</button></section>'+
    '</main></body></html>');
  await page.evaluate(()=>{
    const a={client_id:'QA-A',contract_id:'QA-A-CTR'};
    const b={client_id:'QA-B',contract_id:'QA-B-CTR'};
    const doc=(deal,id)=>({deal_id:deal,document_id:id,document_type:'INVOICE',storage_object_id:'STORAGE-'+id,authoritative_filename:id+'.pdf'});
    const projections={
      'QA-A':{contract:{...a},deals:[{deal_id:'DEAL-2099-001'}],documents:[doc('DEAL-2099-001','DOC-A')]},
      'QA-B':{contract:{...b},deals:[{deal_id:'DEAL-2099-002'}],documents:[doc('DEAL-2099-002','DOC-B')]}
    };
    const state={context:a,listeners:[],startedA:false,initialAResolved:false,releaseA:null,calls:[],a,b};
    window.__race=state;
    window.RONA_CLIENT_CONTEXT={
      getCurrentContext:()=>state.context,
      whenReady:async()=>state.context,
      whenCurrentProjection:async()=>{
        const selected=state.context;
        if(selected.client_id==='QA-A'&&!state.initialAResolved){
          state.startedA=true;
          return await new Promise(resolve=>{state.releaseA=()=>{state.initialAResolved=true;resolve(projections['QA-A']);};});
        }
        return projections[selected.client_id];
      },
      subscribe:cb=>{state.listeners.push(cb);return()=>{}}
    };
    window.fetch=async(input,init)=>{
      const u=new URL(String(input),location.origin);
      if(u.pathname!=='/portal/api/v1/client/deal-documents/state')throw Error('NETWORK_OUT_OF_SCOPE '+u.pathname);
      const client=u.searchParams.get('clientId'),contract=u.searchParams.get('contractId');
      state.calls.push({client,contract,method:init?.method||'GET'});
      const correct=client==='QA-A'&&contract==='QA-A-CTR'||client==='QA-B'&&contract==='QA-B-CTR';
      if(!correct) return new Response(JSON.stringify({ok:false,code:'CONTEXT_SCOPE_DENIED'}),{status:403,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({ok:true,deals:[]}),{status:200,headers:{'content-type':'application/json'}});
    };
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.dispatchEvent(new Event('rona:client:deals-rendered')));
  await page.waitForFunction(()=>window.__race?.startedA&&typeof window.__race?.releaseA==='function',null,{timeout:10000});
  await page.evaluate(()=>{
    const s=window.__race;
    s.context=s.b;
    document.querySelector('#a').style.display='none';
    document.querySelector('#b').style.display='block';
    for(const listener of s.listeners)listener(s.b);
    s.releaseA();
  });
  await page.waitForFunction(()=>{
    const card=document.querySelector('#b .rona-deal-documents-v5');
    return card&&[...card.querySelectorAll('button')].some(x=>x.textContent?.includes('Инвойс'));
  },null,{timeout:10000});
  const result=await page.evaluate(()=>({
    B:!!document.querySelector('#b .rona-deal-documents-v5'),
    BInvoice:[...(document.querySelector('#b .rona-deal-documents-v5')?.querySelectorAll('button')||[])].some(x=>x.textContent?.includes('Инвойс')&&x.title==='DOC-B.pdf'),
    A:!!document.querySelector('#a .rona-deal-documents-v5'),
    calls:window.__race.calls,
    selected:window.RONA_CLIENT_CONTEXT.getCurrentContext()
  }));
  console.log('QA_DOCUMENTS_CONTEXT_RACE_TRACE '+JSON.stringify(result));
  assert.equal(result.B,true);
  assert.equal(result.BInvoice,true);
  assert.equal(result.A,false,'stale A document DOM remained under current B');
  // Current-context data is delivered through the central projection authority; raw workflow fetch is optional in this isolated fixture.
  // Keep the strict network scope invariant for any requests observed, and prove the actual B document identity instead.
  assert.ok(result.calls.every(x=>x.method==='GET'&&((x.client==='QA-A'&&x.contract==='QA-A-CTR')||(x.client==='QA-B'&&x.contract==='QA-B-CTR'))),'cross-context document request issued');
  assert.equal(result.selected.client_id,'QA-B');
  assert.deepEqual(errors,[]);
  console.log('QA_DOCUMENTS_PENDING_A_TO_B_CONTEXT_RACE=PASS '+JSON.stringify({AVisible:false,BInvoice:true,currentClient:'QA-B',calls:result.calls.length,synthetic:true}));
  // Return B to A after the pending first A request has been invalidated.
  await page.evaluate(()=>{
    const s=window.__race;
    s.context=s.a;
    document.querySelector('#a').style.display='block';
    document.querySelector('#b').style.display='none';
    for(const listener of s.listeners)listener(s.a);
  });
  await page.waitForFunction(()=>{
    const card=document.querySelector('#a .rona-deal-documents-v5');
    return card&&[...card.querySelectorAll('button')].some(x=>x.textContent?.includes('Инвойс')&&x.title==='DOC-A.pdf');
  },null,{timeout:10000});
  const returned=await page.evaluate(()=>({
    current:window.RONA_CLIENT_CONTEXT.getCurrentContext(),
    aInvoices:[...(document.querySelector('#a .rona-deal-documents-v5')?.querySelectorAll('button')||[])].filter(x=>x.textContent?.includes('Инвойс')).map(x=>x.title),
    bPanel:!!document.querySelector('#b .rona-deal-documents-v5')
  }));
  assert.equal(returned.current.client_id,'QA-A');
  assert.deepEqual(returned.aInvoices,['DOC-A.pdf']);
  assert.equal(returned.bPanel,false,'B document leaked into current A context');
  assert.deepEqual(errors,[]);
  console.log('QA_DOCUMENTS_A_B_A_CONTEXT_ISOLATION=PASS '+JSON.stringify({current:'QA-A',aInvoices:returned.aInvoices.length,staleB:false,synthetic:true}));
  await page.close();
}finally{await browser.close()}
