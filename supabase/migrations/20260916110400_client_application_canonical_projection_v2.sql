-- A single business projection for Client, Admin and application passports.
-- This does not change Payments/Finance read models, records or calculations.

create or replace function portal_private.ensure_client_intake_from_application_v1(p_application_id text)
returns uuid language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications; v_intake uuid; p jsonb; fp text;
begin
  select * into a from portal_private.client_applications where application_id=p_application_id;
  if not found then
    select primary_intake_id into v_intake from portal_private.client_application_tombstones_v2 where application_id=p_application_id;
    if found then return v_intake; end if;
    raise exception 'CLIENT_INTAKE_APPLICATION_NOT_FOUND';
  end if;
  if a.source_intake_key is not null then return a.source_intake_key; end if;
  select intake_id into v_intake from portal_private.client_intake_v1
    where source_kind='CLIENT_APPLICATION' and source_internal_key=a.id and source_record_id=a.application_id;
  if found then return v_intake; end if;
  p:=jsonb_build_object('application_id',a.application_id,'price_mode',a.price_mode::text,
    'quantity_tonnes',a.quantity_tonnes,'product',a.product,'destination',a.destination,
    'source_publication_id',a.source_publication_id,'source_publication_item_id',a.source_publication_item_id);
  fp:=encode(extensions.digest(concat_ws('|','CLIENT_APPLICATION',a.application_id,a.price_mode::text,
    a.quantity_tonnes::text,coalesce(a.source_publication_item_id::text,'')),'sha256'),'hex');
  v_intake:=portal_private.ensure_client_intake_v1('CLIENT_APPLICATION',a.application_id,a.id,
    'CLIENT_APPLICATION_SUBMIT',a.application_id,p,coalesce(a.submitted_at,a.created_at),
    a.client_key,a.contract_key,a.linked_deal_key,fp);
  update portal_private.client_intake_v1 set application_key=a.id,deal_key=coalesce(deal_key,a.linked_deal_key)
    where intake_id=v_intake;
  return v_intake;
end $$;

create function portal_private.application_business_row_v2(p_application_key uuid)
returns jsonb language plpgsql stable security definer
set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications; r portal_private.client_application_registry_v2;
  w portal_private.owner_application_workflow; client_id text; client_name text; contract_id text;
  deal_id text; price numeric; currency text; price_source text; agreed boolean:=false; blue boolean:=false;
  line_count integer; line_price numeric; line_currency text; owner_status text; bucket text;
  source_payload jsonb; task_status text; retention jsonb; resource_confirmed boolean;
begin
  select * into a from portal_private.client_applications where id=p_application_key;
  if not found then return null; end if;
  select * into r from portal_private.client_application_registry_v2 where application_key=a.id and retired_at is null;
  if not found then raise exception 'APPLICATION_CANONICAL_REGISTRY_MISSING'; end if;
  select cl.client_id,cl.legal_name,ct.contract_id into client_id,client_name,contract_id
    from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id
    where cl.id=a.client_key and ct.id=a.contract_key;
  if nullif(btrim(client_name),'') is null or client_id is null or contract_id is null
    then raise exception 'APPLICATION_CLIENT_CHAIN_MISSING'; end if;
  select * into w from portal_private.owner_application_workflow where application_key=a.id;
  select d.deal_id into deal_id from portal_private.deals d where d.id=a.linked_deal_key;
  if a.linked_deal_key is not null and deal_id is null then raise exception 'APPLICATION_DEAL_CHAIN_MISSING'; end if;
  if r.primary_intake_id is not null then
    source_payload:=portal_private.client_intake_effective_payload_v1(r.primary_intake_id);
  end if;
  select count(*),min(coalesce(l.published_price,l.proposed_price)),min(btrim(l.currency::text))
    into line_count,line_price,line_currency from portal_private.application_lines l where l.application_key=a.id;
  if coalesce(w.counter_offer_used,false) and w.client_counter_response='ACCEPTED' then
    price:=w.counter_price; currency:=btrim(w.counter_currency::text); price_source:='ACCEPTED_OWNER_COUNTER_OFFER';
    agreed:=true; blue:=true;
  elsif a.price_mode::text='ACCEPT_PUBLISHED_PRICE' and line_count=1 then
    price:=line_price; currency:=line_currency; price_source:='SUBMISSION_PRICE_SNAPSHOT'; agreed:=true;
  elsif a.price_mode::text<>'REQUEST_DELIVERED_PRICE' and a.proposed_price is not null then
    price:=a.proposed_price; currency:=btrim(a.proposed_currency::text);
    agreed:=a.status::text in ('ACCEPTED_AWAITING_DEAL_REGISTRATION','DEAL_REGISTERED','CLOSED')
      or coalesce(w.business_status,'')='DEAL';
    price_source:=case when agreed then 'APPROVED_APPLICATION_PRICE' else 'CLIENT_REQUESTED_PRICE' end;
  else price_source:='PRICE_AGREEMENT_PENDING'; end if;
  if price is not null and (price<=0 or currency is null or currency !~ '^[A-Z]{3}$')
    then raise exception 'APPLICATION_PRICE_AUTHORITY_INVALID'; end if;
  if agreed and price is null then raise exception 'APPLICATION_ACCEPTED_PRICE_MISSING'; end if;
  select st.status::text into task_status from portal_private.staff_tasks st
    where st.application_key=a.id order by st.created_at desc limit 1;
  owner_status:=coalesce(nullif(w.business_status,''),case
    when a.status::text='SUBMITTED' and coalesce(task_status,'NEW')='NEW' then 'NEW'
    when a.status::text='DEAL_REGISTERED' then 'DEAL'
    when a.status::text='CLOSED' then 'COMPLETED'
    when a.status::text in ('REJECTED','CANCELLED') then a.status::text else 'REVIEW' end);
  bucket:=case
    when a.status::text in ('DEAL_REGISTERED','CLOSED','CANCELLED','REJECTED')
      or owner_status in ('DEAL','COMPLETED','CLOSED') then 'COMPLETED'
    when owner_status in ('SUPPLIER_PENDING','SUPPLIER_APPROVED','CLIENT_COUNTER_ACCEPTED') then 'DECISION'
    when owner_status='NEW' then 'NEW' else 'WORK' end;
  retention:=portal_private.application_retention_decision_v2(a.id);
  resource_confirmed:=w.supplier_approved_at is not null;
  return jsonb_build_object(
    'business_contract','RONA_APPLICATION_BUSINESS_V2','record_kind','CLIENT_APPLICATION',
    'application_id',a.application_id,'client_id',client_id,'client_name',client_name,'legal_name',client_name,
    'contract_id',contract_id,'product',a.product,'quantity_tonnes',a.quantity_tonnes,
    'destination',a.destination,'delivery_basis',a.delivery_basis,
    'delivery_period_from',a.delivery_period_from,'delivery_period_to',a.delivery_period_to,
    'payment_terms',a.payment_terms,'client_request_comment',source_payload->>'comment',
    'application_price',price,'application_currency',currency,'price_source',price_source,
    'price_is_agreed',agreed,'price_is_owner_agreed',blue,
    'agreed_price',case when agreed then price end,'agreed_currency',case when agreed then currency end,
    'proposed_price',a.proposed_price,'proposed_currency',a.proposed_currency,
    'counter_price',w.counter_price,'counter_currency',w.counter_currency,
    'counter_offer_used',w.counter_offer_used,'client_counter_response',w.client_counter_response,
    'status',a.status::text,'owner_status',owner_status,'business_bucket',bucket,
    'lifecycle_state',a.lifecycle_state::text,'deal_id',deal_id,
    'resource_status',case when resource_confirmed then 'RESOURCE_CONFIRMED' else 'RESOURCE_NOT_CONFIRMED' end,
    'resource_source',case when resource_confirmed then 'OWNER_APPLICATION_WORKFLOW' else null end,
    'submitted_at',a.submitted_at,'updated_at',a.updated_at,
    'retention_decision',retention->>'decision','retention_reason',retention->>'reason',
    'technical_provenance',jsonb_build_object('intake_id',r.primary_intake_id,'source_kind',r.source_kind,
      'source_record_id',r.source_record_id,'numbering_origin',r.numbering_origin,
      'numbering_identity_key',r.numbering_identity_key));
end $$;

create function portal_private.application_business_projection_v2(
  p_audience text,p_client_id text default null,p_contract_id text default null
) returns jsonb language plpgsql stable security definer
set search_path='pg_catalog','portal_private' as $$
declare apps jsonb; row_count integer; amount_missing integer; blocked integer; currencies jsonb;
begin
  if not coalesce((select enabled from portal_private.client_application_policy_v2 where singleton),false)
    then raise exception 'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE'; end if;
  if p_audience not in ('CLIENT','ADMIN') or
    (p_audience='CLIENT' and (nullif(p_client_id,'') is null or nullif(p_contract_id,'') is null))
    then raise exception 'APPLICATION_PROJECTION_SCOPE_REQUIRED'; end if;
  select coalesce(jsonb_agg(portal_private.application_business_row_v2(a.id)
    order by a.submitted_at desc nulls last,a.created_at desc,a.id),'[]'::jsonb)
    into apps from portal_private.client_applications a
    join portal_private.clients cl on cl.id=a.client_key
    join portal_private.contracts ct on ct.id=a.contract_key and ct.client_key=a.client_key
    where (p_client_id is null or cl.client_id=p_client_id)
      and (p_contract_id is null or ct.contract_id=p_contract_id);
  row_count:=jsonb_array_length(apps);
  select count(*) filter(where not coalesce((v->>'price_is_agreed')::boolean,false)
      or v->>'application_price' is null or v->>'application_currency' is null),
    count(*) filter(where v->>'retention_decision'<>'KEEP') into amount_missing,blocked
    from jsonb_array_elements(apps) v;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.currency),'[]'::jsonb) into currencies from (
    select v->>'agreed_currency' currency,
      sum((v->>'quantity_tonnes')::numeric*(v->>'agreed_price')::numeric) amount
    from jsonb_array_elements(apps) v where (v->>'price_is_agreed')::boolean
    group by v->>'agreed_currency'
  ) s;
  return jsonb_build_object('contract','RONA_APPLICATION_BUSINESS_V2','applications',apps,
    'application_kpi',jsonb_build_object('source','RONA_APPLICATION_BUSINESS_V2',
      'total',row_count,'retention_blockers',blocked,
      'tonnage',case when blocked=0 then (select coalesce(sum((v->>'quantity_tonnes')::numeric),0) from jsonb_array_elements(apps) v) end,
      'new',(select count(*) from jsonb_array_elements(apps) v where v->>'business_bucket'='NEW'),
      'in_work',(select count(*) from jsonb_array_elements(apps) v where v->>'business_bucket'='WORK'),
      'decision',(select count(*) from jsonb_array_elements(apps) v where v->>'business_bucket'='DECISION'),
      'completed',(select count(*) from jsonb_array_elements(apps) v where v->>'business_bucket'='COMPLETED'),
      'deal_registered',(select count(*) from jsonb_array_elements(apps) v where v->>'deal_id' is not null),
      'missing_agreed_price',amount_missing,
      'amounts',case when amount_missing=0 and blocked=0 then currencies else null end,
      'state',case when blocked>0 then 'RETENTION_REVIEW_REQUIRED' when amount_missing>0 then 'PRICE_AGREEMENT_PENDING' else 'READY' end));
end $$;

-- Use the existing privileged tick entrypoint, so the established scheduler remains the owner.
-- The explicit enabled flag prevents background recovery before release activation.
create or replace function portal_private.client_intake_reconciliation_tick_v1()
returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare intake_result jsonb; application_result jsonb;
begin
  intake_result:=portal_private.reconcile_client_intake_v1(500,interval '5 minutes');
  application_result:=portal_private.reconcile_client_applications_v2(500);
  return jsonb_build_object('intake',intake_result,'applications',application_result);
end $$;

create function portal_private.guard_application_registry_identity_v2()
returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $$
begin
  if tg_op='DELETE' then raise exception 'APPLICATION_REGISTRY_IS_PERMANENT'; end if;
  if (to_jsonb(old)-'retired_at') is distinct from (to_jsonb(new)-'retired_at')
    or old.retired_at is not null
    or new.retired_at is null
    or not exists(select 1 from portal_private.client_application_tombstones_v2 where application_key=old.application_key)
    then raise exception 'APPLICATION_REGISTRY_IDENTITY_IMMUTABLE'; end if;
  return new;
end $$;
create trigger application_registry_identity_v2 before update or delete
on portal_private.client_application_registry_v2 for each row
execute function portal_private.guard_application_registry_identity_v2();

revoke all on function portal_private.ensure_client_intake_from_application_v1(text),
  portal_private.application_business_row_v2(uuid),portal_private.application_business_projection_v2(text,text,text),
  portal_private.client_intake_reconciliation_tick_v1(),portal_private.guard_application_registry_identity_v2()
from public,anon,authenticated;
