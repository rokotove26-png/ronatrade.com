import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import PostalMime from "npm:postal-mime@2.7.5";

const MAIL_HOST = "mail.hosting.reg.ru";
const IMAP_PORT = 993;
const SMTP_PORT = 587;
const MAILBOX = "finance@ronaoil.com";
const FOLDER = "INBOX";
const MAX_FETCH_BYTES = 5 * 1024 * 1024;
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

async function getVaultSecret(name: string): Promise<string> {
  const rows = await sql<{ decrypted_secret: string }[]>`select decrypted_secret from vault.decrypted_secrets where name=${name} limit 1`;
  return rows[0]?.decrypted_secret ?? "";
}

async function getRuntimeToken(): Promise<string> {
  const rows = await sql<{ token: string }[]>`select token from private.rona_accounting_mail_bridge_runtime_secret where singleton=true limit 1`;
  return rows[0]?.token ?? "";
}

function safeEqual(a: string, b: string) {
  const aa = enc.encode(a), bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i=0;i<aa.length;i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function writeLine(conn: Deno.Conn, line: string) { await conn.write(enc.encode(line + "\r\n")); }
async function writeRaw(conn: Deno.Conn, value: string) { await conn.write(enc.encode(value)); }

async function readLine(conn: Deno.Conn): Promise<string> {
  const bytes:number[]=[]; const one=new Uint8Array(1);
  while (true) {
    const n=await conn.read(one); if (n===null) break;
    bytes.push(one[0]); const len=bytes.length;
    if (len>=2 && bytes[len-2]===13 && bytes[len-1]===10) break;
    if (len>1024*1024) throw new Error("protocol line too long");
  }
  return dec.decode(new Uint8Array(bytes)).replace(/\r?\n$/, "");
}

async function readExact(conn:Deno.Conn,size:number):Promise<Uint8Array>{
  const out=new Uint8Array(size); let offset=0;
  while(offset<size){const n=await conn.read(out.subarray(offset)); if(n===null) throw new Error("connection closed during literal read"); offset+=n;}
  return out;
}

async function readUntilTag(conn:Deno.Conn,tag:string){
  const lines:string[]=[];
  while(true){const line=await readLine(conn); if(!line) throw new Error("connection closed"); lines.push(line); if(line.startsWith(tag+" ")) return lines;}
}

async function readFetch(conn:Deno.Conn,tag:string){
  const lines:string[]=[]; const literals:Uint8Array[]=[];
  while(true){
    const line=await readLine(conn); if(!line) throw new Error("connection closed during fetch"); lines.push(line);
    const m=line.match(/\{(\d+)\}$/);
    if(m){const literal=await readExact(conn,Number(m[1])); literals.push(literal); const trail=await readLine(conn); if(trail) lines.push(trail); if(trail.startsWith(tag+" ")) break;}
    if(line.startsWith(tag+" ")) break;
  }
  return {lines,literals};
}

function imapQuote(value:string){return `"${value.replaceAll("\\","\\\\").replaceAll('"','\\"')}"`;}

async function imapLogin(){
  const password=await getVaultSecret("rona_finance_mail_password"); if(!password) throw new Error("finance mail password is not configured");
  const conn=await Deno.connectTls({hostname:MAIL_HOST,port:IMAP_PORT});
  const greeting=await readLine(conn); if(!greeting.startsWith("* OK")){conn.close(); throw new Error("IMAP greeting rejected");}
  await writeLine(conn,`a001 LOGIN ${imapQuote(MAILBOX)} ${imapQuote(password)}`);
  const login=await readUntilTag(conn,"a001"); if(!login.some(x=>/^a001 OK\b/i.test(x))){conn.close(); throw new Error("IMAP login failed");}
  return conn;
}

async function selectInbox(conn:Deno.Conn,tag="a002"){
  await writeLine(conn,`${tag} SELECT ${imapQuote(FOLDER)}`); const lines=await readUntilTag(conn,tag);
  if(!lines.some(x=>new RegExp(`^${tag} OK\\b`,"i").test(x))) throw new Error("IMAP SELECT INBOX failed");
  return {lines,uidValidity:Number(lines.join("\n").match(/UIDVALIDITY\s+(\d+)/i)?.[1]??0),exists:Number(lines.join("\n").match(/\*\s+(\d+)\s+EXISTS/i)?.[1]??0)};
}

function unfoldHeaders(raw:string){return raw.replace(/\r?\n[\t ]+/g," ");}
function parseHeaders(raw:string){const map:Record<string,string>={}; for(const line of unfoldHeaders(raw).split(/\r?\n/)){const i=line.indexOf(":"); if(i<=0) continue; const k=line.slice(0,i).trim().toLowerCase(); const v=line.slice(i+1).trim(); if(!(k in map)) map[k]=v;} return map;}
function emails(value=""){const matches=value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[]; return [...new Set(matches.map(x=>x.toLowerCase()))];}
function fromName(value=""){const before=value.includes("<")?value.split("<")[0]:""; return before.trim().replace(/^"|"$/g,"")||null;}
function postalAddresses(value:any):string[]{const input=Array.isArray(value)?value:value?[value]:[]; const out:string[]=[]; for(const item of input){if(item?.address) out.push(String(item.address).toLowerCase()); if(Array.isArray(item?.group)) out.push(...postalAddresses(item.group));} return [...new Set(out)];}
function postalName(value:any):string|null{return value?.name?String(value.name):null;}

async function authTest(){
  const imap=await imapLogin(); try{await writeLine(imap,"a999 LOGOUT");}catch{} try{imap.close();}catch{}
  const smtp=await smtpLogin(); try{await writeLine(smtp,"QUIT");}catch{} try{smtp.close();}catch{}
  return {mailbox:MAILBOX,imap:{ok:true,port:IMAP_PORT,security:"TLS"},smtp:{ok:true,port:SMTP_PORT,security:"STARTTLS"}};
}


function decodeMimeQHeader(value=""){
  return String(value||"").replace(/=\?utf-8\?q\?([^?]*)\?=/gi,(_m,q)=>{
    const bytes:number[]=[];
    for(let i=0;i<q.length;i++){
      if(q[i]==="_"){bytes.push(32);continue}
      if(q[i]==="="&&/^[0-9a-f]{2}$/i.test(q.slice(i+1,i+3))){bytes.push(parseInt(q.slice(i+1,i+3),16));i+=2;continue}
      bytes.push(q.charCodeAt(i)&255);
    }
    try{return dec.decode(Uint8Array.from(bytes))}catch{return q}
  }).replace(/\s+/g," ").trim();
}
function likelyBankStatementSubject(value=""){
  const s=decodeMimeQHeader(value).toLowerCase();
  return s.includes("выписк")||s.includes("bank statement")||s.includes("statement");
}
async function triggerStatementIntake(uid:number,subject:string){
  if(!likelyBankStatementSubject(subject))return;
  const token=await getRuntimeToken();
  if(!token)return;
  try{
    const res=await fetch("https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-accounting-statement-intake",{
      method:"POST",
      headers:{"content-type":"application/json","x-rona-mail-internal-key":token},
      body:JSON.stringify({uid})
    });
    if(!res.ok)console.error("statement intake trigger failed",uid,res.status);
  }catch(e){console.error("statement intake trigger error",uid,e instanceof Error?e.message:String(e))}
}

async function syncInbox(){
  const conn=await imapLogin();
  try{
    const selected=await selectInbox(conn); const uidValidity=selected.uidValidity; const exists=selected.exists;
    const state=await sql<{last_uid:number|string;uid_validity:number|string}[]>`select last_uid,uid_validity from public.rona_mail_sync_state where mailbox=${MAILBOX} and folder=${FOLDER} limit 1`;
    let lastUid=Number(state[0]?.last_uid??0); const oldValidity=Number(state[0]?.uid_validity??0); if(oldValidity&&uidValidity&&oldValidity!==uidValidity) lastUid=0;
    const searchTag="a003"; const searchCommand=lastUid>0?`${searchTag} UID SEARCH UID ${lastUid+1}:*`:`${searchTag} UID SEARCH ALL`;
    await writeLine(conn,searchCommand); const searchLines=await readUntilTag(conn,searchTag); const searchLine=searchLines.find(x=>x.startsWith("* SEARCH"))??"* SEARCH";
    let uids=searchLine.replace(/^\* SEARCH\s*/,"").trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);
    if(lastUid===0&&uids.length>10) uids=uids.slice(-10); if(uids.length>50) uids=uids.slice(0,50);
    let synced=0,maxUid=lastUid,counter=10;
    for(const uid of uids){
      const tag=`a${counter++}`; await writeLine(conn,`${tag} UID FETCH ${uid} (UID RFC822.SIZE INTERNALDATE BODY.PEEK[HEADER.FIELDS (MESSAGE-ID DATE FROM TO CC SUBJECT REPLY-TO)])`);
      const fetched=await readFetch(conn,tag); const joined=fetched.lines.join(" "); if(!fetched.lines.some(x=>x.startsWith(tag+" OK"))) continue;
      const headerRaw=fetched.literals[0]?dec.decode(fetched.literals[0]):""; const h=parseHeaders(headerRaw); const fromList=emails(h["from"]??""); const toList=emails(h["to"]??""); const ccList=emails(h["cc"]??""); const size=Number(joined.match(/RFC822\.SIZE\s+(\d+)/i)?.[1]??0); const internalDate=joined.match(/INTERNALDATE\s+"([^"]+)"/i)?.[1]??null; const headerDate=h["date"]?new Date(h["date"]):null; const received=headerDate&&!Number.isNaN(headerDate.getTime())?headerDate.toISOString():null; const messageId=h["message-id"]?.replace(/^<|>$/g,"")??null; const fromAddr=fromList[0]??null;
      await sql`insert into public.rona_mail_messages(mailbox,folder,uid_validity,imap_uid,rfc_message_id,direction,sent_at,received_at,from_addr,from_name,reply_to,to_addrs,cc_addrs,subject,headers,flags,has_attachments,attachments,source_size,synced_at,updated_at) values(${MAILBOX},${FOLDER},${uidValidity},${uid},${messageId},'INBOUND',${received},${received},${fromAddr},${fromName(h["from"]??"")},${emails(h["reply-to"]??"")[0]??null},${JSON.stringify(toList)}::jsonb,${JSON.stringify(ccList)}::jsonb,${h["subject"]??null},${JSON.stringify({...h,internal_date:internalDate,raw_header:headerRaw})}::jsonb,${[]}::text[],false,'[]'::jsonb,${size},now(),now()) on conflict(mailbox,folder,uid_validity,imap_uid) do update set rfc_message_id=excluded.rfc_message_id,received_at=excluded.received_at,from_addr=excluded.from_addr,from_name=excluded.from_name,reply_to=excluded.reply_to,to_addrs=excluded.to_addrs,cc_addrs=excluded.cc_addrs,subject=excluded.subject,headers=excluded.headers,source_size=excluded.source_size,synced_at=now(),updated_at=now()`;
      try{await triggerStatementIntake(uid,h["subject"]??"");}catch{} synced++; if(uid>maxUid) maxUid=uid;
    }
    await sql`insert into public.rona_mail_sync_state(mailbox,folder,uid_validity,last_uid,last_sync_at,status,last_error,updated_at) values(${MAILBOX},${FOLDER},${uidValidity},${maxUid},now(),'OK',null,now()) on conflict(mailbox,folder) do update set uid_validity=excluded.uid_validity,last_uid=excluded.last_uid,last_sync_at=excluded.last_sync_at,status='OK',last_error=null,updated_at=now()`;
    try{await writeLine(conn,"a998 LOGOUT");}catch{}
    return {mailbox:MAILBOX,folder:FOLDER,exists,uid_validity:uidValidity,previous_last_uid:lastUid,last_uid:maxUid,candidates:uids.length,synced};
  }catch(e){
    await sql`insert into public.rona_mail_sync_state(mailbox,folder,uid_validity,last_uid,last_sync_at,status,last_error,updated_at) values(${MAILBOX},${FOLDER},0,0,now(),'ERROR',${e instanceof Error?e.message:String(e)},now()) on conflict(mailbox,folder) do update set last_sync_at=now(),status='ERROR',last_error=excluded.last_error,updated_at=now()`;
    throw e;
  }finally{try{conn.close();}catch{}}
}

async function fetchMessage(uid:number){
  if(!Number.isInteger(uid)||uid<=0) throw new Error("invalid uid");
  const meta=await sql<{source_size:number|string}[]>`select source_size from public.rona_mail_messages where mailbox=${MAILBOX} and folder=${FOLDER} and imap_uid=${uid} order by synced_at desc limit 1`;
  if(!meta.length) throw new Error("message uid is not synchronized"); const knownSize=Number(meta[0].source_size??0); if(knownSize>MAX_FETCH_BYTES) throw new Error(`message too large for body fetch: ${knownSize} bytes`);
  const conn=await imapLogin();
  try{
    await selectInbox(conn); const tag="a004"; await writeLine(conn,`${tag} UID FETCH ${uid} (UID RFC822.SIZE BODY.PEEK[])`); const fetched=await readFetch(conn,tag); if(!fetched.lines.some(x=>x.startsWith(tag+" OK"))) throw new Error("IMAP full message fetch failed"); const raw=fetched.literals[0]; if(!raw) throw new Error("message body not returned"); if(raw.byteLength>MAX_FETCH_BYTES) throw new Error(`message too large for body fetch: ${raw.byteLength} bytes`);
    const mail:any=await PostalMime.parse(raw); const attachments=(mail.attachments??[]).map((a:any)=>({filename:a.filename??null,mime_type:a.mimeType??null,disposition:a.disposition??null,content_id:a.contentId??null,related:Boolean(a.related),size:a.content?.byteLength??a.content?.length??null})); const toList=postalAddresses(mail.to),ccList=postalAddresses(mail.cc),fromList=postalAddresses(mail.from),replyList=postalAddresses(mail.replyTo); let sentAt:string|null=null; if(mail.date){const d=new Date(mail.date); if(!Number.isNaN(d.getTime())) sentAt=d.toISOString();} const messageId=mail.messageId?String(mail.messageId).replace(/^<|>$/g,""):null; const textBody=typeof mail.text==="string"?mail.text:null; const htmlBody=typeof mail.html==="string"?mail.html:null;
    await sql`update public.rona_mail_messages set rfc_message_id=coalesce(${messageId},rfc_message_id),sent_at=coalesce(${sentAt},sent_at),from_addr=coalesce(${fromList[0]??null},from_addr),from_name=coalesce(${postalName(mail.from)},from_name),reply_to=coalesce(${replyList[0]??null},reply_to),to_addrs=${JSON.stringify(toList)}::jsonb,cc_addrs=${JSON.stringify(ccList)}::jsonb,subject=coalesce(${mail.subject??null},subject),text_body=${textBody},html_body=${htmlBody},has_attachments=${attachments.length>0},attachments=${JSON.stringify(attachments)}::jsonb,source_size=${raw.byteLength},synced_at=now(),updated_at=now() where mailbox=${MAILBOX} and folder=${FOLDER} and imap_uid=${uid}`;
    try{await writeLine(conn,"a998 LOGOUT");}catch{}
    return {uid,stored:true,subject:mail.subject??null,from:fromList[0]??null,to:toList,text_length:textBody?.length??0,html_length:htmlBody?.length??0,attachments,bytes:raw.byteLength};
  }finally{try{conn.close();}catch{}}
}

async function smtpResponse(conn:Deno.Conn){const lines:string[]=[]; while(true){const line=await readLine(conn); if(!line) throw new Error("SMTP connection closed"); lines.push(line); const m=line.match(/^(\d{3})([ -])/); if(m&&m[2]===" ") return {code:Number(m[1]),lines};}}

async function smtpLogin(){
  const password=await getVaultSecret("rona_finance_mail_password"); if(!password) throw new Error("finance mail password is not configured");
  const tcp=await Deno.connect({hostname:MAIL_HOST,port:SMTP_PORT}) as Deno.TcpConn; let conn:Deno.Conn=tcp; let r=await smtpResponse(conn); if(r.code!==220) throw new Error(`SMTP greeting ${r.code}`); await writeLine(conn,"EHLO rona-accounting-bridge"); r=await smtpResponse(conn); if(r.code!==250) throw new Error(`SMTP EHLO ${r.code}`); if(!r.lines.some(x=>/STARTTLS/i.test(x))) throw new Error("SMTP STARTTLS not advertised"); await writeLine(conn,"STARTTLS"); r=await smtpResponse(conn); if(r.code!==220) throw new Error(`SMTP STARTTLS ${r.code}`); conn=await Deno.startTls(tcp,{hostname:MAIL_HOST}); await writeLine(conn,"EHLO rona-accounting-bridge"); r=await smtpResponse(conn); if(r.code!==250) throw new Error(`SMTP EHLO after TLS ${r.code}`); await writeLine(conn,"AUTH LOGIN"); r=await smtpResponse(conn); if(r.code!==334) throw new Error(`SMTP AUTH ${r.code}`); await writeLine(conn,btoa(MAILBOX)); r=await smtpResponse(conn); if(r.code!==334) throw new Error(`SMTP username ${r.code}`); await writeLine(conn,btoa(password)); r=await smtpResponse(conn); if(r.code!==235) throw new Error(`SMTP password ${r.code}`); return conn;
}

function cleanHeader(v:string){return v.replace(/[\r\n]+/g," ").trim();}
function normalizeBodyForMessage(v:string){return v.replace(/\r?\n/g,"\r\n");}
function dotStuff(v:string){return v.split("\r\n").map(x=>x.startsWith(".")?"."+x:x).join("\r\n");}
function buildRawMessage(row:any,messageId:string){const isHtml=Boolean(row.html_body&&!row.text_body); const body=normalizeBodyForMessage(row.text_body??row.html_body??""); const headerLines=[`From: RONA Trade Finance <${MAILBOX}>`,`To: ${(row.to_addrs??[]).join(", ")}`,row.cc_addrs?.length?`Cc: ${row.cc_addrs.join(", ")}`:null,row.reply_to?`Reply-To: ${cleanHeader(String(row.reply_to))}`:null,`Subject: ${cleanHeader(row.subject??"")}`,`Date: ${new Date().toUTCString()}`,`Message-ID: ${messageId}`,row.in_reply_to?`In-Reply-To: ${cleanHeader(String(row.in_reply_to))}`:null,row.references_header?`References: ${cleanHeader(String(row.references_header))}`:null,"MIME-Version: 1.0",`Content-Type: ${isHtml?"text/html":"text/plain"}; charset=UTF-8`,"Content-Transfer-Encoding: 8bit"].filter(Boolean).join("\r\n"); return headerLines+"\r\n\r\n"+body+"\r\n";}

function decodeModifiedUtf7(input:string):string{return input.replace(/&([^-]*)-/g,(_m,chunk)=>{if(chunk==="") return "&"; try{let b64=String(chunk).replaceAll(",","/"); while(b64.length%4) b64+="="; const bin=atob(b64); const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)); return new TextDecoder("utf-16be").decode(bytes);}catch{return _m;}});}
function unquoteMailbox(v:string):string{const s=v.trim(); if(s.startsWith('"')&&s.endsWith('"')) return s.slice(1,-1).replace(/\\"/g,'"').replace(/\\\\/g,"\\"); return s;}
type MailboxInfo={name:string;flags:string[];decodedName:string};
function parseListLines(lines:string[]):MailboxInfo[]{const out:MailboxInfo[]=[]; for(const line of lines){const m=line.match(/^\* LIST \(([^)]*)\)\s+(?:"(?:\\.|[^"])*"|NIL)\s+(.+)$/i); if(!m) continue; const flags=m[1].split(/\s+/).filter(Boolean); const name=unquoteMailbox(m[2]); out.push({name,flags,decodedName:decodeModifiedUtf7(name)});} return out;}
async function listMailboxes(conn:Deno.Conn){const t1="a050"; await writeLine(conn,`${t1} LIST "" "*" RETURN (SPECIAL-USE)`); const l1=await readUntilTag(conn,t1); if(l1.some(x=>new RegExp(`^${t1} OK\\b`,"i").test(x))) return parseListLines(l1); const t2="a051"; await writeLine(conn,`${t2} LIST "" "*"`); const l2=await readUntilTag(conn,t2); if(!l2.some(x=>new RegExp(`^${t2} OK\\b`,"i").test(x))) throw new Error("IMAP LIST failed"); return parseListLines(l2);}
function chooseSentMailbox(boxes:MailboxInfo[]):string|null{const special=boxes.find(b=>b.flags.some(f=>f.toLowerCase()==="\\sent")); if(special) return special.name; const exact=["sent","sent messages","sent items","отправленные","исходящие"]; for(const wanted of exact){const hit=boxes.find(b=>b.decodedName.toLowerCase()===wanted); if(hit) return hit.name;} const fuzzy=boxes.find(b=>/(^|[/. ])sent([/. ]|$)/i.test(b.decodedName)||/отправ/i.test(b.decodedName)); return fuzzy?.name??null;}
async function ensureSentMailbox(conn:Deno.Conn):Promise<string>{const boxes=await listMailboxes(conn); const existing=chooseSentMailbox(boxes); if(existing) return existing; const folder="Sent"; const tag="a052"; await writeLine(conn,`${tag} CREATE ${imapQuote(folder)}`); const lines=await readUntilTag(conn,tag); if(!lines.some(x=>new RegExp(`^${tag} OK\\b`,"i").test(x))){const refreshed=await listMailboxes(conn); const found=chooseSentMailbox(refreshed)??refreshed.find(b=>b.decodedName.toLowerCase()==="sent")?.name; if(!found) throw new Error("unable to locate or create IMAP Sent mailbox"); return found;} return folder;}
async function appendSentCopy(rawMessage:string){const conn=await imapLogin(); try{const folder=await ensureSentMailbox(conn); const bytes=enc.encode(rawMessage); const tag="a060"; await writeLine(conn,`${tag} APPEND ${imapQuote(folder)} (\\Seen) {${bytes.byteLength}}`); const continuation=await readLine(conn); if(!continuation.startsWith("+")) throw new Error(`IMAP APPEND continuation rejected: ${continuation}`); await conn.write(bytes); await writeLine(conn,""); const lines=await readUntilTag(conn,tag); if(!lines.some(x=>new RegExp(`^${tag} OK\\b`,"i").test(x))) throw new Error("IMAP APPEND Sent failed"); try{await writeLine(conn,"a998 LOGOUT");}catch{} return {folder,bytes:bytes.byteLength};}finally{try{conn.close();}catch{}}}

async function smtpSend(row:any){const conn=await smtpLogin(); const messageId=`<${crypto.randomUUID()}@ronaoil.com>`; const rawMessage=buildRawMessage(row,messageId); try{await writeLine(conn,`MAIL FROM:<${MAILBOX}>`); let r=await smtpResponse(conn); if(r.code!==250) throw new Error(`SMTP MAIL FROM ${r.code}`); const recipients=[...new Set([...(row.to_addrs??[]),...(row.cc_addrs??[]),...(row.bcc_addrs??[])])]; if(!recipients.length) throw new Error("no recipients"); for(const recipient of recipients){await writeLine(conn,`RCPT TO:<${recipient}>`); r=await smtpResponse(conn); if(![250,251].includes(r.code)) throw new Error(`SMTP RCPT ${recipient} ${r.code}`);} await writeLine(conn,"DATA"); r=await smtpResponse(conn); if(r.code!==354) throw new Error(`SMTP DATA ${r.code}`); await writeRaw(conn,dotStuff(rawMessage)+".\r\n"); r=await smtpResponse(conn); if(r.code!==250) throw new Error(`SMTP final ${r.code}`); try{await writeLine(conn,"QUIT");}catch{} return {messageId,rawMessage};}finally{try{conn.close();}catch{}}}

async function processOutbox(){const rows=await sql<any[]>`select id,mailbox,to_addrs,cc_addrs,bcc_addrs,subject,text_body,html_body,reply_to,in_reply_to,references_header from public.rona_mail_outbox where status='QUEUED' and mailbox=${MAILBOX} order by created_at asc limit 5`; let sent=0,failed=0; const results:any[]=[]; for(const row of rows){const locked=await sql<any[]>`update public.rona_mail_outbox set status='SENDING',attempts=attempts+1,locked_at=now(),updated_at=now() where id=${row.id} and status='QUEUED' returning id`; if(!locked.length) continue; try{const {messageId,rawMessage}=await smtpSend(row); let sentCopy:any=null,copyError:string|null=null; try{sentCopy=await appendSentCopy(rawMessage);}catch(e){copyError=e instanceof Error?e.message:String(e);} await sql`update public.rona_mail_outbox set status='SENT',sent_at=now(),smtp_message_id=${messageId},last_error=${copyError?`SENT_COPY_ERROR: ${copyError}`:null},updated_at=now() where id=${row.id}`; sent++; results.push({id:row.id,status:"SENT",message_id:messageId,sent_copy:sentCopy?{ok:true,...sentCopy}:{ok:false,error:copyError}});}catch(e){const err=e instanceof Error?e.message:String(e); await sql`update public.rona_mail_outbox set status='FAILED',last_error=${err},updated_at=now() where id=${row.id}`; failed++; results.push({id:row.id,status:"FAILED",error:err});}} return {processed:rows.length,sent,failed,results};}

Deno.serve(async(req:Request)=>{if(req.method!=="POST") return json({error:"POST required"},405); try{const expected=await getRuntimeToken(); const supplied=req.headers.get("x-rona-mail-internal-key")??""; if(!expected||!safeEqual(supplied,expected)) return json({error:"unauthorized"},401); const body=await req.json().catch(()=>({})); const action=typeof body?.action==="string"?body.action:"status"; if(action==="status") return json({service:"rona-accounting-mail-bridge",mailbox:MAILBOX,host:MAIL_HOST,imap_port:IMAP_PORT,smtp_port:SMTP_PORT,smtp_security:"STARTTLS",protected:true,sent_copy:"IMAP APPEND enabled"}); if(action==="auth-test") return json(await authTest()); if(action==="sync-inbox") return json(await syncInbox()); if(action==="fetch-message") return json(await fetchMessage(Number(body?.uid))); if(action==="process-outbox") return json(await processOutbox()); return json({error:"unknown action"},400);}catch(e){console.error("rona-accounting-mail-bridge",e instanceof Error?e.message:String(e)); return json({error:e instanceof Error?e.message:String(e)},502);}});
