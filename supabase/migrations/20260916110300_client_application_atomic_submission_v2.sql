-- Authorization is resolved from the verified portal session. Submit identity is transactional.
create unique index client_application_submit_intent_unique_v2
on portal_private.client_applications(client_key,contract_key,source_submission_state)
where source_submission_state like 'V1_2_IDEMPOTENCY:%';

create or replace function portal_private.server_client_submit_application_v12(
 p_auth_user uuid,p_session_id uuid,p_client_id text,p_contract_id text,p_publication_item_id uuid,
 p_quantity_tonnes numeric,p_price_mode portal_private.price_mode_enum,p_proposed_price numeric,
 p_proposed_currency character,p_destination_country text,p_destination_station text,
 p_delivery_period_from date,p_delivery_period_to date,p_idempotency_key text,p_request_id uuid,p_correlation_id uuid
) returns table(application_id text,status text)
language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare r record;app_id text;app_key uuid;existing portal_private.client_applications;
 receipt portal_private.client_application_submit_receipts_v2;fingerprint text;
begin
 if p_quantity_tonnes is null or p_quantity_tonnes<=0 then raise exception 'QUANTITY_INVALID'; end if;
 if btrim(coalesce(p_destination_country,''))='' or btrim(coalesce(p_destination_station,''))='' then raise exception 'DESTINATION_REQUIRED'; end if;
 if p_delivery_period_to is not null and p_delivery_period_from is not null and p_delivery_period_to<p_delivery_period_from then raise exception 'DELIVERY_PERIOD_INVALID'; end if;
 if btrim(coalesce(p_idempotency_key,''))='' or length(p_idempotency_key)>160 then raise exception 'IDEMPOTENCY_REQUIRED'; end if;
 select au.portal_user_id,cl.id client_key,ct.id contract_key,pi.id publication_item_key,
  pi.product,pi.price,pi.currency,pi.payment_terms,pi.delivery_period_from,pi.delivery_period_to
 into r from portal_private.resolve_portal_auth(p_auth_user,p_session_id) au
 join portal_private.clients cl on cl.client_id=p_client_id
 join portal_private.contracts ct on ct.contract_id=p_contract_id and ct.client_key=cl.id
 join portal_private.publication_items pi on pi.id=p_publication_item_id
 join portal_private.publications pub on pub.id=pi.publication_key
 where au.session_allowed and 'CLIENT'=any(au.roles)
  and portal_private.client_user_has_contract_access(au.portal_user_id,ct.id,now())
  and pub.status::text='PUBLISHED' and pub.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
  and pi.item_type::text='PRICE' and pi.distribution_allowed and pi.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
  and ((pub.audience<>'SELECTED_CLIENTS' and pi.audience<>'SELECTED_CLIENTS') or exists(
   select 1 from portal_private.publication_client_targets pct where pct.publication_key=pub.id and pct.client_key=cl.id
   and (pct.target_scope='PUBLICATION' or (pct.target_scope='ITEM' and pct.publication_item_key=pi.id))))
  and (pi.valid_from is null or pi.valid_from<=now()) and (pi.valid_to is null or pi.valid_to>=now());
 if not found then raise exception 'CLIENT_PRICE_CONTEXT_DENIED'; end if;
 if p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then
  if p_proposed_price is not null or p_proposed_currency is not null then raise exception 'PUBLISHED_PRICE_OVERPOST'; end if;
 elsif p_price_mode::text='CLIENT_PROPOSED_PRICE' then
  if p_proposed_price is null or p_proposed_price<=0 or p_proposed_currency is null or btrim(p_proposed_currency::text)!~'^[A-Z]{3}$'
   then raise exception 'PROPOSED_PRICE_REQUIRED'; end if;
 else raise exception 'PRICE_MODE_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('APPLICATION_SUBMIT:'||r.client_key::text||':'||r.contract_key::text||':'||p_idempotency_key,0));
 fingerprint:=encode(extensions.digest(jsonb_build_object('publication_item_id',p_publication_item_id,'quantity',p_quantity_tonnes,
  'price_mode',p_price_mode::text,'proposed_price',p_proposed_price,'proposed_currency',p_proposed_currency,
  'country',btrim(p_destination_country),'station',btrim(p_destination_station),'period_from',p_delivery_period_from,'period_to',p_delivery_period_to)::text,'sha256'),'hex');
 select * into receipt from portal_private.client_application_submit_receipts_v2 sr
  where sr.client_key=r.client_key and sr.contract_key=r.contract_key and sr.idempotency_key=p_idempotency_key;
 if found then
  if receipt.request_fingerprint<>fingerprint then raise exception 'APPLICATION_IDEMPOTENCY_PAYLOAD_CONFLICT'; end if;
  select * into existing from portal_private.client_applications a where a.application_id=receipt.application_id;
  if not found then raise exception 'APPLICATION_RETIRED_NO_RESUBMISSION'; end if;
  return query select existing.application_id,existing.status::text;return;
 end if;
 select * into existing from portal_private.client_applications a where a.client_key=r.client_key and a.contract_key=r.contract_key
  and a.source_submission_state='V1_2_IDEMPOTENCY:'||p_idempotency_key;
 if found then
  if existing.source_publication_item_id is distinct from p_publication_item_id
   or existing.quantity_tonnes is distinct from p_quantity_tonnes or existing.price_mode is distinct from p_price_mode
   or existing.destination is distinct from btrim(p_destination_country)||' / '||btrim(p_destination_station)
   then raise exception 'LEGACY_APPLICATION_RECEIPT_CONFLICT'; end if;
  return query select existing.application_id,existing.status::text;return;
 end if;
 if exists(select 1 from portal_private.client_application_tombstones_v2 t
  where t.application_snapshot->>'source_submission_state'='V1_2_IDEMPOTENCY:'||p_idempotency_key
  and t.application_snapshot->>'client_key'=r.client_key::text and t.application_snapshot->>'contract_key'=r.contract_key::text)
  then raise exception 'APPLICATION_RETIRED_NO_RESUBMISSION'; end if;
 app_id:=portal_private.next_application_business_id(r.client_key);
 insert into portal_private.client_applications(application_id,client_key,contract_key,source_publication_id,
  source_publication_item_id,product,quantity_tonnes,delivery_period_from,delivery_period_to,delivery_basis,destination,
  delivery_method,payment_terms,price_mode,proposed_price,proposed_currency,status,submitted_at,source_system,source_version,
  source_timestamp,authority_state,lifecycle_state,source_price_mode,source_submission_state)
 select app_id,r.client_key,r.contract_key,pi.publication_key,r.publication_item_key,r.product,p_quantity_tonnes,
  p_delivery_period_from,p_delivery_period_to,pi.basis,btrim(p_destination_country)||' / '||btrim(p_destination_station),
  'TO_BE_CONFIRMED',coalesce(r.payment_terms,'TO_VERIFY'),p_price_mode,p_proposed_price,p_proposed_currency,
  'SUBMITTED',now(),'CLIENT_PORTAL','APPLICATION_BUSINESS_V2',now(),'SOURCE_RECEIVED','ACTIVE',
  case when p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then 'PUBLISHED_PRICE' else 'CLIENT_PROPOSED_PRICE' end,
  'V1_2_IDEMPOTENCY:'||p_idempotency_key from portal_private.publication_items pi where pi.id=r.publication_item_key returning id into app_key;
 insert into portal_private.application_lines(application_key,line_no,publication_item_key,product,quantity_tonnes,
  price_mode,published_price,proposed_price,currency,source_mode)
 values(app_key,1,r.publication_item_key,r.product,p_quantity_tonnes,p_price_mode,r.price,p_proposed_price,
  case when p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then r.currency else p_proposed_currency end,
  case when p_price_mode::text='ACCEPT_PUBLISHED_PRICE' then 'PUBLISHED_PRICE' else 'CLIENT_PROPOSED_PRICE' end);
 insert into portal_private.client_application_submit_receipts_v2(client_key,contract_key,idempotency_key,request_fingerprint,application_id)
 values(r.client_key,r.contract_key,p_idempotency_key,fingerprint,app_id);
 insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
 values(r.portal_user_id,'CLIENT','APPLICATION_SUBMIT_V12','APPLICATION',app_id,p_request_id,p_correlation_id,
  jsonb_build_object('client_id',p_client_id,'contract_id',p_contract_id,'price_mode',p_price_mode::text,
   'data_contract','APPLICATION_BUSINESS_V2','request_fingerprint',fingerprint));
 return query select app_id,'SUBMITTED'::text;
end $$;

create table portal_private.client_application_bundle_receipts_v2(
 client_key uuid not null references portal_private.clients(id),contract_key uuid not null references portal_private.contracts(id),
 idempotency_key text not null,request_fingerprint text not null,application_id text not null,details_event_id text not null,
 created_at timestamptz not null default now(),primary key(client_key,contract_key,idempotency_key));
alter table portal_private.client_application_bundle_receipts_v2 enable row level security;
revoke all on portal_private.client_application_bundle_receipts_v2 from public,anon,authenticated;

create function portal_private.submit_client_application_bundle_v2(
 p_auth_user uuid,p_session_id uuid,p_body jsonb,p_request_id uuid,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare app record;ev record;cl uuid;ct uuid;user_key uuid;key text;fp text;
 details jsonb;previous portal_private.client_application_bundle_receipts_v2;i record;
begin
 if jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(p_body->'applicationDetails') is distinct from 'object'
  then raise exception 'APPLICATION_DETAILS_REQUIRED'; end if;
 key:=btrim(coalesce(p_body->>'idempotencyKey',''));
 if key='' or length(key)>150 then raise exception 'IDEMPOTENCY_REQUIRED'; end if;
 select c.id,t.id,au.portal_user_id into cl,ct,user_key from portal_private.resolve_portal_auth(p_auth_user,p_session_id) au
  join portal_private.clients c on c.client_id=p_body->>'clientId'
  join portal_private.contracts t on t.contract_id=p_body->>'contractId' and t.client_key=c.id
  where au.session_allowed and 'CLIENT'=any(au.roles) and portal_private.client_user_has_contract_access(au.portal_user_id,t.id,now());
 if cl is null or ct is null or user_key is null then raise exception 'CLIENT_PRICE_CONTEXT_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('APPLICATION_BUNDLE:'||cl::text||':'||ct::text||':'||key,0));
 fp:=encode(extensions.digest((p_body-'requestId'-'correlationId')::text,'sha256'),'hex');
 select * into previous from portal_private.client_application_bundle_receipts_v2 b
  where b.client_key=cl and b.contract_key=ct and b.idempotency_key=key;
 if found then
  if previous.request_fingerprint<>fp then raise exception 'APPLICATION_IDEMPOTENCY_PAYLOAD_CONFLICT'; end if;
  if not exists(select 1 from portal_private.client_applications where application_id=previous.application_id)
   then raise exception 'APPLICATION_RETIRED_NO_RESUBMISSION'; end if;
  select previous.application_id as application_id into app;
 else
  details:=p_body->'applicationDetails';
  if details->>'message_type' is distinct from 'APPLICATION_DETAILS_V5'
   or details->>'client_id' is distinct from p_body->>'clientId'
   or details->>'contract_id' is distinct from p_body->>'contractId'
   or (details->>'quantity_tonnes')::numeric is distinct from (p_body->>'quantityTonnes')::numeric
   or details#>>'{reference,publication_item_id}' is distinct from p_body->>'publicationItemId'
   then raise exception 'APPLICATION_DETAILS_SOURCE_CONFLICT'; end if;
  select * into app from portal_private.server_client_submit_application_v12(p_auth_user,p_session_id,
   p_body->>'clientId',p_body->>'contractId',(p_body->>'publicationItemId')::uuid,(p_body->>'quantityTonnes')::numeric,
   (p_body->>'priceMode')::portal_private.price_mode_enum,nullif(p_body->>'proposedPrice','')::numeric,
   nullif(p_body->>'proposedCurrency','')::char(3),p_body->>'destinationCountry',p_body->>'destinationStation',
   nullif(p_body->>'deliveryPeriodFrom','')::timestamptz::date,nullif(p_body->>'deliveryPeriodTo','')::timestamptz::date,
   key,p_request_id,p_correlation_id);
  if nullif(details->>'application_id','') is not null and details->>'application_id'<>app.application_id
   then raise exception 'APPLICATION_DETAILS_TARGET_CONFLICT'; end if;
  details:=details||jsonb_build_object('application_id',app.application_id);
  select * into ev from portal_private.server_submit_reverse_event(p_auth_user,p_session_id::text,'CLIENT_MESSAGE_SUBMIT',
   'APPLICATION','APPLICATION',app.application_id,p_body->>'clientId',p_body->>'contractId',null,details,
   'APPLICATION-DETAILS:'||app.application_id,p_request_id,p_correlation_id);
  insert into portal_private.client_application_bundle_receipts_v2(client_key,contract_key,idempotency_key,
   request_fingerprint,application_id,details_event_id) values(cl,ct,key,fp,app.application_id,ev.event_id);
 end if;
 select ci.intake_id,ci.durable_id,ci.source_record_id,ci.source_submitted_at,ci.routing_state into i
 from portal_private.client_intake_v1 ci join portal_private.client_applications a on a.id=ci.application_key
 where a.application_id=app.application_id and ci.source_kind='CLIENT_APPLICATION';
 if i.intake_id is null or not exists(select 1 from portal_private.client_intake_task_links_v1 l where l.intake_id=i.intake_id)
  then raise exception 'APPLICATION_DURABILITY_OR_ROUTING_MISSING'; end if;
 return jsonb_build_object('application_id',app.application_id,'intake_id',i.intake_id,'durable_id',i.durable_id,
  'source_id',i.source_record_id,'submitted_at',i.source_submitted_at,'routing_state',i.routing_state,
  'bundle_complete',true,'business_contract','RONA_APPLICATION_BUSINESS_V2');
end $$;
revoke all on function portal_private.server_client_submit_application_v12(uuid,uuid,text,text,uuid,numeric,
 portal_private.price_mode_enum,numeric,character,text,text,date,date,text,uuid,uuid),
 portal_private.submit_client_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid) from public,anon,authenticated;
