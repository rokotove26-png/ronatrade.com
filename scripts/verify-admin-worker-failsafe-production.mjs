const base=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const sha=process.env.GITHUB_SHA||Date.now();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
async function retry(label,fn,attempts=60,delayMs=5000){
  let last;
  for(let i=1;i<=attempts;i++){
    try{return await fn(i)}catch(e){last=e;if(i<attempts)await sleep(delayMs)}
  }
  throw new Error(`${label}: ${last?.message||last}`);
}
const get=(path,attempt,opts={})=>fetch(`${base}${path}${path.includes('?')?'&':'?'}_worker_qa=${encodeURIComponent(sha)}&_attempt=${attempt}&_nonce=${Date.now()}`,{cache:'no-store',...opts});

await retry('Admin Worker route marker',async attempt=>{
  const r=await get('/portal/admin',attempt,{redirect:'manual'});
  assert(r.status===302,`status ${r.status}`);
  assert(r.headers.get('x-rona-admin-shell')==='current-only-v2','Admin shell marker missing');
  assert(r.headers.get('x-rona-admin-runtime-delivery')==='worker-failsafe-v1',`runtime delivery ${r.headers.get('x-rona-admin-runtime-delivery')}`);
  return true;
});

const shell=await retry('Admin Worker shell runtime',async attempt=>{
  const r=await get('/admin-runtime-shell-v3',attempt);
  assert(r.ok,`status ${r.status}`);
  assert(r.headers.get('x-rona-admin-runtime-delivery')==='worker-failsafe-v1','Worker shell delivery header missing');
  assert(r.headers.get('x-rona-admin-worker-runtime')==='shell-stability-v3','Worker shell identity missing');
  const t=await r.text();
  assert(t.includes("const accessReady=()=>window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!accessHost()"),'stable Access readiness missing');
  assert(t.includes('CURRENT_RUNTIME_NOT_READY_WITHOUT_TEARDOWN'),'non-destructive wait marker missing');
  assert(!t.includes('window.__RONA_CLIENTS_AGENTS_CURRENT__=null'),'destructive Access teardown returned');
  return t;
});

const watchdog=await retry('Admin Worker watchdog runtime',async attempt=>{
  const r=await get('/admin-runtime-watchdog-v3',attempt);
  assert(r.ok,`status ${r.status}`);
  assert(r.headers.get('x-rona-admin-runtime-delivery')==='worker-failsafe-v1','Worker watchdog delivery header missing');
  assert(r.headers.get('x-rona-admin-worker-runtime')==='watchdog-stability-v3','Worker watchdog identity missing');
  const t=await r.text();
  assert(t.includes("if(p==='access')return window.__RONA_CLIENTS_AGENTS_CURRENT_READY__===true&&!!n.querySelector(':scope > #rona-ca4')"),'stable watchdog Access readiness missing');
  assert(!t.includes("if(p==='access')return !!n.querySelector('#rona-ca4 [data-rona-create-access=\"primary\"]')"),'stale watchdog Access readiness returned');
  return t;
});

const access=await retry('Admin Worker Access runtime',async attempt=>{
  const r=await get('/admin-runtime-access-v3',attempt);
  assert(r.ok,`status ${r.status}`);
  const t=await r.text();
  for(const marker of [
    "window.__RONA_CLIENTS_AGENTS_CURRENT_STATE__='BOOTING'",
    "window.__RONA_CLIENTS_AGENTS_CURRENT_REPAIR__=repair",
    "window.__RONA_CLIENTS_AGENTS_CURRENT_STATE__='READY_STALE'",
    "window.__RONA_CLIENTS_AGENTS_CURRENT_ROOT_GUARD__=rootGuard"
  ])assert(t.includes(marker),`Access marker missing: ${marker}`);
  return t;
});

assert(shell.length>0&&watchdog.length>0&&access.length>0,'Worker failsafe body empty');
console.log('ADMIN_WORKER_RUNTIME_FAILSAFE_PRODUCTION=PASS',JSON.stringify({base,sha,delivery:'worker-failsafe-v1',shell:'shell-stability-v3',watchdog:'watchdog-stability-v3',access:'current-v5-stable'}));
