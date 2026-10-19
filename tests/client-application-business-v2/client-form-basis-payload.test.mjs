import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const formSource=readFileSync(new URL('../../assets/portal-runtime/client-application-form-v3.js',import.meta.url),'utf8');
const begin=formSource.indexOf('function detailsPayload(');
const end=formSource.indexOf('\nfunction open(item,ctx)',begin);
assert.ok(begin>=0 && end>begin,'original client payload builder must exist');
const factory=new Function('num','producer',formSource.slice(begin,end)+'\nreturn detailsPayload;');
const payload=factory(v=>Number(v),()=> 'Verified producer');

function request(mode,station='Киргили'){
 const values={
  consignee_name:'Consignee',consignee_code:'123',consignee_address:'Address',consignee_phone:'-',
  destination_station:station,destination_station_road:'73 Узбк',
  border_station:'Сарыагаш',border_station_road:'68 Кзх',border_station_country:'Казахстан',
  special_statements:'',freight_payment_terms:'Согласно условиям договора поставки',
  payment_terms:'30% аванс',comment:''
 };
 const form={elements:Object.fromEntries(Object.entries(values).map(([name,value])=>[name,{value}]))};
 const item={publication_item_id:'f28a4f6a-0000-4000-8000-000000000001',product:'СУГ (СПБТ)',price:745,
  currency:'USD',delivery_period_from:'2026-09-01',delivery_period_to:'2026-10-31'};
 const ctx={client_id:'C002',contract_id:'CTR-C002'};
 const ref={stations:[],as_of:'2026-08-27',station_count:10,border_count:5};
 return payload(form,item,ctx,ref,'CPT Сарыагаш',500,'Узбекистан','742705','704101',mode);
}
test('Delivered-price client request preserves requested DAP station, not published source basis',()=>{
 const p=request('CALCULATION');
 assert.equal(p.message_type,'DELIVERED_PRICE_CALCULATION_REQUEST_V1');
 assert.equal(p.commercial.price_mode,'REQUEST_DELIVERED_PRICE');
 assert.equal(p.commercial.destination_price_requested,true);
 assert.equal(p.commercial.requested_delivery_basis,'DAP ст. Киргили, Incoterms 2020');
 assert.equal(p.shipment.source_basis,'CPT Сарыагаш');
 assert.equal(p.destination.station,'Киргили');
});
test('Published-price request preserves source basis even when ultimate destination differs',()=>{
 const p=request('APPLICATION','Чиноз');
 assert.equal(p.commercial.requested_delivery_basis,'CPT Сарыагаш');
 assert.equal(p.commercial.destination_price_requested,false);
 assert.equal(p.shipment.source_basis,'CPT Сарыагаш');
 assert.equal(p.destination.station,'Чиноз');
});
test('Client form uses verified input station, not a hardcoded destination',()=>{
 assert.equal(request('CALCULATION','Жомбой').commercial.requested_delivery_basis,'DAP ст. Жомбой, Incoterms 2020');
 assert.doesNotMatch(formSource,/DEAL-2026-01[2-6]/);
});

test('Frozen client portal HTML and visual source remain byte-identical aside from the exact data field',()=>{
 const approval=JSON.parse(readFileSync(new URL('../../governance/client-basis-payload-functional-exception-20261019.json',import.meta.url),'utf8'));
 const old="price_mode:mode==='CALCULATION'?'REQUEST_DELIVERED_PRICE':'ACCEPT_PUBLISHED_PRICE',published_price_reference:num(item.price),published_basis_reference:basis,";
 const now="price_mode:mode==='CALCULATION'?'REQUEST_DELIVERED_PRICE':'ACCEPT_PUBLISHED_PRICE',requested_delivery_basis:mode==='CALCULATION'?('DAP ст. '+String(form.elements.destination_station.value||'').trim()+', Incoterms 2020'):basis,published_price_reference:num(item.price),published_basis_reference:basis,";
 const blob=t=>{const b=Buffer.from(t,'utf8');return createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');};
 assert.equal(formSource.split(now).length,2);
 assert.equal(blob(formSource),approval.exact_authorized_payload_only_blob_sha);
 assert.equal(blob(formSource.replace(now,old)),approval.exact_frozen_baseline_blob_sha);
 assert.equal(approval.checks.no_dom_html_css_change,true);
});
