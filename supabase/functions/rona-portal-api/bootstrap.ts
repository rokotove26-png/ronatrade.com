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
        const ids = [...new Set(applications.map((a:any)=>String(a?.application_id||'').trim()).filter(Boolean))];
        if (ids.length) {
          const rows = await enrichmentSql`
            select a.application_id,
                   line.application_price,
                   line.application_currency,
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
          for (const application of applications) {
            const row:any = byId.get(String(application.application_id));
            if (!row) continue;
            application.application_price = row.application_price;
            application.application_currency = row.application_currency;
            application.resource_status = row.resource_status;
            application.resource_label = row.resource_label;
            application.resource_confirmed_at = row.resource_confirmed_at;
            application.resource_source = row.resource_source;
          }
          const headers = new Headers(response.headers);
          headers.delete('content-length');
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
