-- PR548 R1/R7/R8: one scoped business collection for Client, Admin, passport and KPI.
create function portal_private.application_business_kpi_v2(p_rows jsonb)
returns jsonb language sql immutable set search_path='pg_catalog' as $$
 select jsonb_build_object('source','RONA_APPLICATION_BUSINESS_V2',
  'total',jsonb_array_length(p_rows),'retention_blockers',0,
  'tonnage',coalesce(sum((v->>'quantity_tonnes')::numeric),0),
  'new',count(*) filter(where v->>'business_bucket'='NEW'),
  'active',count(*) filter(where v->>'business_bucket'<>'COMPLETED'),
  'in_work',count(*) filter(where v->>'business_bucket'='WORK'),
  'decision',count(*) filter(where v->>'business_bucket'='DECISION'),
  'completed',count(*) filter(where v->>'business_bucket'='COMPLETED'),
  'deal_registered',count(*) filter(where v->>'deal_id' is not null),
  'missing_agreed_price',count(*) filter(where coalesce((v->>'price_is_agreed')::boolean,false)=false),
  'amounts',case when count(*) filter(where coalesce((v->>'price_is_agreed')::boolean,false)=false)=0
    then (select coalesce(jsonb_agg(to_jsonb(a) order by a.currency),'[]'::jsonb) from (
     select x->>'agreed_currency' currency,sum((x->>'quantity_tonnes')::numeric*(x->>'agreed_price')::numeric) amount
     from jsonb_array_elements(p_rows) x group by x->>'agreed_currency') a) end,
  'state',case when count(*) filter(where coalesce((v->>'price_is_agreed')::boolean,false)=false)>0
    then 'PRICE_AGREEMENT_PENDING' else 'READY' end)
 from jsonb_array_elements(p_rows) v
$$;
alter function portal_private.application_business_row_v2(uuid) rename to application_business_row_review_base_v2;
create function portal_private.application_business_row_v2(p_application_key uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare row jsonb; source_form jsonb; a portal_private.client_applications;
begin
 row:=portal_private.application_business_row_review_base_v2(p_application_key);
 if row is null then raise exception 'CANONICAL_APPLICATION_NOT_FOUND'; end if;
 select * into a from portal_private.client_applications where id=p_application_key;
 select portal_private.client_intake_effective_payload_v1(i.intake_id) into source_form
  from portal_private.client_intake_v1 i where i.application_key=a.id
  order by case when i.actionable_type like 'APPLICATION_DETAILS_%' then 0 else 1 end,
    i.source_submitted_at desc,i.intake_id limit 1;
 return row||jsonb_build_object('counter_offer_active',coalesce((row->>'counter_offer_used')::boolean,false)
   and row->>'owner_status'='COUNTER_OFFERED' and coalesce(row->>'client_counter_response','') not in ('ACCEPTED','DECLINED'),
   'supplier_approved_at',(select supplier_approved_at from portal_private.owner_application_workflow where application_key=a.id),
   'source_form_payload',source_form,'price_unit','t',
   'intake_id',(select primary_intake_id from portal_private.client_application_registry_v2 where application_key=a.id),
   'durable_id',(select i.durable_id from portal_private.client_intake_v1 i join portal_private.client_application_registry_v2 r on r.primary_intake_id=i.intake_id where r.application_key=a.id),
   'source_id',(select source_record_id from portal_private.client_application_registry_v2 where application_key=a.id));
end $$;
alter function portal_private.application_business_projection_v2(text,text,text)
 rename to application_business_projection_review_base_v2;
create function portal_private.application_business_projection_v2(p_audience text,p_client_id text default null,p_contract_id text default null)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare projection jsonb;
begin
 projection:=portal_private.application_business_projection_review_base_v2(p_audience,p_client_id,p_contract_id);
 if exists(select 1 from jsonb_array_elements(projection->'applications') a where a->>'retention_decision'<>'KEEP')
  then raise exception 'APPLICATION_RETENTION_NOT_CONVERGED'; end if;
 return projection||jsonb_build_object('application_kpi',portal_private.application_business_kpi_v2(projection->'applications'));
end $$;

create function portal_private.application_business_authorized_v2(
 p_auth_user uuid,p_session_id uuid,p_audience text,p_client_id text default null,p_contract_id text default null
) returns jsonb language plpgsql stable security definer set search_path='pg_catalog','portal_private' as $$
declare identity record; ctx record; projection jsonb; rows jsonb;
begin
 select * into identity from portal_private.resolve_portal_auth(p_auth_user,p_session_id) where session_allowed;
 if not found then raise exception 'APPLICATION_SESSION_DENIED'; end if;
 if p_audience='ADMIN' then
  if not ('ADMIN'=any(identity.roles)) then raise exception 'APPLICATION_SCOPE_DENIED'; end if;
 elsif p_audience='CLIENT' then
  if not ('CLIENT'=any(identity.roles)) then raise exception 'APPLICATION_SCOPE_DENIED'; end if;
  select cl.id client_key,ct.id contract_key into ctx from portal_private.clients cl
   join portal_private.contracts ct on ct.client_key=cl.id
   where cl.client_id=p_client_id and ct.contract_id=p_contract_id
     and portal_private.client_user_has_contract_access(identity.portal_user_id,ct.id,now());
  if not found then raise exception 'APPLICATION_SCOPE_DENIED'; end if;
 else raise exception 'APPLICATION_SCOPE_DENIED'; end if;
 projection:=portal_private.application_business_projection_v2(p_audience,p_client_id,p_contract_id);
 if p_audience='CLIENT' then
  select coalesce(jsonb_agg(v order by ordinal),'[]'::jsonb) into rows
    from jsonb_array_elements(projection->'applications') with ordinality r(v,ordinal)
    join portal_private.client_applications a on a.application_id=v->>'application_id'
    where a.linked_deal_key is null or portal_private.client_user_has_deal_access(identity.portal_user_id,a.linked_deal_key,now());
  projection:=projection||jsonb_build_object('applications',rows,'application_kpi',portal_private.application_business_kpi_v2(rows));
 end if;
 return projection;
end $$;
create function public.application_business_client_v2(p_client_id text,p_contract_id text)
returns jsonb language sql stable security definer set search_path='pg_catalog','portal_private' as $$
 select portal_private.application_business_authorized_v2(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid,
  'CLIENT',p_client_id,p_contract_id)
$$;
revoke all on function public.application_business_client_v2(text,text) from public,anon;
grant execute on function public.application_business_client_v2(text,text) to authenticated;

-- Calculation requests use the same transactional guarantee as application+details.
create function portal_private.submit_delivered_application_bundle_v2(
 p_auth_user uuid,p_session_id uuid,p_body jsonb,p_request_id uuid,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare ev record; i portal_private.client_intake_v1; app text; payload jsonb; identity record; k text; cl uuid; ct uuid; fp text; previous portal_private.client_application_bundle_receipts_v2;
begin
 perform portal_private.application_operations_authority_v2();
 payload:=p_body->'payload'; k:=nullif(btrim(p_body->>'idempotency_key'),'');
 if k is null or length(k)>150 or p_body->>'role' is distinct from 'CLIENT'
  or p_body->>'event_type' is distinct from 'CLIENT_MESSAGE_SUBMIT'
  or p_body->>'authority_domain' is distinct from 'PRICE_CALCULATION'
  or p_body->>'authority_target_type' is distinct from 'PUBLICATION_ITEM'
  or payload->>'message_type' is distinct from 'DELIVERED_PRICE_CALCULATION_REQUEST_V1'
  or payload->>'client_id' is distinct from p_body->>'client_id'
  or payload->>'contract_id' is distinct from p_body->>'contract_id'
  or payload#>>'{reference,publication_item_id}' is distinct from p_body->>'authority_target_id'
  or jsonb_typeof(payload->'quantity_tonnes') is distinct from 'number'
  then raise exception 'APPLICATION_DELIVERED_SOURCE_CONFLICT'; end if;
 select * into identity from portal_private.resolve_portal_auth(p_auth_user,p_session_id) where session_allowed;
 if not found or not ('CLIENT'=any(identity.roles)) then raise exception 'APPLICATION_SESSION_DENIED'; end if;
 select c.id,t.id into cl,ct from portal_private.clients c
  join portal_private.contracts t on t.client_key=c.id
  where c.client_id=p_body->>'client_id' and t.contract_id=p_body->>'contract_id'
   and portal_private.client_user_has_contract_access(identity.portal_user_id,t.id,now());
 if cl is null or ct is null then raise exception 'APPLICATION_SCOPE_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('APPLICATION_BUNDLE:'||cl::text||':'||ct::text||':'||k,0));
 fp:=encode(extensions.digest((p_body-'requestId'-'correlationId')::text,'sha256'),'hex');
 select * into previous from portal_private.client_application_bundle_receipts_v2 b
  where b.client_key=cl and b.contract_key=ct and b.idempotency_key=k;
 if found then
  if previous.request_fingerprint<>fp then raise exception 'APPLICATION_IDEMPOTENCY_PAYLOAD_CONFLICT'; end if;
  if not exists(select 1 from portal_private.client_applications where application_id=previous.application_id)
   then raise exception 'APPLICATION_RETIRED_NO_RESUBMISSION'; end if;
  select * into i from portal_private.client_intake_v1 where source_kind='PORTAL_REVERSE_EVENT' and source_record_id=previous.details_event_id;
  if i.intake_id is null then raise exception 'APPLICATION_DURABILITY_OR_ROUTING_MISSING'; end if;
  return jsonb_build_object('application_id',previous.application_id,'event_id',previous.details_event_id,
   'intake_id',i.intake_id,'durable_id',i.durable_id,'source_id',i.source_record_id,
   'submitted_at',i.source_submitted_at,'bundle_complete',true,'business_contract','RONA_APPLICATION_BUSINESS_V2');
 end if;
 -- Only a published item available to this authorized client may start a fresh request.
 if not exists(select 1 from portal_private.publication_items pi
  join portal_private.publications pub on pub.id=pi.publication_key
  where pi.id=(p_body->>'authority_target_id')::uuid and pi.product=payload->>'product'
   and pub.status::text='PUBLISHED' and pi.item_type::text='PRICE' and pi.distribution_allowed
   and pub.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC') and pi.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
   and (pi.valid_from is null or pi.valid_from<=now()) and (pi.valid_to is null or pi.valid_to>=now())
   and ((pub.audience<>'SELECTED_CLIENTS' and pi.audience<>'SELECTED_CLIENTS') or exists(
    select 1 from portal_private.publication_client_targets pt where pt.publication_key=pub.id and pt.client_key=cl
     and (pt.target_scope='PUBLICATION' or (pt.target_scope='ITEM' and pt.publication_item_key=pi.id)))))
  then raise exception 'CLIENT_PRICE_CONTEXT_DENIED'; end if;
 select * into ev from portal_private.server_submit_reverse_event(p_auth_user,p_session_id::text,
  p_body->>'event_type',p_body->>'authority_domain',p_body->>'authority_target_type',p_body->>'authority_target_id',
  p_body->>'client_id',p_body->>'contract_id',null,payload,k,p_request_id,p_correlation_id);
 select * into i from portal_private.client_intake_v1 where source_kind='PORTAL_REVERSE_EVENT' and source_record_id=ev.event_id;
 app:=portal_private.materialize_client_application_v2(i.intake_id);
 perform portal_private.process_client_intake_outbox_v1(100);
 if app is null or not exists(select 1 from portal_private.client_applications where application_id=app)
  then raise exception 'APPLICATION_RETIRED_NO_RESUBMISSION'; end if;
 if not exists(select 1 from portal_private.client_intake_task_links_v1 l join portal_private.staff_tasks t on t.id=l.staff_task_id
  where l.intake_id=i.intake_id and t.assigned_functional_role::text='OPERATIONS_DIRECTOR' and t.qa_only=false)
  then raise exception 'APPLICATION_DURABILITY_OR_ROUTING_MISSING'; end if;
 insert into portal_private.client_application_bundle_receipts_v2(client_key,contract_key,idempotency_key,request_fingerprint,application_id,details_event_id)
  values(cl,ct,k,fp,app,ev.event_id);
 return jsonb_build_object('application_id',app,'event_id',ev.event_id,'intake_id',i.intake_id,'durable_id',i.durable_id,
  'source_id',i.source_record_id,'submitted_at',i.source_submitted_at,'bundle_complete',true,
  'business_contract','RONA_APPLICATION_BUSINESS_V2');
end $$;

revoke all on function portal_private.application_business_kpi_v2(jsonb),
 portal_private.application_business_row_v2(uuid),portal_private.application_business_row_review_base_v2(uuid),
 portal_private.application_business_projection_v2(text,text,text),portal_private.application_business_projection_review_base_v2(text,text,text),
 portal_private.application_business_authorized_v2(uuid,uuid,text,text,text),
 portal_private.submit_delivered_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid)
 from public,anon,authenticated,service_role;

-- Retire the legacy RPC's technical-event UNION too, without breaking its return signature.
create or replace function public.rona_client_application_projection(p_client_id text,p_contract_id text)
returns table(application_id text,product text,quantity_tonnes numeric,delivery_period_from date,
 delivery_period_to date,delivery_basis text,destination text,payment_terms text,application_price numeric,
 application_currency character,status text,resource_status text,resource_label text,resource_source text,
 deal_id text,submitted_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='pg_catalog','portal_private' as $$
 select v->>'application_id',v->>'product',(v->>'quantity_tonnes')::numeric,
 (v->>'delivery_period_from')::date,(v->>'delivery_period_to')::date,v->>'delivery_basis',
 v->>'destination',v->>'payment_terms',(v->>'application_price')::numeric,(v->>'application_currency')::char(3),
 v->>'status',v->>'resource_status',
 case when v->>'resource_status'='RESOURCE_CONFIRMED' then 'Ресурс подтвержден' else 'Ресурс не подтвержден' end,
 v->>'resource_source',v->>'deal_id',(v->>'submitted_at')::timestamptz,(v->>'updated_at')::timestamptz
 from jsonb_array_elements(public.application_business_client_v2(p_client_id,p_contract_id)->'applications') v
$$;

-- Legacy event/standalone application handlers cannot reach a partial write during cutover.
alter function portal_private.submit_delivered_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid)
 rename to submit_delivered_application_bundle_review_base_v2;
create function portal_private.submit_delivered_application_bundle_v2(
 p_auth_user uuid,p_session_id uuid,p_body jsonb,p_request_id uuid,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare previous text; result jsonb;
begin
 perform portal_private.application_operations_authority_v2();
 previous:=current_setting('rona.application_atomic_bundle',true);
 perform set_config('rona.application_atomic_bundle','on',true);
 result:=portal_private.submit_delivered_application_bundle_review_base_v2(p_auth_user,p_session_id,p_body,p_request_id,p_correlation_id);
 perform set_config('rona.application_atomic_bundle',coalesce(previous,''),true);
 return result;
end $$;
revoke all on function portal_private.submit_delivered_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid),
 portal_private.submit_delivered_application_bundle_review_base_v2(uuid,uuid,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
