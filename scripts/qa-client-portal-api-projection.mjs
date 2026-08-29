import { readFile } from 'node:fs/promises';

const path='functions/portal/api/[[path]].js';
const source=await readFile(path,'utf8');

const start=source.indexOf('function safeClientContext(data)');
const end=source.indexOf('function safeClientBootstrap',start);
if(start<0||end<0||end<=start)throw new Error('CLIENT_PORTAL_PROXY_CONTEXT_SANITIZER_MISSING');
const context=source.slice(start,end);

const required=[
  'projection_contract',
  'current_status',
  'current_status_label',
  'status_source',
  'payment_status',
  'payment_label',
  'payment_received_amount',
  'payment_obligation_amount',
  'payment_currency',
  'payment_percent',
  'payment_source',
  'resource_status',
  'resource_label',
  'resource_source'
];
for(const field of required){
  if(!context.includes(field))throw new Error(`CLIENT_PORTAL_PROXY_FIELD_MISSING ${field}`);
}

if(!source.includes("path==='/v1/client/context'"))throw new Error('CLIENT_PORTAL_PROXY_CONTEXT_ROUTE_NOT_SANITIZED');
if(!source.includes("payload.data=safeClientContext(payload.data)"))throw new Error('CLIENT_PORTAL_PROXY_CONTEXT_SANITIZER_NOT_APPLIED');
if(!source.includes("const target=path==='/v1/client/bootstrap'||path==='/v1/client/context'"))throw new Error('CLIENT_PORTAL_PROXY_CONTEXT_NOT_IN_JSON_TARGET_GATE');

console.log(`CLIENT_PORTAL_API_PROJECTION_QA=PASS path=${path} fields=${required.length}`);
