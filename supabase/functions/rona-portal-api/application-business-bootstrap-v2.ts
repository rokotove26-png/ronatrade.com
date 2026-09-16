// PR548 release entrypoint. No deployment or policy activation is performed by importing source.
// Non-application behavior delegates to the exact verified production predecessor.
import {sql,authenticate,apiRoute} from 'https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/77588541119bb1a96375beed3e853e067ab1422f/supabase/functions/rona-portal-api/shared.ts';
import {createApplicationBusinessHandler} from '../_shared/client-application-business-v2/handler.mjs';
const nativeServe:any=Deno.serve.bind(Deno);
(Deno as any).serve=function applicationBusinessServe(first:any,second?:any){
 const handler=typeof first==='function'?first:second,options=typeof first==='function'?undefined:first;
 if(typeof handler!=='function')return nativeServe(first,second);
 const wrapped=createApplicationBusinessHandler(handler,{sql,authenticate,apiRoute});
 return options===undefined?nativeServe(wrapped):nativeServe(options,wrapped);
};
await import('https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/c4e93c8445a84aa987588558823533be2d1f4511/supabase/functions/rona-portal-api/stage24-bootstrap.ts');
