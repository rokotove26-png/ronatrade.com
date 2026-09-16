// Disposable integration adapter. It refuses every non-loopback Postgres target.
// Production runtime uses postgres.js; this adapter exposes the same tagged-SQL shape
// to the actual application handler while running statements on a real local PostgreSQL.
import {spawn} from 'node:child_process';
const host=process.env.PGHOST||'127.0.0.1';
if(!['127.0.0.1','localhost','::1'].includes(host))throw new Error('ISOLATED_LOOPBACK_DATABASE_REQUIRED');
export function literal(value){
 if(value===null||value===undefined)return 'null';
 if(typeof value==='boolean')return value?'true':'false';
 if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('FINITE_SQL_VALUE_REQUIRED');return String(value)}
 const text=typeof value==='object'?JSON.stringify(value):String(value);
 if(text.includes('\u0000'))throw new Error('SQL_NUL_DENIED');
 return "'"+text.replaceAll("'","''")+"'";
}
export function execute(text){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.PSQL_BIN||'psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',host,'-p',process.env.PGPORT||'5432','-U',process.env.PGUSER||'postgres','-d',process.env.PGDATABASE||'postgres'],{env:process.env,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('ISOLATED_SQL_TIMEOUT'))},30000);
  child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);child.on('error',reject);
  child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(new Error(stderr.trim()||'ISOLATED_SQL_FAILED'));else resolve(stdout.trim())});
  child.stdin.end(text+'\n');
 });
}
export async function rows(query){return JSON.parse(await execute(`select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (${query.replace(/;\s*$/,'')}) q;`))}
export async function sql(strings,...values){let query=strings[0];values.forEach((value,i)=>query+=literal(value)+strings[i+1]);return rows(query)}
sql.json=value=>value;
export async function verifyDisposableDatabase(){
 const result=await rows("select to_regclass('portal_private.qa_session_roles') is not null and to_regclass('test_application_v2.fixture') is not null as disposable");
 if(result[0]?.disposable!==true)throw new Error('SEEDED_DISPOSABLE_DATABASE_REQUIRED');
}
export async function fixture(){return Object.fromEntries((await rows('select k,v from test_application_v2.fixture')).map(x=>[x.k,x.v]))}
