import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import PostalMime from "npm:postal-mime@2.7.5";
import * as XLSX from "npm:xlsx@0.18.5";

const MAIL_HOST="mail.hosting.reg.ru";
const MAILBOX="finance@ronaoil.com";
const FOLDER="INBOX";
const IMAP_PORT=993;
const sql=postgres(Deno.env.get("SUPABASE_DB_URL")!,{prepare:false,max:1});
const enc=new TextEncoder();
const dec=new TextDecoder();

function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
async function getVaultSecret(name:string){const r=await sql<{decrypted_secret:string}[]>`select decrypted_secret from vault.decrypted_secrets where name=${name} limit 1`;return r[0]?.decrypted_secret??""}
async function getRuntimeToken(){const r=await sql<{token:string}[]>`select token from private.rona_accounting_mail_bridge_runtime_secret where singleton=true limit 1`;return r[0]?.token??""}
function safeEqual(a:string,b:string){const aa=enc.encode(a),bb=enc.encode(b);if(aa.length!==bb.length)return false;let d=0;for(let i=0;i<aa.length;i++)d|=aa[i]^bb[i];return d===0}
function imapQuote(v:string){return `"${v.replaceAll("\\","\\\\").replaceAll('"','\\"')}"`}
async function writeLine(c:Deno.Conn,l:string){await c.write(enc.encode(l+"\r\n"))}
async function readLine(c:Deno.Conn){const b:number[]=[];const o=new Uint8Array(1);while(true){const n=await c.read(o);if(n===null)break;b.push(o[0]);const z=b.length;if(z>=2&&b[z-2]===13&&b[z-1]===10)break;if(z>1024*1024)throw new Error("line too long")}return dec.decode(new Uint8Array(b)).replace(/\r?\n$/,"")}
async function readUntilTag(c:Deno.Conn,t:string){const lines:string[]=[];while(true){const l=await readLine(c);if(!l)throw new Error("connection closed");lines.push(l);if(l.startsWith(t+" "))return lines}}
async function readExact(c:Deno.Conn,size:number){const out=new Uint8Array(size);let off=0;while(off<size){const n=await c.read(out.subarray(off));if(n===null)throw new Error("closed during literal");off+=n}return out}
async function readFetch(c:Deno.Conn,t:string){const lines:string[]=[];const literals:Uint8Array[]=[];while(true){const l=await readLine(c);if(!l)throw new Error("closed during fetch");lines.push(l);const m=l.match(/\{(\d+)\}$/);if(m){literals.push(await readExact(c,Number(m[1])));const tr=await readLine(c);if(tr)lines.push(tr);if(tr.startsWith(t+" "))break}if(l.startsWith(t+" "))break}return {lines,literals}}
async function imapLogin(){const pw=await getVaultSecret("rona_finance_mail_password");if(!pw)throw new Error("finance mail password missing");const c=await Deno.connectTls({hostname:MAIL_HOST,port:IMAP_PORT});const g=await readLine(c);if(!g.startsWith("* OK")){c.close();throw new Error("IMAP greeting rejected")}await writeLine(c,`a001 LOGIN ${imapQuote(MAILBOX)} ${imapQuote(pw)}`);const lines=await readUntilTag(c,"a001");if(!lines.some(x=>/^a001 OK\b/i.test(x))){c.close();throw new Error("IMAP login failed")}return c}
async function fetchRaw(uid:number){const c=await imapLogin();try{await writeLine(c,`a002 SELECT ${imapQuote(FOLDER)}`);const s=await readUntilTag(c,"a002");if(!s.some(x=>/^a002 OK\b/i.test(x)))throw new Error("SELECT failed");await writeLine(c,`a003 UID FETCH ${uid} (UID RFC822.SIZE BODY.PEEK[])`);const f=await readFetch(c,"a003");if(!f.lines.some(x=>x.startsWith("a003 OK")))throw new Error("FETCH failed");if(!f.literals[0])throw new Error("raw message missing");return f.literals[0]}finally{try{c.close()}catch{}}}

async function sha256Hex(bytes:Uint8Array){
  const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  return Array.from(hash).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function cleanText(v:unknown){return String(v??"").replace(/\u00a0/g," ").trim()}
function parseMoney(v:unknown,emptyAsZero=false){
  const raw=cleanText(v);
  if(!raw){if(emptyAsZero)return 0;throw new Error("cash projection: numeric value missing")}
  const normalized=raw.replace(/\s+/g,"").replace(",",".");
  const n=Number(normalized);
  if(!Number.isFinite(n))throw new Error("cash projection: invalid numeric value "+raw);
  return n;
}
function dmyToIso(v:unknown){
  const m=cleanText(v).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if(!m)throw new Error("cash projection: invalid date "+cleanText(v));
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function dmyDateTimeToPg(v:unknown){
  const s=cleanText(v);
  const m=s.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(!m)throw new Error("cash projection: invalid datetime "+s);
  return `${m[3]}-${m[2]}-${m[1]} ${m[4]??"00"}:${m[5]??"00"}:${m[6]??"00"}`;
}
function normalizeCounterparty(v:unknown){
  return cleanText(v).replace(/\s+\d{12,}\s*$/,"").trim()||null;
}
function parseStatementSheet(uid:number,a:any,rows:any[][]){
  const first=(prefix:string)=>rows.find(r=>cleanText(r?.[0]).toLowerCase().startsWith(prefix.toLowerCase()));
  const title=first("Выписка по счету");
  if(!title)return null;
  const tm=cleanText(title[0]).match(/Выписка по счету\s+([A-Z]{3})\s+(\d+)/i);
  if(!tm)throw new Error("cash projection: account/currency header missing in "+a.filename);
  const currency=tm[1].toUpperCase(),account=tm[2];
  const periodRow=rows.find(r=>/^С\s+\d{2}\.\d{2}\.\d{4}\s+по\s+\d{2}\.\d{2}\.\d{4}$/i.test(cleanText(r?.[0])));
  if(!periodRow)throw new Error("cash projection: period missing in "+a.filename);
  const pm=cleanText(periodRow[0]).match(/С\s+(\d{2}\.\d{2}\.\d{4})\s+по\s+(\d{2}\.\d{2}\.\d{4})/i)!;
  const period_start=dmyToIso(pm[1]),period_end=dmyToIso(pm[2]);
  const generated=first("Дата формирования информации:");
  const opening=first("Входящий остаток:");
  const closing=first("Исходящий остаток:");
  const totals=first("Итого оборотов:");
  if(!generated||!opening||!closing||!totals)throw new Error("cash projection: required balance metadata missing in "+a.filename);
  const generated_at_local=dmyDateTimeToPg(cleanText(generated[0]).replace(/^Дата формирования информации:\s*/i,""));
  const opening_balance=parseMoney(cleanText(opening[0]).replace(/^Входящий остаток:\s*/i,""));
  const closing_balance=parseMoney(cleanText(closing[0]).replace(/^Исходящий остаток:\s*/i,""));
  const totalText=cleanText(totals[0]);
  const totalMatch=totalText.match(/Пополнение\s+([0-9\s.,-]+)\s*\|\s*Списание\s+([0-9\s.,-]+)/i);
  if(!totalMatch)throw new Error("cash projection: turnover totals missing in "+a.filename);
  const total_credit=parseMoney(totalMatch[1],true),total_debit=parseMoney(totalMatch[2],true);
  const headerIdx=rows.findIndex(r=>cleanText(r?.[0])==="Дата опер. дня");
  if(headerIdx<0)throw new Error("cash projection: operations header missing in "+a.filename);
  const h=rows[headerIdx].map(cleanText);
  const find=(label:string)=>h.findIndex(x=>x===label);
  const iDay=find("Дата опер. дня"),iExec=find("Дата исполнения"),iDoc=find("№ док"),iCp=find("Отправитель/Получатель"),iPurpose=find("Детализация"),iCredit=find("Пополнение"),iDebit=find("Списание"),iBalance=find("Остаток");
  if([iDay,iExec,iDoc,iCp,iPurpose,iCredit,iDebit,iBalance].some(i=>i<0))throw new Error("cash projection: operation columns incomplete in "+a.filename);
  const operations:any[]=[];
  for(let i=headerIdx+1;i<rows.length;i++){
    const row=rows[i];
    const day=cleanText(row?.[iDay]);
    if(!/^\d{2}\.\d{2}\.\d{4}$/.test(day))continue;
    const credit=parseMoney(row?.[iCredit],true),debit=parseMoney(row?.[iDebit],true);
    if(credit>0&&debit>0)throw new Error("cash projection: both credit and debit present in "+a.filename+" row "+i);
    if(credit<=0&&debit<=0)continue;
    const direction=credit>0?"INCOMING":"OUTGOING";
    operations.push({
      operation_date:dmyToIso(day),
      executed_at_local:cleanText(row?.[iExec])?dmyDateTimeToPg(row?.[iExec]):null,
      bank_document_number:cleanText(row?.[iDoc])||null,
      direction,
      amount:credit>0?credit:debit,
      source_counterparty:normalizeCounterparty(row?.[iCp]),
      purpose:cleanText(row?.[iPurpose])||null,
      running_balance:cleanText(row?.[iBalance])?parseMoney(row?.[iBalance]):null
    });
  }
  return {
    source_uid:uid,
    source_ref:`MAIL_UID${uid}:${a.filename}`,
    source_filename:a.filename,
    source_checksum_sha256:a.sha256,
    source_set_identity:`FINANCE_CASH_SOURCESET_V1:sha256:${a.sha256}`,
    bank_name:cleanText(rows?.[0]?.[0])||"BANK_STATEMENT",
    account_identity:account,
    currency,
    statement_date:period_end,
    period_start,
    period_end,
    generated_at_local,
    opening_balance,
    closing_balance,
    total_credit,
    total_debit,
    operations
  };
}
async function materializeCashProjection(uid:number,attachments:any[]){
  const results:any[]=[];
  for(const a of attachments){
    const rows=a?.sheets?.Statement;
    if(!Array.isArray(rows))continue;
    const statement=parseStatementSheet(uid,a,rows);
    if(!statement)continue;
    const rr=await sql`select portal_private.finance_cash_ingest_statement_v1(${sql.json(statement)}) as result`;
    results.push(rr[0]?.result??null);
  }
  return results;
}

Deno.serve(async(req:Request)=>{if(req.method!=="POST")return json({error:"POST required"},405);try{const expected=await getRuntimeToken();const supplied=req.headers.get("x-rona-mail-internal-key")??"";if(!expected||!safeEqual(expected,supplied))return json({error:"unauthorized"},401);const body=await req.json().catch(()=>({}));const uid=Number(body?.uid);if(!Number.isInteger(uid)||uid<=0)return json({error:"invalid uid"},400);const raw=await fetchRaw(uid);const mail:any=await PostalMime.parse(raw);const out:any[]=[];for(const a of (mail.attachments??[])){const name=String(a.filename??"");if(!/\.xlsx$/i.test(name))continue;const bytes=a.content instanceof Uint8Array?a.content:new Uint8Array(a.content??[]);const wb=XLSX.read(bytes,{type:"array",cellDates:false});const sheets:any={};for(const sn of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:false,defval:null});sheets[sn]=rows.slice(0,500)}const sha256=await sha256Hex(bytes);out.push({filename:name,mime_type:a.mimeType??null,size:bytes.byteLength,sha256,sheet_names:wb.SheetNames,sheets})}const cash_projection=await materializeCashProjection(uid,out);return json({uid,subject:mail.subject??null,from:mail.from?.address??null,attachment_count:out.length,attachments:out,cash_projection})}catch(e){return json({error:e instanceof Error?e.message:String(e)},502)}});