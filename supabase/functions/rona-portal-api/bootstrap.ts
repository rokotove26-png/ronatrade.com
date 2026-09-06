import postgres from "postgres";

const originalRequestJson = Request.prototype.json;
const DATE_ONLY_OR_ISO = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/;
const DB = Deno.env.get("SUPABASE_DB_URL");
const enrichmentSql = DB ? postgres(DB,{prepare:false,max:1,idle_timeout:1,connect_timeout:3,max_lifetime:15}) : null;
const CLIENT_READ_SINGLE_FLIGHT_ROUTES = new Set([
  '/v1/client/context',
  '/v1/client/prices',
  '/v1/client/market',
  '/v1/client/shipments',
  '/v1/client/rail',
  '/v1/client/deals',
  '/v1/client/documents',
  '/v1/client/payments',
  '/v1/client/claims',
  '/v1/client/messages',
  '/v1/client/archive',
]);
const clientReadInflight = new Map<string,Promise<Response>>();

function canonicalDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  const match = raw.match(DATE_ONLY_OR_ISO);
  if (!match) return value;
  const day = match[1];
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return value;
  return day;
}

function apiRoute(pathname:string):string {
  const marker='/rona-portal-api';
  const index=pathname.indexOf(marker);
  return index>=0?(pathname.slice(index+marker.length)||'/'):pathname;
}

function singleFlightKey(req:Request):string|null {
  if(req.method!=='GET')return null;
  let url:URL;
  try{url=new URL(req.url)}catch{return null}
  const route=apiRoute(url.pathname);
  if(!CLIENT_READ_SINGLE_FLIGHT_ROUTES.has(route))return null;
  const authorization=req.headers.get('authorization');
  if(!authorization)return null;
  return `${authorization}\n${route}\n${url.search}`;
}

Request.prototype.json = async function patchedJson(...args: Parameters<Request['json']>) {
  const value = await originalRequestJson.apply(this, args as []);
  try {
    const url = new URL(this.url);
    if (this.method === 'POST' && url.pathname.endsWith('/v1/client/applications') && value && typeof value === 'object' && !Array.isArray(value)) {
      const body = value as Record<string, unknown>;
      body.deliveryPeriodFrom = canonicalDate(body.deliveryPeriodFrom);
      body.deliveryPeriodTo = canonicalDate(body.deliveryPeriodTo);
    }
  } catch (_) {
    // Leave the parsed payload untouched; the canonical API validation remains authoritative.
  }
  return value;
};

const nativeServe:any = Deno.serve.bind(Deno);
(Deno as any).serve = function patchedServe(first:any, second?:any) {
  const handler = typeof first === 'function' ? first : second;
  const options = typeof first === 'function' ? undefined : first;
  if (typeof handler !== 'function') return nativeServe(first, second);

  const run = async (req:Request, info:any) => {
    const response:Response = await handler(req, info);
    try {
      const url = new URL(req.url);
      if (req.method === 'GET' && url.pathname.endsWith('/v1/client/context') && response.ok && enrichmentSql && (response.headers.get('content-type')||'').includes('application/json')) {
        const payload:any = await response.clone().json();
        const applications = Array.isArray(payload?.data?.applications) ? payload.data.applications : [];
        const deals = Array.isArray(payload?.data?.deals) ? payload.data.deals : [];
        const ids = [...new Set(applications.map((a:any)=>String(a?.application_id||'').trim()).filter(Boolean))];
        let changed = false;
        if (ids.length) {
          const rows = await enrichmentSql`
            select a.application_id,
                   d.deal_id,
                   line.application_price,
                   line.application_currency,
                   case
                     when a.status::text='DEAL_REGISTERED'
                      and w.business_status='DEAL'
                      and coalesce(w.counter_offer_used,false)=false
                      and a.quantity_tonnes is not null and a.quantity_tonnes>0
                      and a.proposed_price is not null and a.proposed_price>0
                      and nullif(trim(a.proposed_currency::text),'') is not null
                     then (a.quantity_tonnes::numeric*a.proposed_price::numeric)
                     else null
                   end as passport_amount,
                   case
                     when a.status::text='DEAL_REGISTERED'
                      and w.business_status='DEAL'
                      and coalesce(w.counter_offer_used,false)=false
                      and a.quantity_tonnes is not null and a.quantity_tonnes>0
                      and a.proposed_price is not null and a.proposed_price>0
                      and nullif(trim(a.proposed_currency::text),'') is not null
                     then trim(a.proposed_currency::text)
                     else null
                   end as passport_currency,
                   case
                     when a.status::text='DEAL_REGISTERED'
                      and w.business_status='DEAL'
                      and coalesce(w.counter_offer_used,false)=false
                      and a.quantity_tonnes is not null and a.quantity_tonnes>0
                      and a.proposed_price is not null and a.proposed_price>0
                      and nullif(trim(a.proposed_currency::text),'') is not null
                     then case when w.finalized_at is not null then 'FINALIZED_APPLICATION_COMMERCIAL_TERMS' else 'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS' end
                     else null
                   end as passport_amount_source,
                   case
                     when coalesce(resource.resource_status,'')='RESOURCE_CONFIRMED' then 'RESOURCE_CONFIRMED'
                     when w.supplier_approved_at is not null then 'RESOURCE_CONFIRMED'
                     else 'RESOURCE_NOT_CONFIRMED'
                   end as resource_status,
                   case
                     when coalesce(resource.resource_status,'')='RESOURCE_CONFIRMED' then 'Ресурс подтвержден'
                     when w.supplier_approved_at is not null then 'Ресурс подтвержден'
                     else 'Ресурс не подтвержден'
                   end as resource_label,
                   coalesce(resource.resource_confirmed_at,w.supplier_approved_at) as resource_confirmed_at,
                   case
                     when coalesce(resource.resource_status,'')<>'' then resource.resource_source
                     when w.supplier_approved_at is not null then 'OWNER_APPLICATION_WORKFLOW'
                     else 'NO_AUTHORITATIVE_RESOURCE_FACT'
                   end as resource_source
              from portal_private.client_applications a
              left join portal_private.deals d on d.id=a.linked_deal_key
              left join lateral (
                select coalesce(al.proposed_price,al.published_price) as application_price,
                       trim(al.currency::text) as application_currency
                  from portal_private.application_lines al
                 where al.application_key=a.id
                 order by al.line_no
                 limit 1
              ) line on true
              left join portal_private.owner_application_workflow w on w.application_key=a.id
              left join lateral portal_private.resolve_deal_resource_state(a.linked_deal_key) resource on a.linked_deal_key is not null
             where a.application_id in (select value from jsonb_array_elements_text(${enrichmentSql.json(ids)}::jsonb))
          `;
          const byId = new Map(rows.map((r:any)=>[String(r.application_id),r]));
          const byDeal = new Map(rows.filter((r:any)=>r.deal_id).map((r:any)=>[String(r.deal_id),r]));
          for (const application of applications) {
            const row:any = byId.get(String(application.application_id));
            if (!row) continue;
            application.application_price = row.application_price;
            application.application_currency = row.application_currency;
            application.resource_status = row.resource_status;
            application.resource_label = row.resource_label;
            application.resource_confirmed_at = row.resource_confirmed_at;
            application.resource_source = row.resource_source;
            changed = true;
          }
          for (const deal of deals) {
            const row:any = byDeal.get(String(deal?.deal_id||''));
            if (!row || row.passport_amount == null || !String(row.passport_currency||'').trim()) continue;
            if (deal.passport_amount == null || !String(deal.passport_currency||'').trim()) {
              deal.passport_amount = Number(row.passport_amount);
              deal.passport_currency = String(row.passport_currency).trim().toUpperCase();
              deal.passport_amount_source = String(row.passport_amount_source||'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS');
              deal.passport_application_id = String(row.application_id);
              changed = true;
            }
          }
        }

        const requestClientId = String(url.searchParams.get('clientId')||'').trim();
        const requestContractId = String(url.searchParams.get('contractId')||'').trim();
        const responseClientId = String(payload?.data?.contract?.client_id||'').trim();
        const responseContractId = String(payload?.data?.contract?.contract_id||'').trim();
        if (requestClientId && requestContractId && requestClientId===responseClientId && requestContractId===responseContractId) {
          const metricRows = await enrichmentSql`
            select
              (select count(*)::int
                 from portal_private.client_applications a
                 join portal_private.clients cl on cl.id=a.client_key
                 join portal_private.contracts ct on ct.id=a.contract_key
                where cl.client_id=${requestClientId} and ct.contract_id=${requestContractId}
                  and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum) as applications_total,
              (select count(*)::int
                 from portal_private.deals d
                 join portal_private.clients cl on cl.id=d.client_key
                 join portal_private.contracts ct on ct.id=d.contract_key
                where cl.client_id=${requestClientId} and ct.contract_id=${requestContractId}
                  and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum) as deals_total,
              (select count(*)::int
                 from portal_private.documents d
                 join portal_private.clients cl on cl.id=d.client_key
                 join portal_private.contracts ct on ct.id=d.contract_key
                 join portal_private.document_versions dv on dv.id=d.current_version_id
                where cl.client_id=${requestClientId} and ct.contract_id=${requestContractId}
                  and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
                  and d.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
                  and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
                  and dv.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
                  and dv.is_current is true and dv.is_effective is true
                  and (
                    upper(d.document_type) like '%CONTRACT%' or upper(d.document_type) like '%КОНТРАКТ%' or upper(d.document_type) like '%ДОГОВОР%'
                    or upper(d.document_type) like '%ADDENDUM%' or upper(d.document_type) like '%ADDITIONAL AGREEMENT%' or upper(d.document_type) like '%ДОПОЛНИТЕЛЬН%'
                    or upper(d.document_type) like '%INVOICE%' or upper(d.document_type) like '%ИНВОЙС%'
                  )) as documents_total
          `;
          const metrics:any = metricRows[0];
          if (metrics) {
            payload.data.company_metrics = {
              applications_total:Number(metrics.applications_total||0),
              deals_total:Number(metrics.deals_total||0),
              documents_total:Number(metrics.documents_total||0),
              documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',
              source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',
            };
            changed = true;
          }
        }

        if (changed) {
          const headers = new Headers(response.headers);
          headers.delete('content-length');
          headers.set('x-rona-client-context-enrichment','prod-incident-430-v1');
          return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
        }
      }
    } catch (error) {
      console.error('client application context enrichment failed',error);
    }
    return response;
  };

  const wrapped = async (req:Request, info:any) => {
    const key=singleFlightKey(req);
    if(!key)return run(req,info);
    const existing=clientReadInflight.get(key);
    if(existing)return (await existing).clone();
    const task=run(req,info);
    clientReadInflight.set(key,task);
    try{return (await task).clone()}
    finally{if(clientReadInflight.get(key)===task)clientReadInflight.delete(key)}
  };

  return options===undefined ? nativeServe(wrapped) : nativeServe(options,wrapped);
};

// Keep the deployed Edge Function on the exact modular source shipped by this release.
// Remote commit imports create a second source lineage and can silently drift from the
// repository head that frontend/backend QA validates.
import "./index.ts";
