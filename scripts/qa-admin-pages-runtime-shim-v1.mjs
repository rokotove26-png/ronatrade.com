import http from 'node:http';
import { onRequest as approvedPolishUi } from '../functions/portal/admin-approved-polish-ui.js';
import { onRequest as approvedShellUi } from '../functions/portal/admin-approved-shell-v455-ui.js';
import { onRequest as approvedClaimsUi } from '../functions/portal/admin-approved-claims-v455-ui.js';
import { onRequest as approvedAnalyticsUi } from '../functions/portal/admin-approved-analytics-v455-ui.js';

const originalCreateServer=http.createServer.bind(http);
const functionRoutes=new Map([
  ['/portal/admin-approved-polish-ui',approvedPolishUi],
  ['/portal/admin-approved-shell-v455-ui',approvedShellUi],
  ['/portal/admin-approved-claims-v455-ui',approvedClaimsUi],
  ['/portal/admin-approved-analytics-v455-ui',approvedAnalyticsUi]
]);

async function bridgeWebResponse(res,response){
  const headers={};
  response.headers.forEach((value,key)=>{headers[key]=value});
  res.writeHead(response.status,headers);
  const body=Buffer.from(await response.arrayBuffer());
  res.end(body);
}

async function runFunction(handler,res){
  try{
    const response=await handler();
    await bridgeWebResponse(res,response);
  }catch(error){
    if(!res.headersSent)res.writeHead(500,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end('QA Pages Function bridge failed: '+String(error?.message||error));
  }
}

http.createServer=function(...args){
  const listenerIndex=args.findIndex(value=>typeof value==='function');
  if(listenerIndex<0)return originalCreateServer(...args);
  const listener=args[listenerIndex];
  const wrapped=async(req,res)=>{
    const u=new URL(req.url||'/','http://127.0.0.1');
    const functionHandler=functionRoutes.get(u.pathname);
    if(functionHandler)return runFunction(functionHandler,res);

    // In Cloudflare Pages this path is a real Function route. In browser QA we keep
    // the same request path while rewriting it to the harness' authoritative
    // bootstrap fixture, avoiding any live external Finance/Auth dependency.
    if(u.pathname==='/portal/admin-completed-bootstrap'){
      const originalUrl=req.url;
      req.url='/portal/api/v1/admin/bootstrap';
      try{return await listener(req,res)}finally{req.url=originalUrl}
    }

    return listener(req,res);
  };
  const next=[...args];
  next[listenerIndex]=wrapped;
  return originalCreateServer(...next);
};

console.log('QA_ADMIN_PAGES_RUNTIME_SHIM=ENABLED routes=approved-polish,approved-shell,approved-claims,approved-analytics,completed-bootstrap');
