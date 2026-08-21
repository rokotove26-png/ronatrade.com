// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");
const sql = postgres(DB, { prepare: false, max: 1 });
const BUCKET = "rona-portal-private";
const MAX_PDF = 50 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function runtimeKey(kind) {
  const legacy = kind === "pub" ? Deno.env.get("SUPABASE_ANON_KEY") : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get(kind === "pub" ? "SUPABASE_PUBLISHABLE_KEYS" : "SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.default) return parsed.default;
  }
  throw new Error("key missing");
}
const service = createClient(SUPA_URL, runtimeKey("secret"), { auth: { persistSession: false, autoRefreshToken: false } });

function send(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function pathOf(req) {
  const p = new URL(req.url).pathname;
  const marker = "/rona-owner-acceptance";
  const i = p.indexOf(marker);
  return i >= 0 ? (p.slice(i + marker.length) || "/") : p;
}
function claims(token) {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4)));
  } catch { return {}; }
}
async function authContext(req) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const client = createClient(SUPA_URL, runtimeKey("pub"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const sid = claims(token).session_id;
  if (typeof sid !== "string" || !UUID_RE.test(sid)) return null;
  const rows = await sql`
    select a.portal_user_id,a.display_name,a.roles,s.not_after
    from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a
    join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid
    where a.session_allowed and (s.not_after is null or s.not_after>now())
  `;
  if (rows.length !== 1) return null;
  return { authUserId: String(data.user.id), userId: String(rows[0].portal_user_id), displayName: String(rows[0].display_name || ""), roles: (rows[0].roles || []).map(String), sessionId: sid };
}
function requireRole(ctx, role) {
  if (!ctx?.roles?.includes(role)) throw Object.assign(new Error("ROLE_MISMATCH"), { status: 403 });
}
async function jsonBody(req) {
  try { const v = await req.json(); if (!v || Array.isArray(v) || typeof v !== "object") throw new Error(); return v; }
  catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}
function text(v, name, max = 500) {
  const s = String(v ?? "").trim();
  if (!s || s.length > max) throw Object.assign(new Error(`INVALID_${name}`), { status: 400 });
  return s;
}
function nnum(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error(`INVALID_${name}`), { status: 400 });
  return n;
}
function reqIds(req) {
  const r = req.headers.get("x-request-id"), c = req.headers.get("x-correlation-id");
  return { requestId: r && UUID_RE.test(r) ? r : crypto.randomUUID(), correlationId: c && UUID_RE.test(c) ? c : null };
}
async function audit(tx, ctx, action, entityType, entityId, req, metadata = {}) {
  const { requestId, correlationId } = reqIds(req);
  await tx`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
    values(${ctx.userId}::uuid,${ctx.roles.includes("ADMIN") ? "ADMIN" : ctx.roles.includes("CLIENT") ? "CLIENT" : ctx.roles.includes("AGENT") ? "AGENT" : "RONA_OPERATOR"},${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,${sql.json(metadata)})`;
}

async function clientScope(ctx) {
  const rows = await sql`
    select distinct b.client_key,b.contract_key,cl.client_id,cl.legal_name,ct.contract_id,ct.current_signed_document_id
    from portal_private.client_user_bindings b
    join portal_private.clients cl on cl.id=b.client_key
    join portal_private.contracts ct on ct.id=b.contract_key
    where b.user_id=${ctx.userId}::uuid and b.status='ACTIVE'::portal_private.binding_status_enum
      and b.revoked_at is null and b.valid_from<=now() and (b.valid_to is null or b.valid_to>now())
      and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  `;
  return rows;
}
async function agentScope(ctx) {
  const rows = await sql`
    select distinct aca.client_key,cl.client_id,cl.legal_name,ap.agent_person_id,ale.agent_legal_entity_id,ale.legal_name agent_legal_name
    from portal_private.agent_user_bindings aub
    join portal_private.agent_client_assignments aca on aca.agent_person_key=aub.agent_person_key and aca.agent_legal_entity_key=aub.agent_legal_entity_key
    join portal_private.agent_persons ap on ap.id=aca.agent_person_key
    join portal_private.agent_legal_entities ale on ale.id=aca.agent_legal_entity_key
    join portal_private.clients cl on cl.id=aca.client_key
    where aub.user_id=${ctx.userId}::uuid and aub.status='ACTIVE'::portal_private.binding_status_enum and aub.revoked_at is null
      and aub.valid_from<=now() and (aub.valid_to is null or aub.valid_to>now())
      and aca.status='ACTIVE'::portal_private.binding_status_enum and aca.valid_from<=now() and (aca.valid_to is null or aca.valid_to>now())
      and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  `;
  return rows;
}

async function adminSnapshot() {
  const clients = await sql`
    select cl.id client_key,cl.client_id,cl.legal_name,ct.id contract_key,ct.contract_id,ct.current_external_contract_number,ct.contract_status,
           ap.agent_person_id,coalesce(ap.display_alias,ap.full_name,ap.agent_person_id) agent_name
    from portal_private.clients cl
    left join lateral (
      select * from portal_private.contracts x where x.client_key=cl.id and x.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum) order by x.updated_at desc limit 1
    ) ct on true
    left join portal_private.agent_client_assignments aca on aca.client_key=cl.id and aca.status='ACTIVE'::portal_private.binding_status_enum and aca.valid_to is null and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    left join portal_private.agent_persons ap on ap.id=aca.agent_person_key
    where cl.lifecycle_state not in ('ARCHIVED'::portal_private.lifecycle_state_enum,'SUPERSEDED'::portal_private.lifecycle_state_enum)
    order by cl.client_id`;

  const agents = await sql`
    select distinct ap.agent_person_id,coalesce(ap.display_alias,ap.full_name,ap.agent_person_id) agent_name,ale.agent_legal_entity_id,ale.legal_name agent_legal_name
    from portal_private.agent_persons ap
    join portal_private.agent_client_assignments aca on aca.agent_person_key=ap.id
    join portal_private.agent_legal_entities ale on ale.id=aca.agent_legal_entity_key
    where ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by ap.agent_person_id`;

  const prices = await sql`
    select id,product,producer,supplier,purchase_price,rail_tariff,rail_segments,basis,border_crossing,final_station,landed_cost,rona_margin,sale_price,currency,payment_terms,commercial_terms,
           business_status,publish_client,publish_agent,agreed_at,published_at
    from portal_private.owner_price_snapshots where business_status<>'SUPERSEDED' order by agreed_at desc`;

  const applications = await sql`
    select a.id application_key,a.application_id,a.product,a.quantity_tonnes,a.delivery_basis,a.destination,a.payment_terms,a.price_mode::text,a.proposed_price,a.proposed_currency,a.status::text,
           cl.client_id,cl.legal_name,ct.contract_id,d.deal_id,d.business_status deal_status,
           coalesce(w.business_status,case when a.status='DEAL_REGISTERED'::portal_private.application_status_enum then 'DEAL' else 'NEW' end) owner_status,
           w.counter_price,w.counter_currency,w.counter_offer_used,w.client_counter_response,w.admin_decided_at,w.supplier_approved_at
    from portal_private.client_applications a
    join portal_private.clients cl on cl.id=a.client_key
    join portal_private.contracts ct on ct.id=a.contract_key
    left join portal_private.deals d on d.id=a.linked_deal_key
    left join portal_private.owner_application_workflow w on w.application_key=a.id
    where a.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum
    order by a.updated_at desc`;

  const deals = await sql`
    select d.id deal_key,d.deal_id,d.business_status,d.finance_status::text,cl.client_id,cl.legal_name,ct.contract_id,
           coalesce(w.payment_handoff_state,'NOT_SENT') payment_handoff_state,w.payment_handoff_at
    from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key
    left join portal_private.owner_deal_workflow w on w.deal_key=d.id
    where d.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum order by d.updated_at desc`;

  const dealDocuments = await sql`
    select odd.id owner_document_link_id,d.deal_id,doc.document_id,doc.document_type,doc.authoritative_filename,odd.document_kind,odd.checked_by_admin,odd.checked_at
    from portal_private.owner_deal_documents odd join portal_private.deals d on d.id=odd.deal_key join portal_private.documents doc on doc.id=odd.document_key
    where doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by odd.updated_at desc`;

  const paymentPlan = await sql`
    select p.id,d.deal_id,cl.legal_name,p.tranche_no,p.share_text,p.planned_amount,p.currency,p.due_at,p.status,
           coalesce((select sum(pa.allocated_amount) from portal_private.payment_allocations pa where pa.deal_key=d.id and pa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum),0) received_amount
    from portal_private.owner_payment_plan p join portal_private.deals d on d.id=p.deal_key join portal_private.clients cl on cl.id=d.client_key
    where p.status<>'CANCELLED' order by d.deal_id,p.tranche_no`;

  const paymentTotals = await sql`
    select coalesce((select sum(amount) from portal_private.payments where lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum),0) received,
           coalesce((select sum(planned_amount) from portal_private.owner_payment_plan where status<>'CANCELLED'),0) planned`;

  const cash = await sql`select id,snapshot_date,currency,opening_balance,received_amount,paid_amount,closing_balance,updated_at from portal_private.owner_cash_snapshots order by snapshot_date desc,currency`;

  const rail = await sql`
    select rd.id rail_document_key,rd.rail_document_id,rd.gu12_number,rd.document_number,rd.document_date,rd.route_text,d.deal_id,
           coalesce(jsonb_agg(jsonb_build_object('wagonNumber',rw.wagon_number,'station',rw.current_station_name,'stationCode',rw.current_station_code,'operation',rw.operation_code,'operationAt',rw.operation_at,'status',rw.status,'lastPositionAt',rw.last_position_at) order by rw.wagon_number) filter(where rw.id is not null),'[]'::jsonb) wagons
    from portal_private.rail_documents rd left join portal_private.deals d on d.id=rd.deal_key left join portal_private.rail_wagons rw on rw.rail_document_key=rd.id and rw.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    where upper(rd.document_type)='GU-12' and rd.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    group by rd.id,rd.rail_document_id,rd.gu12_number,rd.document_number,rd.document_date,rd.route_text,d.deal_id order by rd.updated_at desc`;

  const exchange = await sql`
    select count(*) filter(where monitoring_status='ACTIVE') active_targets,
           count(*) filter(where monitoring_status='ACTIVE' and (last_error is not null or sync_status ilike '%FAIL%' or sync_status ilike '%ERROR%')) conflicts,
           max(last_successful_update) last_success
    from portal_private.rail_monitoring_targets`;

  const operationalConflicts = await sql`
    select 'DEAL' kind,d.deal_id entity_id,d.business_status reason,d.updated_at occurred_at
    from portal_private.deals d where upper(d.business_status) in ('HOLD','STOPPED','BLOCKED','CONFLICT')
    union all
    select 'SHIPMENT',s.shipment_id,s.shipment_status::text,s.updated_at from portal_private.shipments s where upper(s.shipment_status::text) in ('HOLD','STOPPED','BLOCKED','CONFLICT')
    order by occurred_at desc`;

  const radio = await sql`select id,item_kind,target_scope,target_id,delivery_channel,body_text,active_from,active_until,created_at from portal_private.owner_radio_items where active_until is null or active_until>now() order by created_at desc limit 100`;

  const analytics = await sql`
    select p.publication_id,p.title,p.prepared_at,p.published_at,pi.id item_id,pi.product,pi.basis,pi.analytics_as_of,pi.analytics_period_from,pi.analytics_period_to,pi.actual_value,pi.forecast_value,pi.analytics_unit,pi.forecast_scenario,pi.content_text,pi.metadata
    from portal_private.publications p join portal_private.publication_items pi on pi.publication_key=p.id
    where pi.item_type='ANALYTICS'::portal_private.publication_item_type_enum and p.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum
    order by coalesce(pi.analytics_as_of,p.prepared_at) desc limit 100`;

  const news = await sql`
    select p.publication_id,p.title,p.prepared_at,p.published_at,p.status::text,pi.id item_id,coalesce(pi.headline,p.title) headline,pi.content_text,
           case when coalesce(p.published_at,p.prepared_at)>=now()-interval '7 days' then 'ACTIVE' else 'ARCHIVE' end bucket
    from portal_private.publications p join portal_private.publication_items pi on pi.publication_key=p.id
    where pi.item_type='NEWS'::portal_private.publication_item_type_enum and p.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum
    order by coalesce(p.published_at,p.prepared_at) desc limit 200`;

  return {
    generatedAt: new Date().toISOString(), clients, agents, prices, applications, deals, dealDocuments, paymentPlan,
    paymentTotals: paymentTotals[0] || { received: 0, planned: 0 }, cash, rail,
    exchange: { status: Number(exchange[0]?.conflicts || 0) === 0 ? 'HEALTHY' : 'CONFLICT', ...exchange[0] },
    operationalConflicts, radio, analytics, news
  };
}

async function updateApplication(ctx, req, applicationId, action) {
  const rows = await sql`select a.id,a.status::text,a.linked_deal_key,d.deal_id,d.business_status from portal_private.client_applications a left join portal_private.deals d on d.id=a.linked_deal_key where a.application_id=${applicationId} limit 1`;
  if (!rows.length) throw Object.assign(new Error("APPLICATION_NOT_FOUND"), { status: 404 });
  const a = rows[0], body = req.method === 'POST' ? await jsonBody(req) : {};
  return sql.begin(async tx => {
    await tx`insert into portal_private.owner_application_workflow(application_key) values(${a.id}::uuid) on conflict(application_key) do nothing`;
    if (action === 'accept') {
      if (a.status !== 'DEAL_REGISTERED') await tx`update portal_private.client_applications set status='ACCEPTED_AWAITING_DEAL_REGISTRATION'::portal_private.application_status_enum,decision_at=now(),decision_by=${ctx.userId}::uuid,decision_reason='ADMIN_ACCEPTED',updated_at=now() where id=${a.id}::uuid`;
      await tx`update portal_private.owner_application_workflow set business_status='SUPPLIER_REVIEW',admin_decided_by=${ctx.userId}::uuid,admin_decided_at=now(),updated_at=now() where application_key=${a.id}::uuid`;
    } else if (action === 'reject') {
      if (a.status === 'DEAL_REGISTERED') throw Object.assign(new Error("REGISTERED_APPLICATION_CANNOT_BE_REJECTED"), { status: 409 });
      await tx`update portal_private.client_applications set status='REJECTED'::portal_private.application_status_enum,decision_at=now(),decision_by=${ctx.userId}::uuid,decision_reason=${String(body.reason || 'ADMIN_REJECTED').slice(0,500)},updated_at=now() where id=${a.id}::uuid`;
      await tx`update portal_private.owner_application_workflow set business_status='REJECTED',admin_decided_by=${ctx.userId}::uuid,admin_decided_at=now(),updated_at=now() where application_key=${a.id}::uuid`;
    } else if (action === 'counter-offer') {
      const price = nnum(body.price, 'PRICE'), currency = text(body.currency || 'USD', 'CURRENCY', 3).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error("INVALID_CURRENCY"), { status: 400 });
      if (a.status !== 'DEAL_REGISTERED') await tx`update portal_private.client_applications set status='UNDER_REVIEW'::portal_private.application_status_enum,updated_at=now() where id=${a.id}::uuid`;
      await tx`update portal_private.owner_application_workflow set business_status='COUNTER_OFFERED',counter_price=${price},counter_currency=${currency},counter_offer_used=true,client_counter_response=null,admin_decided_by=${ctx.userId}::uuid,admin_decided_at=now(),updated_at=now() where application_key=${a.id}::uuid`;
    } else if (action === 'supplier-approved') {
      if (!a.linked_deal_key || !a.deal_id) throw Object.assign(new Error("DEAL_REGISTRATION_REQUIRED"), { status: 409 });
      await tx`update portal_private.deals set business_status='EXECUTING',updated_at=now() where id=${a.linked_deal_key}::uuid and upper(business_status) in ('SUPPLIER_PENDING','REGISTERED','APPROVED')`;
      await tx`update portal_private.owner_application_workflow set business_status='DEAL',supplier_approved_by=${ctx.userId}::uuid,supplier_approved_at=now(),finalized_at=now(),updated_at=now() where application_key=${a.id}::uuid`;
    } else throw Object.assign(new Error("INVALID_ACTION"), { status: 400 });
    await audit(tx,ctx,`OWNER_APPLICATION_${action.toUpperCase().replace(/-/g,'_')}`,'APPLICATION',applicationId,req,{dealId:a.deal_id||null});
    return { applicationId, action, dealId: a.deal_id || null };
  });
}

async function clientCounterDecision(ctx, req, applicationId, decision) {
  const scope = await clientScope(ctx); const keys = scope.map(x=>String(x.client_key));
  const rows = keys.length ? await sql`select a.id,a.client_key,a.status::text,w.business_status,w.counter_price,w.counter_currency from portal_private.client_applications a join portal_private.owner_application_workflow w on w.application_key=a.id where a.application_id=${applicationId} and a.client_key = any(${keys}::uuid[]) limit 1` : [];
  if (!rows.length) throw Object.assign(new Error("APPLICATION_NOT_FOUND"), { status: 404 });
  const a=rows[0]; if (a.business_status!=='COUNTER_OFFERED') throw Object.assign(new Error("COUNTER_OFFER_NOT_ACTIVE"), { status:409 });
  return sql.begin(async tx=>{
    if(decision==='accept') {
      await tx`update portal_private.owner_application_workflow set business_status='CLIENT_COUNTER_ACCEPTED',client_counter_response='ACCEPTED',updated_at=now() where application_key=${a.id}::uuid`;
      if(a.status!=='DEAL_REGISTERED') await tx`update portal_private.client_applications set status='ACCEPTED_AWAITING_DEAL_REGISTRATION'::portal_private.application_status_enum,proposed_price=${a.counter_price},proposed_currency=${a.counter_currency},decision_reason='CLIENT_ACCEPTED_ADMIN_COUNTER',updated_at=now() where id=${a.id}::uuid`;
    } else {
      await tx`update portal_private.owner_application_workflow set business_status='NEW',client_counter_response='DECLINED',updated_at=now() where application_key=${a.id}::uuid`;
      if(a.status!=='DEAL_REGISTERED') await tx`update portal_private.client_applications set status='UNDER_REVIEW'::portal_private.application_status_enum,decision_reason='CLIENT_DECLINED_ADMIN_COUNTER',updated_at=now() where id=${a.id}::uuid`;
    }
    await audit(tx,ctx,`OWNER_CLIENT_COUNTER_${decision.toUpperCase()}`,'APPLICATION',applicationId,req,{price:a.counter_price,currency:a.counter_currency});
    return {applicationId,decision};
  });
}

async function publishPrice(ctx, req, id) {
  if (!UUID_RE.test(id)) throw Object.assign(new Error("INVALID_PRICE_ID"),{status:400});
  const b=await jsonBody(req), client=!!b.client, agent=!!b.agent;
  const rows=await sql`update portal_private.owner_price_snapshots set publish_client=${client},publish_agent=${agent},client_published_at=case when ${client} then coalesce(client_published_at,now()) else null end,agent_published_at=case when ${agent} then coalesce(agent_published_at,now()) else null end,business_status=case when ${client} or ${agent} then 'PUBLISHED' else 'AGREED' end,published_at=case when ${client} or ${agent} then coalesce(published_at,now()) else null end,published_by=${ctx.userId}::uuid,updated_at=now() where id=${id}::uuid returning id`;
  if(!rows.length) throw Object.assign(new Error("PRICE_NOT_FOUND"),{status:404});
  await sql.begin(async tx=>audit(tx,ctx,'OWNER_PRICE_PUBLICATION_UPDATED','PRICE',id,req,{client,agent}));
  return {id,client,agent};
}

async function setAgentAssignment(ctx, req, clientId) {
  const b=await jsonBody(req), agentPersonId=String(b.agentPersonId||'').trim();
  const c=await sql`select id,client_id from portal_private.clients where client_id=${clientId} limit 1`; if(!c.length) throw Object.assign(new Error("CLIENT_NOT_FOUND"),{status:404});
  let profile=null;
  if(agentPersonId){
    const p=await sql`select ap.id agent_person_key,ap.agent_person_id,ale.id agent_legal_entity_key from portal_private.agent_persons ap join portal_private.agent_client_assignments aca on aca.agent_person_key=ap.id join portal_private.agent_legal_entities ale on ale.id=aca.agent_legal_entity_key where ap.agent_person_id=${agentPersonId} and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by aca.updated_at desc limit 1`;
    if(!p.length) throw Object.assign(new Error("AGENT_PROFILE_NOT_FOUND"),{status:404}); profile=p[0];
  }
  return sql.begin(async tx=>{
    await tx`update portal_private.agent_client_assignments set status='REVOKED'::portal_private.binding_status_enum,valid_to=now(),lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,updated_at=now() where client_key=${c[0].id}::uuid and status='ACTIVE'::portal_private.binding_status_enum and valid_to is null`;
    if(profile) await tx`insert into portal_private.agent_client_assignments(agent_person_key,agent_legal_entity_key,client_key,status,valid_from,assignment_reference,source_system,source_version,source_timestamp,authority_state,lifecycle_state) values(${profile.agent_person_key}::uuid,${profile.agent_legal_entity_key}::uuid,${c[0].id}::uuid,'ACTIVE'::portal_private.binding_status_enum,now(),'Admin Portal owner acceptance assignment','ADMIN_PORTAL','OWNER_ACCEPTANCE_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
    await audit(tx,ctx,'OWNER_AGENT_COMPANY_ASSIGNMENT_UPDATED','CLIENT',clientId,req,{agentPersonId:profile?String(profile.agent_person_id):null});
    return {clientId,agentPersonId:profile?String(profile.agent_person_id):null};
  });
}

async function postRadio(ctx, req) {
  const b=await jsonBody(req), kind=text(b.kind,'KIND',32).toUpperCase(), scope=text(b.scope,'SCOPE',32).toUpperCase(), body=text(b.body,'BODY',5000), targetId=String(b.targetId||'').trim()||null;
  if(!['MESSAGE','NOTIFICATION','ANNOUNCEMENT'].includes(kind)) throw Object.assign(new Error('INVALID_KIND'),{status:400});
  if(!['CLIENT','AGENT','ALL_CLIENTS','ALL_AGENTS'].includes(scope)) throw Object.assign(new Error('INVALID_SCOPE'),{status:400});
  if(['CLIENT','AGENT'].includes(scope)&&!targetId) throw Object.assign(new Error('TARGET_REQUIRED'),{status:400});
  const rows=await sql`insert into portal_private.owner_radio_items(item_kind,target_scope,target_id,body_text,created_by) values(${kind},${scope},${targetId},${body},${ctx.userId}::uuid) returning id`;
  await sql.begin(async tx=>audit(tx,ctx,'OWNER_RADIO_ITEM_CREATED','RADIO',String(rows[0].id),req,{kind,scope,targetId}));
  return {id:String(rows[0].id)};
}

function safeFilename(name){const base=String(name||'document.pdf').split(/[\\/]/).pop()||'document.pdf';const clean=base.replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,120);return clean.toLowerCase().endsWith('.pdf')?clean:`${clean||'document'}.pdf`}
async function sha256Hex(bytes){const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function parsePdf(req){let form;try{form=await req.formData()}catch{throw Object.assign(new Error('INVALID_MULTIPART'),{status:400})}const file=form.get('file');if(!(file instanceof File))throw Object.assign(new Error('PDF_REQUIRED'),{status:400});if(file.size<=0||file.size>MAX_PDF)throw Object.assign(new Error('PDF_SIZE_INVALID'),{status:400});if(!/\.pdf$/i.test(file.name||'')||(file.type&&file.type!=='application/pdf'))throw Object.assign(new Error('PDF_TYPE_INVALID'),{status:400});const bytes=await file.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Object.assign(new Error('PDF_SIGNATURE_INVALID'),{status:400});return{form,file,bytes,sha256:await sha256Hex(bytes)}}
async function rawStorageObjectId(objectName){const rows=await sql`select id from storage.objects where bucket_id=${BUCKET} and name=${objectName} limit 1`;return rows[0]?.id?String(rows[0].id):null}
async function uploadRaw(prefix,parsed){const objectName=`${prefix}/${crypto.randomUUID()}-${safeFilename(parsed.file.name)}`;const {error}=await service.storage.from(BUCKET).upload(objectName,new Uint8Array(parsed.bytes),{contentType:'application/pdf',upsert:false,cacheControl:'3600'});if(error)throw Object.assign(new Error('STORAGE_UPLOAD_FAILED'),{status:502});const rawId=await rawStorageObjectId(objectName);if(!rawId){await service.storage.from(BUCKET).remove([objectName]).catch(()=>{});throw Object.assign(new Error('STORAGE_OBJECT_ID_MISSING'),{status:502})}return{objectName,rawId}}
async function registerDealPdf(ctx,req,dealId,kind,isClientUpload=false){const parsed=await parsePdf(req);const d=(await sql`select d.id deal_key,d.client_key,d.contract_key,d.deal_id,cl.client_id from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key where d.deal_id=${dealId} limit 1`)[0];if(!d)throw Object.assign(new Error('DEAL_NOT_FOUND'),{status:404});if(isClientUpload){const scope=await clientScope(ctx);if(!scope.some(x=>String(x.client_key)===String(d.client_key)))throw Object.assign(new Error('DEAL_ACCESS_DENIED'),{status:403})}
  const raw=await uploadRaw(`deals/${d.client_id}/${dealId}/${kind.toLowerCase()}`,parsed);try{return await sql.begin(async tx=>{const docKey=crypto.randomUUID(),docId=`${dealId}-${kind}-${crypto.randomUUID().slice(0,8)}`,versionKey=crypto.randomUUID();await tx`insert into portal_private.documents(id,document_id,document_type,client_key,contract_key,deal_key,authoritative_filename,source_system,source_version,source_timestamp,authority_state,lifecycle_state) values(${docKey}::uuid,${docId},${kind},${d.client_key}::uuid,${d.contract_key}::uuid,${d.deal_key}::uuid,${parsed.file.name},${isClientUpload?'CLIENT_PORTAL':'ADMIN_PORTAL'},'OWNER_ACCEPTANCE_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;await tx`insert into portal_private.document_versions(id,document_key,version_number,authoritative_filename,sha256,storage_path,uploaded_by,is_current,is_effective,source_system,source_version,source_timestamp,authority_state,lifecycle_state) values(${versionKey}::uuid,${docKey}::uuid,1,${parsed.file.name},${parsed.sha256},${raw.objectName},${ctx.userId}::uuid,true,true,${isClientUpload?'CLIENT_PORTAL':'ADMIN_PORTAL'},'OWNER_ACCEPTANCE_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;await tx`insert into portal_private.storage_objects(bucket_id,object_name,storage_object_id,object_kind,client_key,contract_key,deal_key,document_version_key,content_type,byte_size,sha256,storage_state,created_by,verified_by,verified_at) values(${BUCKET},${raw.objectName},${raw.rawId}::uuid,'DOCUMENT',${d.client_key}::uuid,${d.contract_key}::uuid,${d.deal_key}::uuid,${versionKey}::uuid,'application/pdf',${parsed.file.size},${parsed.sha256},'VERIFIED',${ctx.userId}::uuid,${ctx.userId}::uuid,now())`;await tx`update portal_private.documents set current_version_id=${versionKey}::uuid,updated_at=now() where id=${docKey}::uuid`;await tx`insert into portal_private.owner_deal_documents(deal_key,document_key,document_kind) values(${d.deal_key}::uuid,${docKey}::uuid,${kind})`;if(kind==='SIGNED_ADDENDUM')await tx`insert into portal_private.owner_deal_workflow(deal_key,signed_supplement_document_key) values(${d.deal_key}::uuid,${docKey}::uuid) on conflict(deal_key) do update set signed_supplement_document_key=excluded.signed_supplement_document_key,updated_at=now()`;await audit(tx,ctx,`OWNER_${kind}_UPLOADED`,'DEAL',dealId,req,{documentId:docId,sha256:parsed.sha256});return{dealId,documentId:docId,kind,filename:parsed.file.name}})}catch(e){await service.storage.from(BUCKET).remove([raw.objectName]).catch(()=>{});throw e}}

async function paymentHandoff(ctx,req,dealId){const rows=await sql`select d.id deal_key,odd.document_key from portal_private.deals d left join portal_private.owner_deal_documents odd on odd.deal_key=d.id and odd.document_kind='SIGNED_ADDENDUM' where d.deal_id=${dealId} order by odd.updated_at desc nulls last limit 1`;if(!rows.length)throw Object.assign(new Error('DEAL_NOT_FOUND'),{status:404});if(!rows[0].document_key)throw Object.assign(new Error('SIGNED_ADDENDUM_REQUIRED'),{status:409});return sql.begin(async tx=>{await tx`insert into portal_private.owner_deal_workflow(deal_key,payment_handoff_state,payment_handoff_at,payment_handoff_by,signed_supplement_document_key,signed_supplement_checked_at,signed_supplement_checked_by) values(${rows[0].deal_key}::uuid,'SENT',now(),${ctx.userId}::uuid,${rows[0].document_key}::uuid,now(),${ctx.userId}::uuid) on conflict(deal_key) do update set payment_handoff_state='SENT',payment_handoff_at=now(),payment_handoff_by=${ctx.userId}::uuid,signed_supplement_document_key=${rows[0].document_key}::uuid,signed_supplement_checked_at=now(),signed_supplement_checked_by=${ctx.userId}::uuid,updated_at=now()`;await tx`update portal_private.owner_deal_documents set checked_by_admin=true,checked_at=now(),checked_by=${ctx.userId}::uuid,updated_at=now() where deal_key=${rows[0].deal_key}::uuid and document_key=${rows[0].document_key}::uuid and document_kind='SIGNED_ADDENDUM'`;await audit(tx,ctx,'OWNER_DEAL_SENT_TO_PAYMENTS','DEAL',dealId,req,{});return{dealId,status:'SENT'}})}

async function signedUrlForDocument(ctx,documentId,mode){let allowed=[];if(mode==='client')allowed=(await clientScope(ctx)).map(x=>String(x.client_key));else if(mode==='agent')allowed=(await agentScope(ctx)).map(x=>String(x.client_key));
  const rows=await sql`select d.id,d.document_id,d.client_key,d.document_type,d.authoritative_filename,dv.storage_path,so.bucket_id from portal_private.documents d join portal_private.document_versions dv on dv.id=d.current_version_id and dv.document_key=d.id join portal_private.storage_objects so on so.document_version_key=dv.id and so.storage_state='VERIFIED' where d.document_id=${documentId} and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and dv.is_current and dv.is_effective limit 1`;if(!rows.length)throw Object.assign(new Error('DOCUMENT_NOT_FOUND'),{status:404});const r=rows[0];if(mode!=='admin'&&!allowed.includes(String(r.client_key)))throw Object.assign(new Error('DOCUMENT_ACCESS_DENIED'),{status:403});const {data,error}=await service.storage.from(String(r.bucket_id||BUCKET)).createSignedUrl(String(r.storage_path),120,{download:String(r.authoritative_filename||'document.pdf')});if(error||!data?.signedUrl)throw Object.assign(new Error('SIGNED_URL_FAILED'),{status:502});return{documentId:String(r.document_id),filename:String(r.authoritative_filename),url:data.signedUrl,expiresIn:120}}

async function clientBootstrap(ctx){const scope=await clientScope(ctx),keys=scope.map(x=>String(x.client_key));if(!keys.length)return{companies:[],prices:[],applications:[],deals:[],documents:[],analytics:[],news:[],radio:[]};
  const contracts=await sql`select cl.client_id,cl.legal_name,ct.contract_id,ct.current_external_contract_number,d.document_id contract_document_id,d.authoritative_filename contract_filename from portal_private.client_user_bindings b join portal_private.clients cl on cl.id=b.client_key join portal_private.contracts ct on ct.id=b.contract_key left join portal_private.documents d on d.id=ct.current_signed_document_id where b.user_id=${ctx.userId}::uuid and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null and b.valid_from<=now() and (b.valid_to is null or b.valid_to>now())`;
  const prices=await sql`select id,product,producer,supplier,rail_tariff,basis,final_station,landed_cost,rona_margin,sale_price,currency,payment_terms,commercial_terms,agreed_at from portal_private.owner_price_snapshots where publish_client=true and business_status in ('PUBLISHED','AGREED') order by agreed_at desc`;
  const applications=await sql`select a.application_id,a.product,a.quantity_tonnes,a.status::text,a.proposed_price,a.proposed_currency,d.deal_id,w.business_status owner_status,w.counter_price,w.counter_currency,w.client_counter_response from portal_private.client_applications a left join portal_private.deals d on d.id=a.linked_deal_key left join portal_private.owner_application_workflow w on w.application_key=a.id where a.client_key = any(${keys}::uuid[]) and a.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum order by a.updated_at desc`;
  const deals=await sql`select d.deal_id,d.business_status,cl.legal_name,ct.contract_id,coalesce(w.payment_handoff_state,'NOT_SENT') payment_handoff_state from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key left join portal_private.owner_deal_workflow w on w.deal_key=d.id where d.client_key = any(${keys}::uuid[]) and d.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum order by d.updated_at desc`;
  const documents=await sql`select d.deal_id,doc.document_id,doc.authoritative_filename,odd.document_kind,odd.checked_by_admin from portal_private.owner_deal_documents odd join portal_private.deals d on d.id=odd.deal_key join portal_private.documents doc on doc.id=odd.document_key where d.client_key = any(${keys}::uuid[]) and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by odd.updated_at desc`;
  const analytics=await sql`select p.publication_id,p.title,p.prepared_at,pi.product,pi.basis,pi.analytics_period_from,pi.analytics_period_to,pi.actual_value,pi.forecast_value,pi.analytics_unit,pi.forecast_scenario,pi.content_text,pi.metadata from portal_private.publications p join portal_private.publication_items pi on pi.publication_key=p.id where pi.item_type='ANALYTICS'::portal_private.publication_item_type_enum and p.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum order by coalesce(pi.analytics_as_of,p.prepared_at) desc limit 50`;
  const news=await sql`select p.publication_id,coalesce(pi.headline,p.title) headline,pi.content_text,coalesce(p.published_at,p.prepared_at) event_at from portal_private.publications p join portal_private.publication_items pi on pi.publication_key=p.id where pi.item_type='NEWS'::portal_private.publication_item_type_enum and p.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum and coalesce(p.published_at,p.prepared_at)>=now()-interval '7 days' order by coalesce(p.published_at,p.prepared_at) desc limit 100`;
  const ids=scope.map(x=>String(x.client_id));const radio=await sql`select id,item_kind,target_scope,target_id,body_text,active_from,active_until from portal_private.owner_radio_items where active_from<=now() and (active_until is null or active_until>now()) and (target_scope='ALL_CLIENTS' or (target_scope='CLIENT' and target_id = any(${ids}::text[]))) order by created_at desc`;
  return{companies:contracts,prices,applications,deals,documents,analytics,news,radio};
}

async function agentBootstrap(ctx){const scope=await agentScope(ctx),keys=scope.map(x=>String(x.client_key));const prices=await sql`select id,product,producer,supplier,rail_tariff,basis,final_station,landed_cost,rona_margin,sale_price,currency,payment_terms,commercial_terms,agreed_at from portal_private.owner_price_snapshots where publish_agent=true and business_status in ('PUBLISHED','AGREED') order by agreed_at desc`;
  if(!keys.length)return{companies:[],prices,applications:[],documents:[],radio:[]};
  const applications=await sql`select a.application_id,a.product,a.quantity_tonnes,a.status::text,d.deal_id,cl.client_id,cl.legal_name from portal_private.client_applications a join portal_private.clients cl on cl.id=a.client_key left join portal_private.deals d on d.id=a.linked_deal_key where a.client_key = any(${keys}::uuid[]) and a.lifecycle_state<>'ARCHIVED'::portal_private.lifecycle_state_enum order by a.updated_at desc`;
  const documents=await sql`select d.deal_id,cl.client_id,doc.document_id,doc.authoritative_filename,odd.document_kind from portal_private.owner_deal_documents odd join portal_private.deals d on d.id=odd.deal_key join portal_private.clients cl on cl.id=d.client_key join portal_private.documents doc on doc.id=odd.document_key where d.client_key = any(${keys}::uuid[]) and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by odd.updated_at desc`;
  const ids=scope.map(x=>String(x.agent_person_id));const radio=await sql`select id,item_kind,target_scope,target_id,body_text,active_from,active_until from portal_private.owner_radio_items where active_from<=now() and (active_until is null or active_until>now()) and (target_scope='ALL_AGENTS' or (target_scope='AGENT' and target_id = any(${ids}::text[]))) order by created_at desc`;
  return{companies:scope,prices,applications,documents,radio};
}

function ascii(v){const map={'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Sch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya','а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};return String(v??'').split('').map(c=>map[c]??(c.charCodeAt(0)<128?c:'?')).join('')}
function pdfEscape(s){return ascii(s).replace(/([\\()])/g,'\\$1').slice(0,180)}
function buildPricePdf(prices){const lines=['RONA Trade | Agent Price List',`Generated: ${new Date().toISOString().slice(0,10)}`,''];for(const p of prices){lines.push(`${p.product||'-'} | ${p.final_station||p.basis||'-'} | ${p.sale_price??'-'} ${p.currency||''} | ${p.payment_terms||'-'}`)}if(prices.length===0)lines.push('No published prices.');const cmds=[];cmds.push('0.72 0.07 0.10 rg 0 780 595 62 re f');cmds.push('1 1 1 rg BT /F1 20 Tf 40 812 Td (RONA Trade) Tj ET');cmds.push('0 0 0 rg');let y=750;for(let i=0;i<lines.length&&i<45;i++,y-=16){cmds.push(`BT /F1 ${i===0?14:9} Tf 40 ${y} Td (${pdfEscape(lines[i])}) Tj ET`)}const stream=cmds.join('\n');const objs=[];objs[1]='<< /Type /Catalog /Pages 2 0 R >>';objs[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';objs[3]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>';objs[4]=`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;objs[5]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';let out='%PDF-1.4\n',offsets=[0];for(let i=1;i<=5;i++){offsets[i]=new TextEncoder().encode(out).length;out+=`${i} 0 obj\n${objs[i]}\nendobj\n`}const xref=new TextEncoder().encode(out).length;out+='xref\n0 6\n0000000000 65535 f \n';for(let i=1;i<=5;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';out+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new TextEncoder().encode(out)}

Deno.serve(async req=>{
  const ctx=await authContext(req);if(!ctx)return send(401,{ok:false,code:'PORTAL_ACCESS_DENIED'});const path=pathOf(req),method=req.method;
  try{
    if(path==='/admin/bootstrap'&&method==='GET'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await adminSnapshot()})}
    let m=path.match(/^\/admin\/applications\/([^/]+)\/(accept|reject|counter-offer|supplier-approved)$/);if(m&&method==='POST'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await updateApplication(ctx,req,decodeURIComponent(m[1]),m[2])})}
    m=path.match(/^\/admin\/prices\/([0-9a-f-]+)\/publication$/i);if(m&&method==='POST'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await publishPrice(ctx,req,m[1])})}
    m=path.match(/^\/admin\/clients\/([^/]+)\/agent$/);if(m&&method==='POST'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await setAgentAssignment(ctx,req,decodeURIComponent(m[1]))})}
    if(path==='/admin/radio'&&method==='POST'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await postRadio(ctx,req)})}
    m=path.match(/^\/admin\/deals\/([^/]+)\/(addendum|invoice)$/);if(m&&method==='POST'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await registerDealPdf(ctx,req,decodeURIComponent(m[1]),m[2]==='addendum'?'ADDENDUM':'INVOICE',false)})}
    m=path.match(/^\/admin\/deals\/([^/]+)\/send-to-payments$/);if(m&&method==='POST'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await paymentHandoff(ctx,req,decodeURIComponent(m[1]))})}
    m=path.match(/^\/admin\/documents\/([^/]+)\/download$/);if(m&&method==='GET'){requireRole(ctx,'ADMIN');return send(200,{ok:true,data:await signedUrlForDocument(ctx,decodeURIComponent(m[1]),'admin')})}

    if(path==='/client/bootstrap'&&method==='GET'){requireRole(ctx,'CLIENT');return send(200,{ok:true,data:await clientBootstrap(ctx)})}
    m=path.match(/^\/client\/applications\/([^/]+)\/counter-offer\/(accept|decline)$/);if(m&&method==='POST'){requireRole(ctx,'CLIENT');return send(200,{ok:true,data:await clientCounterDecision(ctx,req,decodeURIComponent(m[1]),m[2])})}
    m=path.match(/^\/client\/deals\/([^/]+)\/signed-addendum$/);if(m&&method==='POST'){requireRole(ctx,'CLIENT');return send(200,{ok:true,data:await registerDealPdf(ctx,req,decodeURIComponent(m[1]),'SIGNED_ADDENDUM',true)})}
    m=path.match(/^\/client\/documents\/([^/]+)\/download$/);if(m&&method==='GET'){requireRole(ctx,'CLIENT');return send(200,{ok:true,data:await signedUrlForDocument(ctx,decodeURIComponent(m[1]),'client')})}
    m=path.match(/^\/client\/contracts\/([^/]+)\/download$/);if(m&&method==='GET'){requireRole(ctx,'CLIENT');const c=(await clientScope(ctx)).find(x=>String(x.contract_id)===decodeURIComponent(m[1]));if(!c||!c.current_signed_document_id)throw Object.assign(new Error('CONTRACT_DOCUMENT_NOT_FOUND'),{status:404});const d=(await sql`select document_id from portal_private.documents where id=${c.current_signed_document_id}::uuid limit 1`)[0];if(!d)throw Object.assign(new Error('CONTRACT_DOCUMENT_NOT_FOUND'),{status:404});return send(200,{ok:true,data:await signedUrlForDocument(ctx,String(d.document_id),'client')})}

    if(path==='/agent/bootstrap'&&method==='GET'){requireRole(ctx,'AGENT');return send(200,{ok:true,data:await agentBootstrap(ctx)})}
    if(path==='/agent/price-list.pdf'&&method==='GET'){requireRole(ctx,'AGENT');const data=await agentBootstrap(ctx),pdf=buildPricePdf(data.prices);return new Response(pdf,{status:200,headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="RONA_Trade_Agent_Price_List.pdf"','cache-control':'no-store'}})}
    m=path.match(/^\/agent\/documents\/([^/]+)\/download$/);if(m&&method==='GET'){requireRole(ctx,'AGENT');return send(200,{ok:true,data:await signedUrlForDocument(ctx,decodeURIComponent(m[1]),'agent')})}
    return send(404,{ok:false,code:'ROUTE_NOT_FOUND'});
  }catch(e){console.error('rona-owner-acceptance error',e);const status=Number(e?.status||500);return send(status>=400&&status<600?status:500,{ok:false,code:String(e?.message||'SERVER_ERROR')})}
});
