import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const DIST=join(ROOT,'dist');
const HOME=join(DIST,'pages','home_compact.html');
const V1='<script id="rona-g82-real-auth-entry-loader-v1" src="/assets/g82/portal-real-auth-entry-v1.js" defer></script>';
const V2='<script id="rona-g82-inline-auth-loader-v2" src="/assets/g82/portal-home-inline-auth-v2.js" defer></script>';
const PLACEHOLDER='Серверная авторизация будет подключена после утверждения дизайна.';
let authPosts=0;
let lastAuthBody=null;

function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':e==='.jpg'||e==='.jpeg'?'image/jpeg':'application/octet-stream'}
function send(res,status,body,type='text/plain; charset=utf-8',headers={}){res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body)}
function safeDist(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
async function serveStatic(res,pathname){const path=safeDist(pathname);if(!path)return false;try{const s=await stat(path);if(!s.isFile())return false;const b=await readFile(path);send(res,200,b,mime(path));return true}catch{return false}}

const raw=await readFile(HOME,'utf8');
if(!/<head(?:\s[^>]*)?>/i.test(raw))throw new Error('HOME_HEAD_NOT_FOUND');
const home=raw.replace(/<head(?:\s[^>]*)?>/i,m=>m+V1+V2);

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/', 'http://127.0.0.1');
  if(u.pathname==='/pages/home_compact'||u.pathname==='/pages/home_compact.html')return send(res,200,home,'text/html; charset=utf-8',{'x-rona-real-auth-entry':'g8.2-production-login-fix-v1','x-rona-inline-auth-entry':'g8.2-inline-auth-v2'});
  if(u.pathname==='/portal/auth/login'&&req.method==='POST'){
    authPosts+=1;let body='';for await(const chunk of req)body+=chunk;try{lastAuthBody=JSON.parse(body)}catch{lastAuthBody=null}
    return send(res,401,JSON.stringify({ok:false,code:'LOGIN_DENIED'}),'application/json; charset=utf-8');
  }
  if(await serveStatic(res,u.pathname))return;
  send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;

function assert(v,m){if(!v)throw new Error(m)}
async function credentialFrame(page){
  for(let attempt=0;attempt<60;attempt++){
    for(const frame of page.frames()){
      const pwd=frame.locator('input[type="password"],input[name*="pass" i]').first();
      if(await pwd.count()&&await pwd.isVisible().catch(()=>false))return frame;
    }
    await page.waitForTimeout(100);
  }
  return null;
}
async function allText(page){let text='';for(const frame of page.frames())text+='\n'+await frame.locator('body').innerText().catch(()=> '');return text}

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(origin+'/pages/home_compact.html?layout=compact',{waitUntil:'domcontentloaded',timeout:30000});
  const frame=await credentialFrame(page);assert(frame,'visible inline credential form not found');
  const pwd=frame.locator('input[type="password"],input[name*="pass" i]').first();
  let id=frame.locator('input[name*="login" i],input[name*="user" i],input[type="email"],input[name*="email" i]').first();
  if(!(await id.count()))id=frame.locator('input[type="text"],input:not([type])').first();
  assert(await id.count(),'identifier input not found');
  let button=frame.locator('button[type="submit"],input[type="submit"]').first();
  if(!(await button.count()))button=frame.getByRole('button',{name:/войти|login|sign in/i}).first();
  assert(await button.count(),'login button not found');
  await id.fill('qa-inline@example.invalid');
  await pwd.fill('wrong-password');
  await button.click();
  for(let i=0;i<30&&authPosts<1;i++)await page.waitForTimeout(100);
  assert(authPosts===1,`expected exactly one POST /portal/auth/login, got ${authPosts}`);
  assert(lastAuthBody?.identifier==='qa-inline@example.invalid','real auth identifier payload missing');
  assert(lastAuthBody?.password==='wrong-password','real auth password payload missing');
  await page.waitForTimeout(250);
  const text=await allText(page);
  assert(!text.includes(PLACEHOLDER),'legacy design-only auth placeholder became visible');
  assert(text.includes('Неверный логин или пароль.'),'real auth denial message did not render');
  const marker=await page.evaluate(()=>!!window.__RONA_G82_HOME_INLINE_AUTH_V2__).catch(()=>false);
  const frameMarker=await frame.evaluate(()=>!!window.__RONA_G82_HOME_INLINE_AUTH_V2__).catch(()=>false);
  assert(marker||frameMarker,'inline auth v2 runtime marker missing');
  assert(errors.length===0,'browser page errors: '+errors.join(' | '));
  console.log('HOME_INLINE_REAL_AUTH_BROWSER_QA=PASS');
  console.log(JSON.stringify({origin,authPosts,topMarker:marker,frameMarker,placeholderVisible:false,realDenialVisible:true}));
  await context.close();
}catch(e){console.error('HOME_INLINE_REAL_AUTH_BROWSER_QA=FAIL',e?.stack||e);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}
