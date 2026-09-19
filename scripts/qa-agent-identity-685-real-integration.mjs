import {spawn,execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

const api=String(process.env.ISSUE685_SUPABASE_URL||'').replace(/\/$/,'');
const anon=String(process.env.ISSUE685_ANON_KEY||'');
const db=String(process.env.ISSUE685_DB_CONTAINER||'');
for(const [k,v] of Object.entries({api,anon,db}))if(!v)throw new Error('MISSING_'+k);
const edge='http://127.0.0.1:8000';
const ADMIN_EMAIL='issue685-admin@example.test';
const AGENT_EMAIL='issue685-egor@example.test';
const ADMIN_PASSWORD='Issue685Admin!A1'+crypto.randomUUID();
const AGENT_PASSWORD='Issue685Agent!A1'+crypto.randomUUID();
const ADMIN_USER='90000000-0000-4000-8000-000000000001';
const CLIENT='10000000-0000-4000-8000-000000000001';
const DEAL='30000000-0000-4000-8000-000000000001';
const AGENT_ID='AGP-2026-002';
const ok=(v,m)=>{if(!v)throw new Error(m)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const esc=v=>String(v).replaceAll("'","''");
function sql(s){return execFileSync('docker',['exec','-i',db,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:s,encoding:'utf8'}).trim()}
function state(expr){return JSON.parse(sql('select ('+expr+')::text;'))}
async function jf(url,opts={}){const r=await fetch(url,opts);return{r,b:await r.json().catch(()=>({}))}}
async function signup(email,password){
 const x=await jf(api+'/auth/v1/signup',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email,password})});
 ok(x.r.ok,'SIGNUP '+email+' '+x.r.status+' '+JSON.stringify(x.b));
 const id=String(x.b?.user?.id||'');const token=String(x.b?.access_token||'');
 ok(id&&token,'SIGNUP_SESSION_MISSING '+email+' '+JSON.stringify(x.b));return{id,token}
}
async function login(email,password){
 const x=await jf(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email,password})});
 ok(x.r.ok,'LOGIN '+email+' '+x.r.status+' '+JSON.stringify(x.b));return String(x.b.access_token||'')
}
async function start(label,file,config){
 const log=[];const p=spawn('deno',['run','--allow-env','--allow-net','--node-modules-dir=auto','--config='+config,file],{env:{...process.env},stdio:['ignore','pipe','pipe']});
 p.stdout.on('data',d=>log.push(d.toString()));p.stderr.on('data',d=>log.push(d.toString()));
 let ready=false;for(let i=0;i<100;i++){if(p.exitCode!==null)break;try{const r=await fetch(edge+'/'+label+'/readiness');if(r.status){ready=true;break}}catch{}await wait(150)}
 if(!ready){p.kill();throw new Error('START '+label+'\n'+log.join(''))}
 return async()=>{if(p.exitCode===null)p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),wait(1500)]);writeFileSync('/tmp/issue685-'+label+'.log',log.join(''))}
}
const admin=await signup(ADMIN_EMAIL,ADMIN_PASSWORD);
sql(`insert into portal_private.portal_users(id,auth_user_id,login_name,display_name,status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,activated_at,password_changed_at)
values('${ADMIN_USER}'::uuid,'${esc(admin.id)}'::uuid,'issue685.admin','Issue 685 Admin','ACTIVE','ISSUE685','v1',now(),'CONFIRMED','ACTIVE',now(),now());
insert into portal_private.portal_user_roles(user_id,role,status,reason) values('${ADMIN_USER}'::uuid,'ADMIN','ACTIVE','Issue 685 integration');`);
const headers=t=>({authorization:'Bearer '+t,'content-type':'application/json',accept:'application/json'});
const evidence={reuse:false,noAssignment:false,personBinding:false,failClosedBefore:false,readiness:false,nonAdminDenied:false,separateAssignment:false,clientScopeAfter:false,dealStillClosed:false,noLegalEntity:false};
let stop=await start('rona-admin-control-plane','supabase/functions/rona-admin-control-plane/index.ts','supabase/functions/rona-admin-control-plane/deno.json');
try{
 const rd=await jf(edge+'/rona-admin-control-plane/readiness',{headers:{authorization:'Bearer '+admin.token}});
 ok(rd.r.ok&&rd.b?.data?.mode==='AGENT_PERSON_IDENTITY_V2','READINESS '+JSON.stringify(rd.b));
 ok(rd.b.data.agents.some(x=>x.agentPersonId===AGENT_ID),'EXISTING_AGENT_ABSENT');evidence.readiness=true;
 const cr=await jf(edge+'/rona-admin-control-plane/access/users',{method:'POST',headers:headers(admin.token),body:JSON.stringify({role:'Агент',name:'Егор Кузнецов',login:'issue685.egor',email:AGENT_EMAIL,phone:'+375291234567',initialPassword:AGENT_PASSWORD,contractIds:[]})});
 ok(cr.r.status===201,'CREATE '+cr.r.status+' '+JSON.stringify(cr.b));
 const userId=String(cr.b.userId||'');ok(userId&&cr.b.agentPersonId===AGENT_ID&&cr.b.agentIdentityCreated===false,'REUSE '+JSON.stringify(cr.b));evidence.reuse=true;
 const s=state(`jsonb_build_object('people',(select count(*) from portal_private.agent_persons where lower(coalesce(display_alias,full_name,''))=lower('Егор Кузнецов')),'bindingLegal',(select agent_legal_entity_key::text from portal_private.agent_user_bindings where user_id='${esc(userId)}'::uuid and status='ACTIVE'),'assignments',(select count(*) from portal_private.agent_client_assignments a join portal_private.agent_persons p on p.id=a.agent_person_key where p.agent_person_id='${AGENT_ID}' and a.status='ACTIVE'),'legal',(select count(*) from portal_private.agent_legal_entities),'client',portal_private.agent_user_has_client_access('${esc(userId)}'::uuid,'${CLIENT}'::uuid,now()),'deal',portal_private.agent_user_has_deal_access('${esc(userId)}'::uuid,'${DEAL}'::uuid,now()))`);
 ok(Number(s.people)===1,'DUP_PERSON '+JSON.stringify(s));ok(s.bindingLegal===null,'NOT_PERSON_BINDING');evidence.personBinding=true;
 ok(Number(s.assignments)===0,'ASSIGNMENT_ON_CREATE');evidence.noAssignment=true;ok(Number(s.legal)===0,'LEGAL_ENTITY_ON_CREATE');evidence.noLegalEntity=true;
 ok(s.client===false&&s.deal===false,'SCOPE_LEAK_BEFORE '+JSON.stringify(s));evidence.failClosedBefore=true;
 const agentToken=await login(AGENT_EMAIL,AGENT_PASSWORD);const deny=await jf(edge+'/rona-admin-control-plane/readiness',{headers:{authorization:'Bearer '+agentToken}});
 ok(deny.r.status===403,'NON_ADMIN_REACHED_ADMIN '+deny.r.status);evidence.nonAdminDenied=true;
 await stop();stop=null;
 stop=await start('rona-owner-acceptance','supabase/functions/rona-owner-acceptance/index.ts','supabase/functions/rona-owner-acceptance/deno.json');
 const as=await jf(edge+'/rona-owner-acceptance/admin/clients/RONA-QA-C001/agent',{method:'POST',headers:headers(admin.token),body:JSON.stringify({agentPersonId:AGENT_ID})});
 ok(as.r.ok&&as.b?.data?.agentPersonId===AGENT_ID,'ASSIGN '+as.r.status+' '+JSON.stringify(as.b));evidence.separateAssignment=true;
 const a=state(`jsonb_build_object('assignments',(select count(*) from portal_private.agent_client_assignments a join portal_private.agent_persons p on p.id=a.agent_person_key where p.agent_person_id='${AGENT_ID}' and a.status='ACTIVE' and a.valid_to is null),'assignmentLegal',(select a.agent_legal_entity_key::text from portal_private.agent_client_assignments a join portal_private.agent_persons p on p.id=a.agent_person_key where p.agent_person_id='${AGENT_ID}' and a.status='ACTIVE' and a.valid_to is null limit 1),'client',portal_private.agent_user_has_client_access('${esc(userId)}'::uuid,'${CLIENT}'::uuid,now()),'deal',portal_private.agent_user_has_deal_access('${esc(userId)}'::uuid,'${DEAL}'::uuid,now()))`);
 ok(Number(a.assignments)===1&&a.assignmentLegal===null,'ASSIGNMENT_BAD '+JSON.stringify(a));ok(a.client===true,'CLIENT_SCOPE_NOT_GRANTED');evidence.clientScopeAfter=true;
 ok(a.deal===false,'DEAL_SCOPE_LEAK_WITHOUT_TERM');evidence.dealStillClosed=true;
}finally{if(stop)await stop()}
writeFileSync('/tmp/issue685-real-integration-summary.json',JSON.stringify(evidence,null,2));
ok(Object.values(evidence).every(Boolean),'INCOMPLETE '+JSON.stringify(evidence));
console.log('ISSUE685_REAL_INTEGRATION=PASS');
console.log(JSON.stringify(evidence));
