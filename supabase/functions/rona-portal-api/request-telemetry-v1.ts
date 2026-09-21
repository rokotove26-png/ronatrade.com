import { recordApiEvent, send, type Ctx } from "./shared.ts";

const MAX_SOURCE_LENGTH=180;
const MAX_REASON_LENGTH=96;

function text(value: unknown, max: number): string | null {
  const normalized=String(value ?? "").replace(/\s+/g," ").trim();
  return normalized ? normalized.slice(0,max) : null;
}

function resultForStatus(status: number): "SUCCESS"|"DENIED"|"NOT_FOUND"|"INVALID_REQUEST"|"FAILURE" {
  if(status>=200&&status<300)return "SUCCESS";
  if(status===401||status===403)return "DENIED";
  if(status===404)return "NOT_FOUND";
  if(status===400||status===405||status===409||status===422)return "INVALID_REQUEST";
  return "FAILURE";
}

function refreshReason(req: Request, route: string, caller: string|null): string {
  const explicit=text(req.headers.get("x-rona-client-refresh-reason"),MAX_REASON_LENGTH);
  if(explicit)return explicit;
  const source=String(caller||"").toLowerCase();
  if(source.includes("context-change"))return "CONTEXT_CHANGE";
  if(source.includes("invalidat"))return "INVALIDATION";
  if(source.includes("pageshow")||source.includes("page-show"))return "PAGE_SHOW";
  if(source.includes("reconnect"))return "RECONNECT";
  if(source.includes("mutation"))return "POST_MUTATION";
  if(source.includes("section-open")||source.includes("owner-open")||source.includes(":open"))return "SECTION_OPEN";
  if(source.includes("bootstrap")||route.endsWith("/bootstrap"))return "INITIAL_OR_BOOTSTRAP";
  if(source.includes("directory-refresh"))return "DIRECTORY_REFRESH";
  return "REQUEST";
}

function schedule(task: Promise<unknown>): void {
  const runtime=(globalThis as any).EdgeRuntime;
  if(runtime&&typeof runtime.waitUntil==="function"){
    runtime.waitUntil(task);
    return;
  }
  task.catch(error=>console.error("portal api telemetry background write failed",error));
}

export function portalApiReply(
  req: Request,
  route: string,
  origin: string|null,
  c: Ctx,
  startedAt: number,
){
  const url=new URL(req.url);
  const caller=text(req.headers.get("x-rona-client-source"),MAX_SOURCE_LENGTH);
  const clientId=text(url.searchParams.get("clientId"),120);
  const contractId=text(url.searchParams.get("contractId"),160);

  return (status: number, body: unknown): Response => {
    const latencyMs=Math.max(0,Math.round((performance.now()-startedAt)*100)/100);
    schedule(recordApiEvent(
      req,
      route,
      resultForStatus(status),
      status,
      c,
      {
        telemetry_contract:"PORTAL_API_REQUEST_TELEMETRY_V1",
        caller_runtime:caller,
        refresh_reason:refreshReason(req,route,caller),
        client_id:clientId,
        contract_id:contractId,
        transport:"NETWORK",
        request_cache:String(req.cache||"default"),
        latency_ms:latencyMs,
      },
    ));
    return send(origin,status,body);
  };
}
