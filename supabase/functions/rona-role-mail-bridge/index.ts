import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import PostalMime from "npm:postal-mime@2.7.5";

const MAIL_HOST = "mail.hosting.reg.ru";
const IMAP_PORT = 993;
const SMTP_PORT = 587;
const FOLDER = "INBOX";
const MAX_FETCH_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "exec_director@ronaoil.com",
  "lawyer@ronaoil.com",
  "finance@ronaoil.com",
  "analyst@ronaoil.com",
  "rail_spec@ronaoil.com",
]);
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
async function vaultSecret(name: string) {
  const rows = await sql<{decrypted_secret:string}[]>`select decrypted_secret from vault.decrypted_secrets where name=${name} limit 1`;
  return rows[0]?.decrypted_secret ?? "";
}
async function runtimeToken() {
  const rows = await sql<{token:string}[]>`select token from private.rona_mail_bridge_runtime_secret where singleton=true limit 1`;
  return rows[0]?.token ?? "";
}
function safeEqual(a:string,b:string){const aa=enc.encode(a),bb=enc.encode(b);if(aa.length!==bb.length)return false;let d=0;for(let i=0;i<aa.length;i++)d|=aa[i]^bb[i];return d===0;}
function mailboxOf(body:any){const m=String(body?.mailbox??"").toLowerCase();if(!ALLOWED.has(m))throw new Error("mailbox not allowed");return m;}
async function writeLine(c:Deno.Conn,s:string){await c.write(enc.encode(s+"\r\n"));}
async function writeRaw(c:Deno.Conn,s:string){await c.write(enc.encode(s));}
async function readLine(c:Deno.Conn){const a:number[]=[];const one=new Uint8Array(1);while(true){const n=await c.read(one);if(n===null)break;a.push(one[0]);const l=a.length;if(l>=2&&a[l-2]===13&&a[l-1]===10)break;if(l>1024*1024)throw new Error("protocol line too long");}return dec.decode(new Uint8Array(a)).replace(/\r?\n$/,"");}
async function readExact(c:Deno.Conn,n:number){const out=new Uint8Array(n);let o=0;while(o<n){const r=await c.read(out.subarray(o));if(r===null)throw new Error("connection closed");o+=r;}return out;}
async function untilTag(c:Deno.Conn,tag:string){const lines:string[]=[];while(true){const l=await readLine(c);if(!l)throw new Error("connection closed");lines.push(l);if(l.startsWith(tag+" "))return lines;}}
async function fetchReply(c:Deno.Conn,tag:string){const lines:string[]=[];const literals:Uint8Array[]=[];while(true){const l=await readLine(c);if(!l)throw new Error("connection closed during fetch");lines.push(l);const m=l.match(/\{(\d+)\}$/);if(m){literals.push(await readExact(c,Number(m[1])));const t=await readLine(c);if(t)lines.push(t);if(t.startsWith(tag+" "))break;}if(l.startsWith(tag+" "))break;}return {lines,literals};}
function q(v:string){return `"${v.replaceAll("\\","\\\\").replaceAll('"','\\"')}"`;}
function unfold(s:string){return s.replace(/\r?\n[\t ]+/g," ");}
function headers(raw:string){const o:Record<string,string>={};for(const l of unfold(raw).split(/\r?\n/)){const i=l.indexOf(":");if(i<=0)continue;const k=l.slice(0,i).trim().toLowerCase();if(!(k in o))o[k]=l.slice(i+1).trim();}return o;}
function emails(s=""){return [...new Set((s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[]).map(x=>x.toLowerCase()))];}
function fromName(s=""){const b=s.includes("<")?s.split("<")[0]:"";return b.trim().replace(/^"|"$/g,"")||null;}
function postalAddresses(v:any):string[]{const input=Array.isArray(v)?v:v?[v]:[];const out:string[]=[];for(const i of input){if(i?.address)out.push(String(i.address).toLowerCase());if(Array.isArray(i?.group))out.push(...postalAddresses(i.group));}return [...new Set(out)];}
function postalName(v:any){return v?.name?String(v.name):null;}
function toB64(value:any){let bytes:Uint8Array;if(value instanceof Uint8Array)bytes=value;else if(value instanceof ArrayBuffer)bytes=new Uint8Array(value);else if(ArrayBuffer.isView(value))bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);else throw new Error("attachment content unavailable");let bin="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk){bin+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));}return btoa(bin);}

async function imapLogin(mailbox:string){const pass=await vaultSecret("rona_mail_password");if(!pass)throw new Error("mail password missing");const c=await Deno.connectTls({hostname:MAIL_HOST,port:IMAP_PORT});const g=await readLine(c);if(!g.startsWith("* OK")){c.close();throw new Error("IMAP greeting rejected");}await writeLine(c,`a001 LOGIN ${q(mailbox)} ${q(pass)}`);const r=await untilTag(c,"a001");if(!r.some(x=>/^a001 OK\b/i.test(x))){c.close();throw new Error("IMAP login failed");}return c;}
async function selectInbox(c:Deno.Conn,tag="a002"){await writeLine(c,`${tag} SELECT ${q(FOLDER)}`);const lines=await untilTag(c,tag);if(!lines.some(x=>new RegExp(`^${tag} OK\\b`,"i").test(x)))throw new Error("IMAP SELECT failed");return {uidValidity:Number(lines.join("\n").match(/UIDVALIDITY\s+(\d+)/i)?.[1]??0),exists:Number(lines.join("\n").match(/\*\s+(\d+)\s+EXISTS/i)?.[1]??0)};}
async function smtpResponse(c:Deno.Conn){const lines:string[]=[];while(true){const l=await readLine(c);if(!l)throw new Error("SMTP closed");lines.push(l);const m=l.match(/^(\d{3})([ -])/);if(m&&m[2]===" ")return {code:Number(m[1]),lines};}}
async function smtpLogin(mailbox:string){const pass=await vaultSecret("rona_mail_password");if(!pass)throw new Error("mail password missing");const tcp=await Deno.connect({hostname:MAIL_HOST,port:SMTP_PORT}) as Deno.TcpConn;let c:Deno.Conn=tcp;let r=await smtpResponse(c);if(r.code!==220)throw new Error(`SMTP greeting ${r.code}`);await writeLine(c,"EHLO rona-role-bridge");r=await smtpResponse(c);if(r.code!==250||!r.lines.some(x=>/STARTTLS/i.test(x)))throw new Error("SMTP STARTTLS unavailable");await writeLine(c,"STARTTLS");r=await smtpResponse(c);if(r.code!==220)throw new Error(`SMTP STARTTLS ${r.code}`);c=await Deno.startTls(tcp,{hostname:MAIL_HOST});await writeLine(c,"EHLO rona-role-bridge");r=await smtpResponse(c);if(r.code!==250)throw new Error(`SMTP EHLO ${r.code}`);await writeLine(c,"AUTH LOGIN");r=await smtpResponse(c);if(r.code!==334)throw new Error(`SMTP AUTH ${r.code}`);await writeLine(c,btoa(mailbox));r=await smtpResponse(c);if(r.code!==334)throw new Error(`SMTP username ${r.code}`);await writeLine(c,btoa(pass));r=await smtpResponse(c);if(r.code!==235)throw new Error(`SMTP password ${r.code}`);return c;}

async function authTest(mailbox:string){const i=await imapLogin(mailbox);try{await writeLine(i,"a999 LOGOUT");}catch{}try{i.close();}catch{}const s=await smtpLogin(mailbox);try{await writeLine(s,"QUIT");}catch{}try{s.close();}catch{}return {mailbox,imap:{ok:true,port:IMAP_PORT},smtp:{ok:true,port:SMTP_PORT,security:"STARTTLS"}};}

async function syncInbox(mailbox:string){const c=await imapLogin(mailbox);try{const sel=await selectInbox(c);const state=await sql<{last_uid:number|string;uid_validity:number|string}[]>`select last_uid,uid_validity from public.rona_mail_sync_state where mailbox=${mailbox} and folder=${FOLDER} limit 1`;let last=Number(state[0]?.last_uid??0);const old=Number(state[0]?.uid_validity??0);if(old&&sel.uidValidity&&old!==sel.uidValidity)last=0;const tag="a003";await writeLine(c,last>0?`${tag} UID SEARCH UID ${last+1}:*`:`${tag} UID SEARCH ALL`);const sl=await untilTag(c,tag);const line=sl.find(x=>x.startsWith("* SEARCH"))??"* SEARCH";let uids=line.replace(/^\* SEARCH\s*/,"").trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);if(last===0&&uids.length>20)uids=uids.slice(-20);if(uids.length>50)uids=uids.slice(0,50);let max=last,synced=0,n=10;for(const uid of uids){const t=`a${n++}`;await writeLine(c,`${t} UID FETCH ${uid} (UID RFC822.SIZE INTERNALDATE BODY.PEEK[HEADER.FIELDS (MESSAGE-ID DATE FROM TO CC SUBJECT REPLY-TO)])`);const f=await fetchReply(c,t);if(!f.lines.some(x=>x.startsWith(t+" OK")))continue;const joined=f.lines.join(" ");const raw=f.literals[0]?dec.decode(f.literals[0]):"";const h=headers(raw);const d=h["date"]?new Date(h["date"]):null;const received=d&&!Number.isNaN(d.getTime())?d.toISOString():null;const size=Number(joined.match(/RFC822\.SIZE\s+(\d+)/i)?.[1]??0);const mid=h["message-id"]?.replace(/^<|>$/g,"")??null;const from=emails(h["from"]??"")[0]??null;await sql`insert into public.rona_mail_messages (mailbox,folder,uid_validity,imap_uid,rfc_message_id,direction,sent_at,received_at,from_addr,from_name,reply_to,to_addrs,cc_addrs,subject,headers,flags,has_attachments,attachments,source_size,synced_at,updated_at) values (${mailbox},${FOLDER},${sel.uidValidity},${uid},${mid},'INBOUND',${received},${received},${from},${fromName(h["from"]??"")},${emails(h["reply-to"]??"")[0]??null},${JSON.stringify(emails(h["to"]??""))}::jsonb,${JSON.stringify(emails(h["cc"]??""))}::jsonb,${h["subject"]??null},${JSON.stringify({...h,raw_header:raw})}::jsonb,${[]}::text[],false,'[]'::jsonb,${size},now(),now()) on conflict (mailbox,folder,uid_validity,imap_uid) do update set rfc_message_id=excluded.rfc_message_id,received_at=excluded.received_at,from_addr=excluded.from_addr,from_name=excluded.from_name,reply_to=excluded.reply_to,to_addrs=excluded.to_addrs,cc_addrs=excluded.cc_addrs,subject=excluded.subject,headers=excluded.headers,source_size=excluded.source_size,synced_at=now(),updated_at=now()`;synced++;if(uid>max)max=uid;}await sql`insert into public.rona_mail_sync_state (mailbox,folder,uid_validity,last_uid,last_sync_at,status,last_error,updated_at) values (${mailbox},${FOLDER},${sel.uidValidity},${max},now(),'OK',null,now()) on conflict (mailbox,folder) do update set uid_validity=excluded.uid_validity,last_uid=excluded.last_uid,last_sync_at=excluded.last_sync_at,status='OK',last_error=null,updated_at=now()`;const result:any={mailbox,folder:FOLDER,exists:sel.exists,last_uid:max,candidates:uids.length,synced};if(mailbox==="finance@ronaoil.com"){try{result.finance_intake=await processFinanceIntake(mailbox);}catch(financeError){console.error("FINANCE_MAIL_INTAKE_AFTER_SYNC_FAILED",financeError instanceof Error?financeError.message:String(financeError));result.finance_intake={status:"ERROR",error:financeError instanceof Error?financeError.message:String(financeError)};}}return result;}catch(e){await sql`insert into public.rona_mail_sync_state (mailbox,folder,uid_validity,last_uid,last_sync_at,status,last_error,updated_at) values (${mailbox},${FOLDER},0,0,now(),'ERROR',${e instanceof Error?e.message:String(e)},now()) on conflict (mailbox,folder) do update set last_sync_at=now(),status='ERROR',last_error=excluded.last_error,updated_at=now()`;throw e;}finally{try{c.close();}catch{}}}

async function fetchMessage(mailbox:string,uid:number,includeAttachmentContents=false){if(!Number.isInteger(uid)||uid<=0)throw new Error("invalid uid");const meta=await sql<{source_size:number|string}[]>`select source_size from public.rona_mail_messages where mailbox=${mailbox} and folder=${FOLDER} and imap_uid=${uid} order by synced_at desc limit 1`;if(!meta.length)throw new Error("uid not synchronized");if(Number(meta[0].source_size??0)>MAX_FETCH_BYTES)throw new Error("message too large");const c=await imapLogin(mailbox);try{await selectInbox(c);const tag="a004";await writeLine(c,`${tag} UID FETCH ${uid} (UID RFC822.SIZE BODY.PEEK[])`);const f=await fetchReply(c,tag);if(!f.lines.some(x=>x.startsWith(tag+" OK")))throw new Error("full fetch failed");const raw=f.literals[0];if(!raw||raw.byteLength>MAX_FETCH_BYTES)throw new Error("message unavailable or too large");const mail:any=await PostalMime.parse(raw);const at=(mail.attachments??[]).map((a:any)=>{const base:any={filename:a.filename??null,mime_type:a.mimeType??null,disposition:a.disposition??null,content_id:a.contentId??null,related:Boolean(a.related),size:a.content?.byteLength??a.content?.length??null};if(includeAttachmentContents)base.content_b64=toB64(a.content);return base;});const to=postalAddresses(mail.to),cc=postalAddresses(mail.cc),from=postalAddresses(mail.from),reply=postalAddresses(mail.replyTo);let sentAt:string|null=null;if(mail.date){const d=new Date(mail.date);if(!Number.isNaN(d.getTime()))sentAt=d.toISOString();}const mid=mail.messageId?String(mail.messageId).replace(/^<|>$/g,""):null;const tb=typeof mail.text==="string"?mail.text:null;const hb=typeof mail.html==="string"?mail.html:null;const storedAt=at.map((a:any)=>{const {content_b64,...m}=a;return m;});await sql`update public.rona_mail_messages set rfc_message_id=coalesce(${mid},rfc_message_id),sent_at=coalesce(${sentAt},sent_at),from_addr=coalesce(${from[0]??null},from_addr),from_name=coalesce(${postalName(mail.from)},from_name),reply_to=coalesce(${reply[0]??null},reply_to),to_addrs=${JSON.stringify(to)}::jsonb,cc_addrs=${JSON.stringify(cc)}::jsonb,subject=coalesce(${mail.subject??null},subject),text_body=${tb},html_body=${hb},has_attachments=${at.length>0},attachments=${JSON.stringify(storedAt)}::jsonb,source_size=${raw.byteLength},synced_at=now(),updated_at=now() where mailbox=${mailbox} and folder=${FOLDER} and imap_uid=${uid}`;return {mailbox,uid,stored:true,subject:mail.subject??null,attachments:at,bytes:raw.byteLength};}finally{try{c.close();}catch{}}}

async function financeSourceSha(value:string){const bytes=new TextEncoder().encode(value);const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");}
function financeIntakeRetryable(error:any){const message=String(error instanceof Error?error.message:error||"");return !/(message too large|invalid uid)/i.test(message);}
function financeIso(v:any){if(!v)return null;try{return v instanceof Date?v.toISOString():new Date(v).toISOString();}catch{return String(v);}}
async function processFinanceIntake(mailbox:string){
  if(mailbox!=="finance@ronaoil.com")return {status:"NOT_APPLICABLE",claimed:0,results:[]};
  await sql`select portal_private.finance_mail_intake_discover_v1()`;
  const claimed=await sql<any[]>`select * from portal_private.finance_mail_intake_claim_v1(8)`;
  const results:any[]=[];
  for(const item of claimed){
    try{
      const fetched:any=await fetchMessage(mailbox,Number(item.imap_uid),true);
      const rows=await sql<any[]>`select mailbox,folder,uid_validity,imap_uid,rfc_message_id,direction,sent_at,received_at,from_addr,from_name,reply_to,to_addrs,cc_addrs,bcc_addrs,subject,text_body,html_body,headers,flags,has_attachments,attachments,source_size,synced_at,updated_at from public.rona_mail_messages where id=${item.message_record_id}::uuid limit 1`;
      if(rows.length!==1)throw new Error("FINANCE_MAIL_SOURCE_ROW_MISSING");
      const row=rows[0];
      const snapshot={
        source_contract:"FINANCE_MAIL_SOURCE_V1",
        mailbox:String(row.mailbox||""),
        folder:String(row.folder||""),
        uid_validity:String(row.uid_validity||""),
        imap_uid:String(row.imap_uid||""),
        rfc_message_id:row.rfc_message_id??null,
        direction:row.direction??null,
        sent_at:financeIso(row.sent_at),
        received_at:financeIso(row.received_at),
        from_addr:row.from_addr??null,
        from_name:row.from_name??null,
        reply_to:row.reply_to??null,
        to_addrs:Array.isArray(row.to_addrs)?row.to_addrs:[],
        cc_addrs:Array.isArray(row.cc_addrs)?row.cc_addrs:[],
        bcc_addrs:Array.isArray(row.bcc_addrs)?row.bcc_addrs:[],
        subject:row.subject??null,
        text_body:row.text_body??null,
        html_body:row.html_body??null,
        headers:row.headers??{},
        flags:Array.isArray(row.flags)?row.flags:[],
        has_attachments:Boolean(row.has_attachments),
        attachments:Array.isArray(fetched?.attachments)?fetched.attachments:(Array.isArray(row.attachments)?row.attachments:[]),
        source_size:row.source_size===null||row.source_size===undefined?null:Number(row.source_size),
        synced_at:financeIso(row.synced_at),
        updated_at:financeIso(row.updated_at)
      };
      const checksum=await financeSourceSha(JSON.stringify(snapshot));
      const completed=await sql<any[]>`select portal_private.finance_mail_intake_complete_v1(${item.id}::uuid,${JSON.stringify(snapshot)}::jsonb,${checksum}) result`;
      results.push({id:String(item.id),status:"QUEUED_TO_FINANCE",result:completed[0]?.result??null});
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      const state=await sql<any[]>`select portal_private.finance_mail_intake_fail_v1(${item.id}::uuid,${message.slice(0,120)},${message.slice(0,4000)},${financeIntakeRetryable(error)}) state`;
      results.push({id:String(item.id),status:state[0]?.state??"FAILED",error:message.slice(0,120)});
    }
  }
  const health=await sql<any[]>`select portal_private.finance_mail_intake_health_v1() result`;
  return {status:"OK",claimed:claimed.length,results,health:health[0]?.result??null};
}

function clean(v:string){return v.replace(/[\r\n]+/g," ").trim();}
function norm(v:string){return v.replace(/\r?\n/g,"\r\n");}
function dot(v:string){return v.split("\r\n").map(x=>x.startsWith(".")?"."+x:x).join("\r\n");}
function rawMessage(mailbox:string,row:any,messageId:string){const body=norm(row.text_body??row.html_body??"");const html=Boolean(row.html_body&&!row.text_body);const h=[`From: RONA Trade <${mailbox}>`,`To: ${(row.to_addrs??[]).join(", ")}`,row.cc_addrs?.length?`Cc: ${row.cc_addrs.join(", ")}`:null,row.reply_to?`Reply-To: ${clean(String(row.reply_to))}`:null,`Subject: ${clean(row.subject??"")}`,`Date: ${new Date().toUTCString()}`,`Message-ID: ${messageId}`,row.in_reply_to?`In-Reply-To: ${clean(String(row.in_reply_to))}`:null,row.references_header?`References: ${clean(String(row.references_header))}`:null,"MIME-Version: 1.0",`Content-Type: ${html?"text/html":"text/plain"}; charset=UTF-8`,`Content-Transfer-Encoding: 8bit`].filter(Boolean).join("\r\n");return h+"\r\n\r\n"+body+"\r\n";}
async function smtpSend(mailbox:string,row:any){const c=await smtpLogin(mailbox);const mid=`<${crypto.randomUUID()}@ronaoil.com>`;const raw=rawMessage(mailbox,row,mid);try{await writeLine(c,`MAIL FROM:<${mailbox}>`);let r=await smtpResponse(c);if(r.code!==250)throw new Error(`MAIL FROM ${r.code}`);const rec=[...new Set([...(row.to_addrs??[]),...(row.cc_addrs??[]),...(row.bcc_addrs??[])])];if(!rec.length)throw new Error("no recipients");for(const a of rec){await writeLine(c,`RCPT TO:<${a}>`);r=await smtpResponse(c);if(![250,251].includes(r.code))throw new Error(`RCPT ${a} ${r.code}`);}await writeLine(c,"DATA");r=await smtpResponse(c);if(r.code!==354)throw new Error(`DATA ${r.code}`);await writeRaw(c,dot(raw)+".\r\n");r=await smtpResponse(c);if(r.code!==250)throw new Error(`SMTP final ${r.code}`);try{await writeLine(c,"QUIT");}catch{}return {messageId:mid};}finally{try{c.close();}catch{}}}
async function processOutbox(mailbox:string){const rows=await sql<any[]>`select id,mailbox,to_addrs,cc_addrs,bcc_addrs,subject,text_body,html_body,reply_to,in_reply_to,references_header from public.rona_mail_outbox where status='QUEUED' and mailbox=${mailbox} order by created_at asc limit 5`;const results:any[]=[];for(const row of rows){const lock=await sql<any[]>`update public.rona_mail_outbox set status='SENDING',attempts=attempts+1,locked_at=now(),updated_at=now() where id=${row.id} and status='QUEUED' returning id`;if(!lock.length)continue;try{const {messageId}=await smtpSend(mailbox,row);await sql`update public.rona_mail_outbox set status='SENT',sent_at=now(),smtp_message_id=${messageId},last_error=null,updated_at=now() where id=${row.id}`;results.push({id:row.id,status:'SENT',message_id:messageId});}catch(e){const err=e instanceof Error?e.message:String(e);await sql`update public.rona_mail_outbox set status='FAILED',last_error=${err},updated_at=now() where id=${row.id}`;results.push({id:row.id,status:'FAILED',error:err});}}return {mailbox,processed:rows.length,results};}

Deno.serve(async(req:Request)=>{if(req.method!=="POST")return json({error:"POST required"},405);try{const expected=await runtimeToken();const supplied=req.headers.get("x-rona-mail-internal-key")??"";if(!expected||!safeEqual(supplied,expected))return json({error:"unauthorized"},401);const body=await req.json().catch(()=>({}));const mailbox=mailboxOf(body);const action=String(body?.action??"status");if(action==="status")return json({service:"rona-role-mail-bridge",mailbox,protected:true,imap_port:IMAP_PORT,smtp_port:SMTP_PORT});if(action==="auth-test")return json(await authTest(mailbox));if(action==="sync-inbox")return json(await syncInbox(mailbox));if(action==="fetch-message")return json(await fetchMessage(mailbox,Number(body?.uid),Boolean(body?.include_attachment_contents)));if(action==="process-outbox")return json(await processOutbox(mailbox));return json({error:"unknown action"},400);}catch(e){console.error("rona-role-mail-bridge",e instanceof Error?e.message:String(e));return json({error:e instanceof Error?e.message:String(e)},502);}});
