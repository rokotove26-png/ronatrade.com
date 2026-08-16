const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const OWNER_ID = 'c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL = 'office_kg@ronaoil.com';
const ACCESS_COOKIE = 'rona_portal_at';
const RESET_COOKIE = 'rona_pwreset';
const SECURITY = Object.freeze({
  'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
});
function cookies(header) { const out={}; for(const part of String(header||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();} return out; }
function redirect(location) { const h=new Headers(SECURITY);h.set('location',location);return new Response(null,{status:303,headers:h}); }
function html(body,status=200) { const h=new Headers(SECURITY);h.set('content-type','text/html; charset=utf-8');return new Response(body,{status,headers:h}); }
function page(message='') {
  const error=message?`<div class="err">${message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`:'';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Новый пароль</title><style>:root{font-family:Inter,Arial,sans-serif;color:#eef4f7;background:#05090d}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 80% 10%,#152633 0,#071018 42%,#05090d 75%)}.box{width:min(440px,calc(100vw - 32px));padding:28px;border:1px solid rgba(171,220,239,.24);border-radius:18px;background:rgba(8,15,22,.92)}h1{font-size:25px;margin:0 0 6px}.sub{color:#9db1bc;margin:0 0 22px}.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;color:#afc0c9}.field input{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(171,220,239,.26);background:#09121a;color:#fff;font:inherit}.btn{width:100%;margin-top:10px;padding:12px;border:1px solid rgba(224,66,75,.45);border-radius:10px;background:rgba(224,66,75,.15);color:#fff;font-weight:800;cursor:pointer}.note{font-size:12px;color:#8298a4;line-height:1.45}.err{padding:10px 12px;border-radius:9px;background:#4b1e23;color:#ffdfe3;margin:12px 0;font-size:13px}</style></head><body><main class="box"><h1>Установите новый пароль</h1><p class="sub">RONA Trade — защищённый контур владельца</p>${error}<form method="post" action="/portal/auth/password-reset" autocomplete="off"><div class="field"><label for="p1">Новый пароль</label><input id="p1" name="password" type="password" minlength="14" maxlength="72" autocomplete="new-password" required></div><div class="field"><label for="p2">Повторите пароль</label><input id="p2" name="confirm" type="password" minlength="14" maxlength="72" autocomplete="new-password" required></div><button class="btn" type="submit">Сохранить новый пароль</button></form><p class="note">Минимум 14 символов: заглавная и строчная буквы, цифра и специальный символ. После сохранения текущая recovery-сессия будет завершена; вход выполняется заново.</p></main></body></html>`;
}
async function currentUser(token) {
  if (!token) return null;
  try { const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,accept:'application/json'}}); if(!r.ok)return null; return await r.json(); } catch { return null; }
}
export async function onRequestGet({request}) {
  const c=cookies(request.headers.get('cookie'));
  if(c[RESET_COOKIE]!=='1')return redirect('/portal/login?recovery=required');
  const user=await currentUser(c[ACCESS_COOKIE]);
  if(!user||String(user.id||'')!==OWNER_ID||String(user.email||'').toLowerCase()!==OWNER_EMAIL)return redirect('/portal/login?recovery=expired');
  return html(page());
}
