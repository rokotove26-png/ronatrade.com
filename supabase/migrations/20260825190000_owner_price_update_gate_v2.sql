-- RONA Trade Admin Prices: owner-approved update workflow v2.
-- Direction is strictly OPERATIONS_DIRECTOR -> Admin LK. Admin LK never creates a price-change task for Operations.
-- Runs after owner_price_update_gate_v1 and preserves immutable/current-only governance.

alter table portal_private.owner_price_change_proposals add column if not exists rejected_at timestamptz;
alter table portal_private.owner_price_change_proposals add column if not exists rejected_by uuid references portal_private.portal_users(id) on delete restrict;
alter table portal_private.owner_price_change_proposals add column if not exists rejection_reason text;

create or replace function portal_private.price_change_field_label_v1(p_field text)
returns text language sql immutable set search_path to pg_catalog
as $$ select case p_field
 when 'product' then 'Товар'
 when 'producer' then 'Производитель'
 when 'supplier' then 'Поставщик'
 when 'purchase_price' then 'Покупная цена'
 when 'rail_tariff' then 'ЖД тариф'
 when 'rail_segments' then 'ЖД маршрут / тарифные сегменты'
 when 'basis' then 'Базис поставки'
 when 'border_crossing' then 'Погранпереход'
 when 'final_station' then 'Станция / направление'
 when 'landed_cost' then 'Себестоимость на конечной станции'
 when 'rona_margin' then 'Маржа RONA'
 when 'sale_price' then 'Цена реализации'
 when 'currency' then 'Валюта'
 when 'payment_terms' then 'Условия оплаты'
 when 'commercial_terms' then 'Коммерческие условия'
 else p_field end $$;

create or replace function portal_private.price_change_old_value_v1(p_row portal_private.owner_price_snapshots,p_field text)
returns jsonb language plpgsql stable set search_path to pg_catalog,portal_private
as $$ begin
 case p_field
  when 'product' then return to_jsonb(p_row.product);
  when 'producer' then return to_jsonb(p_row.producer);
  when 'supplier' then return to_jsonb(p_row.supplier);
  when 'purchase_price' then return to_jsonb(p_row.purchase_price);
  when 'rail_tariff' then return to_jsonb(p_row.rail_tariff);
  when 'rail_segments' then return p_row.rail_segments;
  when 'basis' then return to_jsonb(p_row.basis);
  when 'border_crossing' then return to_jsonb(p_row.border_crossing);
  when 'final_station' then return to_jsonb(p_row.final_station);
  when 'landed_cost' then return to_jsonb(p_row.landed_cost);
  when 'rona_margin' then return to_jsonb(p_row.rona_margin);
  when 'sale_price' then return to_jsonb(p_row.sale_price);
  when 'currency' then return to_jsonb(btrim(p_row.currency));
  when 'payment_terms' then return to_jsonb(p_row.payment_terms);
  when 'commercial_terms' then return to_jsonb(p_row.commercial_terms);
  else return null;
 end case;
end $$;

create or replace function portal_private.materialize_operations_price_proposal_v1()
returns trigger language plpgsql security definer set search_path to pg_catalog,public,portal_private
as $$
declare
 v_state jsonb; v_raw_changes jsonb; v_normalized jsonb:='[]'::jsonb; v_change jsonb;
 v_field text; v_product text; v_station text; v_base_id text; v_base_key uuid; v_count integer;
 v_snapshot portal_private.owner_price_snapshots%rowtype; v_error text; v_source_refs jsonb;
begin
 if new.record_type<>'BUSINESS_CHANGE_PROPOSAL'
    or new.functional_role::text<>'OPERATIONS_DIRECTOR'
    or coalesce(new.identity_id,'')<>'AI-OPERATIONS-DIRECTOR'
    or coalesce(new.payload->>'proposed_action','')<>'PROPOSE_PRICE_LIST_UPDATE'
    or coalesce(new.target_type,'') not in ('PRICE_LIST','PRICE','PUBLICATION') then return new; end if;
 v_state:=coalesce(new.payload->'proposed_state','{}'::jsonb);
 v_base_id:=nullif(btrim(v_state->>'base_publication_id'),'');
 v_raw_changes:=coalesce(v_state->'changes','[]'::jsonb);
 v_source_refs:=case when jsonb_typeof(new.payload->'evidence_refs')='array' then new.payload->'evidence_refs' when jsonb_typeof(new.source_refs)='array' then new.source_refs else '[]'::jsonb end;
 if v_base_id is null then v_error:='BASE_PUBLICATION_ID_REQUIRED';v_base_id:='UNKNOWN';
 elsif jsonb_typeof(v_raw_changes)<>'array' or jsonb_array_length(v_raw_changes)=0 then v_error:='PRICE_CHANGES_REQUIRED';
 else
  select p.id into v_base_key from portal_private.publications p where p.publication_id=v_base_id and p.publication_type::text='PRICE' and p.status::text='PUBLISHED' and p.authority_state::text='CONFIRMED' and p.lifecycle_state::text='ACTIVE' limit 1;
  if v_base_key is null then v_error:='BASE_PRICE_PUBLICATION_NOT_CURRENT'; end if;
 end if;
 if v_error is null then
  for v_change in select value from jsonb_array_elements(v_raw_changes) loop
   v_field:=nullif(btrim(v_change->>'field'),'');
   v_product:=coalesce(nullif(btrim(v_change->>'product'),''),nullif(btrim(v_change#>>'{selector,product}'),''));
   v_station:=coalesce(nullif(btrim(v_change->>'final_station'),''),nullif(btrim(v_change#>>'{selector,final_station}'),''),nullif(btrim(v_change#>>'{selector,basis}'),''));
   if v_field is null or v_field not in ('product','producer','supplier','purchase_price','rail_tariff','rail_segments','basis','border_crossing','final_station','landed_cost','rona_margin','sale_price','currency','payment_terms','commercial_terms') then v_error:='PRICE_CHANGE_FIELD_NOT_ALLOWED';exit;end if;
   if not(v_change?'new_value') then v_error:='PRICE_CHANGE_NEW_VALUE_REQUIRED';exit;end if;
   if v_product is null then v_error:='PRICE_CHANGE_PRODUCT_SELECTOR_REQUIRED';exit;end if;
   select count(*) into v_count from portal_private.owner_price_snapshots s where s.source_reference=v_base_id and s.business_status<>'SUPERSEDED' and s.product=v_product and (v_station is null or s.final_station=v_station or s.basis=v_station or s.border_crossing=v_station);
   if v_count<>1 then v_error:=case when v_count=0 then 'PRICE_CHANGE_TARGET_NOT_FOUND' else 'PRICE_CHANGE_TARGET_AMBIGUOUS' end;exit;end if;
   select s.* into v_snapshot from portal_private.owner_price_snapshots s where s.source_reference=v_base_id and s.business_status<>'SUPERSEDED' and s.product=v_product and (v_station is null or s.final_station=v_station or s.basis=v_station or s.border_crossing=v_station) limit 1;
   v_normalized:=v_normalized||jsonb_build_array(jsonb_build_object('snapshot_id',v_snapshot.id,'product',v_snapshot.product,'final_station',v_snapshot.final_station,'basis',v_snapshot.basis,'field',v_field,'field_label',portal_private.price_change_field_label_v1(v_field),'old_value',portal_private.price_change_old_value_v1(v_snapshot,v_field),'new_value',v_change->'new_value','external_projection',v_field in ('product','basis','final_station','sale_price','currency','payment_terms','commercial_terms')));
  end loop;
 end if;
 insert into portal_private.owner_price_change_proposals(coordination_record_id,base_publication_key,base_publication_id,proposal_status,reason,changes,source_refs,internal_context,received_from_role,received_from_identity,received_at)
 values(new.record_id,v_base_key,v_base_id,case when v_error is null then 'UPDATE_AVAILABLE' else 'BLOCKED' end,coalesce(nullif(btrim(new.payload->>'reason'),''),'Изменение коммерческих данных от Операционного директора'),case when jsonb_array_length(v_normalized)>0 then v_normalized else v_raw_changes end,v_source_refs,jsonb_build_object('materializer','operations-price-proposal-v2','error',v_error,'raw_target_type',new.target_type,'raw_target_id',new.target_id),'OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',coalesce(new.created_at,now()))
 on conflict(coordination_record_id) do nothing;
 return new;
exception when others then
 begin
  insert into portal_private.owner_price_change_proposals(coordination_record_id,base_publication_key,base_publication_id,proposal_status,reason,changes,source_refs,internal_context,received_from_role,received_from_identity,received_at)
  values(new.record_id,null,coalesce(v_base_id,'UNKNOWN'),'BLOCKED',coalesce(nullif(btrim(new.payload->>'reason'),''),'Изменение коммерческих данных от Операционного директора'),case when jsonb_typeof(v_raw_changes)='array' then v_raw_changes else '[]'::jsonb end,coalesce(v_source_refs,'[]'::jsonb),jsonb_build_object('materializer','operations-price-proposal-v2','error','MATERIALIZATION_ERROR','detail',sqlerrm),'OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',coalesce(new.created_at,now())) on conflict(coordination_record_id) do nothing;
 exception when others then null; end;
 return new;
end $$;

drop trigger if exists trg_ai_coordination_price_proposal_v1 on portal_private.ai_coordination_records;
create trigger trg_ai_coordination_price_proposal_v1 after insert on portal_private.ai_coordination_records for each row execute function portal_private.materialize_operations_price_proposal_v1();

create or replace function public.owner_price_updates_bootstrap()
returns jsonb language plpgsql security definer set search_path to pg_catalog,public,portal_private,auth
as $$
declare v_actor uuid;v_current text;v_rows jsonb;v_history jsonb;v_cp jsonb;v_client boolean:=false;v_agent boolean:=false;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');
 select s.source_reference,coalesce(bool_or(s.publish_client),false),coalesce(bool_or(s.publish_agent),false) into v_current,v_client,v_agent
 from portal_private.owner_price_snapshots s where s.business_status<>'SUPERSEDED'
 group by s.source_reference order by max(s.agreed_at) desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('proposalId',p.id,'coordinationRecordId',p.coordination_record_id,'basePublicationId',p.base_publication_id,'status',p.proposal_status,'reason',p.reason,'changes',p.changes,'sourceRefs',p.source_refs,'receivedFromRole',p.received_from_role,'receivedFromIdentity',p.received_from_identity,'receivedAt',p.received_at,'blocker',nullif(p.internal_context->>'error',''),'newPublicationId',np.publication_id,'appliedAt',p.applied_at,'rejectedAt',p.rejected_at,'rejectionReason',p.rejection_reason) order by p.received_at desc),'[]'::jsonb)
 into v_rows from portal_private.owner_price_change_proposals p left join portal_private.publications np on np.id=p.new_publication_key where p.proposal_status in ('UPDATE_AVAILABLE','BLOCKED');
 select coalesce(jsonb_agg(jsonb_build_object('proposalId',p.id,'basePublicationId',p.base_publication_id,'status',p.proposal_status,'reason',p.reason,'receivedAt',p.received_at,'appliedAt',p.applied_at,'rejectedAt',p.rejected_at,'rejectionReason',p.rejection_reason,'newPublicationId',np.publication_id) order by coalesce(p.applied_at,p.rejected_at,p.updated_at) desc),'[]'::jsonb)
 into v_history from (select * from portal_private.owner_price_change_proposals where proposal_status in ('APPLIED','REJECTED','SUPERSEDED') order by updated_at desc limit 20) p left join portal_private.publications np on np.id=p.new_publication_key;
 select coalesce(jsonb_agg(jsonb_build_object('cpId',c.cp_id,'status',c.status,'version',c.version,'publicationId',p.publication_id,'agentId',a.agent_legal_entity_id,'agentName',a.legal_name,'documentId',d.document_id,'fileName',d.file_name,'sha256',d.sha256,'generatedAt',c.generated_at,'ownerReviewedAt',c.owner_reviewed_at,'sentAt',c.sent_at) order by c.updated_at desc),'[]'::jsonb)
 into v_cp from portal_private.owner_agent_commercial_proposals c join portal_private.publications p on p.id=c.publication_key join portal_private.agent_legal_entities a on a.id=c.agent_legal_entity_key left join portal_private.documents d on d.id=c.document_key where c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;
 return jsonb_build_object('generatedAt',now(),'currentPublicationId',v_current,'clientEnabled',v_client,'agentEnabled',v_agent,'updateAvailableCount',(select count(*) from portal_private.owner_price_change_proposals where proposal_status='UPDATE_AVAILABLE'),'proposals',v_rows,'history',v_history,'agentCommercialProposals',v_cp);
end $$;

create or replace function public.owner_reject_price_change_proposal(p_proposal_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path to pg_catalog,public,portal_private,auth
as $$
declare v_actor uuid;v_prop portal_private.owner_price_change_proposals%rowtype;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');
 select * into v_prop from portal_private.owner_price_change_proposals where id=p_proposal_id for update;
 if not found then raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_NOT_FOUND'; end if;
 if v_prop.proposal_status<>'UPDATE_AVAILABLE' then raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_NOT_REJECTABLE'; end if;
 update portal_private.owner_price_change_proposals set proposal_status='REJECTED',rejected_at=now(),rejected_by=v_actor,rejection_reason=nullif(btrim(p_reason),''),updated_at=now() where id=p_proposal_id;
 insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,'ADMIN','OWNER_PRICE_UPDATE_REJECTED','PRICE_CHANGE_PROPOSAL',p_proposal_id::text,jsonb_build_object('base_publication_id',v_prop.base_publication_id,'coordination_record_id',v_prop.coordination_record_id,'reason',nullif(btrim(p_reason),'')));
 return jsonb_build_object('proposalId',p_proposal_id,'status','REJECTED','basePublicationId',v_prop.base_publication_id);
end $$;

create or replace function public.owner_set_price_publication_audience(p_client boolean,p_agent boolean)
returns jsonb language plpgsql security definer set search_path to pg_catalog,public,portal_private,auth
as $$
declare v_actor uuid;v_pub portal_private.publications%rowtype;v_count integer:=0;v_a portal_private.agent_legal_entities%rowtype;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');
 select p.* into v_pub from portal_private.publications p where p.publication_type::text='PRICE' and p.status::text='PUBLISHED' and p.authority_state::text='CONFIRMED' and p.lifecycle_state::text='ACTIVE' order by p.published_at desc nulls last,p.created_at desc limit 1 for update;
 if not found then raise exception using errcode='P0001',message='CURRENT_PRICE_PUBLICATION_NOT_FOUND'; end if;
 update portal_private.owner_price_snapshots set publish_client=coalesce(p_client,false),publish_agent=coalesce(p_agent,false),business_status=case when coalesce(p_client,false) or coalesce(p_agent,false) then 'PUBLISHED' else 'AGREED' end,published_at=case when coalesce(p_client,false) or coalesce(p_agent,false) then now() else null end,published_by=case when coalesce(p_client,false) or coalesce(p_agent,false) then v_actor else null end,client_published_at=case when coalesce(p_client,false) then now() else null end,agent_published_at=case when coalesce(p_agent,false) then now() else null end,updated_at=now() where source_reference=v_pub.publication_id and business_status<>'SUPERSEDED';
 get diagnostics v_count=row_count;
 update portal_private.publication_items set distribution_allowed=coalesce(p_client,false),updated_at=now() where publication_key=v_pub.id and item_type::text='PRICE' and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;
 update portal_private.owner_price_list_controls set internal_state='CURRENT',client_enabled=coalesce(p_client,false),agent_enabled=coalesce(p_agent,false),client_published_at=case when coalesce(p_client,false) then now() else null end,agent_published_at=case when coalesce(p_agent,false) then now() else null end,published_by=v_actor,authority_state='CONFIRMED',lifecycle_state='ACTIVE',updated_at=now() where publication_key=v_pub.id;
 if coalesce(p_agent,false) then
  for v_a in select * from portal_private.agent_legal_entities where lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum) loop
   insert into portal_private.owner_agent_commercial_proposals(cp_id,publication_key,agent_legal_entity_key,version,status,source_refs,authority_state,lifecycle_state)
   values('CP-'||substr(replace(v_pub.id::text,'-',''),1,12)||'-'||v_a.agent_legal_entity_id,v_pub.id,v_a.id,1,'REQUESTED',jsonb_build_array(v_pub.publication_id,'RONA-AGENT-CP-2026-001'),'SOURCE_RECEIVED','ACTIVE')
   on conflict(publication_key,agent_legal_entity_key,version) do nothing;
  end loop;
 end if;
 insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,'ADMIN','OWNER_PRICE_PUBLICATION_AUDIENCE_SET','PRICE_LIST',v_pub.publication_id,jsonb_build_object('client_enabled',coalesce(p_client,false),'agent_enabled',coalesce(p_agent,false),'snapshot_count',v_count));
 return jsonb_build_object('publicationId',v_pub.publication_id,'clientEnabled',coalesce(p_client,false),'agentEnabled',coalesce(p_agent,false),'snapshotCount',v_count);
end $$;

create or replace function public.owner_apply_price_change_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path to pg_catalog,public,portal_private,auth
as $$
declare
 v_actor uuid;v_prop portal_private.owner_price_change_proposals%rowtype;v_base portal_private.publications%rowtype;v_current_source text;
 v_new_publication_key uuid;v_new_publication_id text;v_root text;v_revision integer;v_title_root text;
 v_s portal_private.owner_price_snapshots%rowtype;v_item portal_private.publication_items%rowtype;v_change jsonb;
 v_product text;v_producer text;v_supplier text;v_basis text;v_border text;v_station text;v_currency text;v_payment text;v_commercial text;
 v_purchase numeric;v_rail numeric;v_segments jsonb;v_landed numeric;v_margin numeric;v_sale numeric;v_new_item uuid;v_item_basis text;
 v_changed integer:=0;v_snapshots integer:=0;v_client boolean:=false;v_agent boolean:=false;v_stale_cp integer:=0;v_a portal_private.agent_legal_entities%rowtype;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');
 select * into v_prop from portal_private.owner_price_change_proposals where id=p_proposal_id for update;
 if not found then raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_NOT_FOUND'; end if;
 if v_prop.proposal_status<>'UPDATE_AVAILABLE' then raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_NOT_APPLICABLE'; end if;
 if v_prop.base_publication_key is null then raise exception using errcode='P0001',message='PRICE_UPDATE_BASE_BLOCKED'; end if;
 select * into v_base from portal_private.publications where id=v_prop.base_publication_key for update;
 if not found or v_base.status::text<>'PUBLISHED' or v_base.lifecycle_state::text<>'ACTIVE' or v_base.authority_state::text<>'CONFIRMED' then raise exception using errcode='P0001',message='PRICE_UPDATE_BASE_STALE'; end if;
 select p.publication_id into v_current_source from portal_private.publications p where p.publication_type::text='PRICE' and p.status::text='PUBLISHED' and p.authority_state::text='CONFIRMED' and p.lifecycle_state::text='ACTIVE' order by p.published_at desc nulls last,p.created_at desc limit 1;
 if coalesce(v_current_source,'')<>v_prop.base_publication_id then raise exception using errcode='P0001',message='PRICE_UPDATE_BASE_STALE'; end if;
 v_root:=regexp_replace(v_prop.base_publication_id,'-R[0-9]+$','');
 select coalesce(max((regexp_match(p.publication_id,'-R([0-9]+)$'))[1]::integer),1)+1 into v_revision from portal_private.publications p where p.publication_type::text='PRICE' and p.publication_id like v_root||'-R%';
 v_new_publication_id:=v_root||'-R'||v_revision::text;
 if exists(select 1 from portal_private.publications where publication_id=v_new_publication_id) then raise exception using errcode='P0001',message='PRICE_UPDATE_REVISION_COLLISION'; end if;
 v_title_root:=regexp_replace(v_base.title,'\s+—\s+РЕДАКЦИЯ\s+[0-9]+\s*$','','i');
 insert into portal_private.publications(publication_id,publication_type,title,status,audience,prepared_at,prepared_by,approved_at,approved_by,published_at,published_by,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
 values(v_new_publication_id,v_base.publication_type,v_title_root||' — РЕДАКЦИЯ '||v_revision::text,'PUBLISHED',v_base.audience,now(),v_actor,now(),v_actor,now(),v_actor,'OWNER_PRICE_UPDATE_GATE','PRICE_PROPOSAL:'||v_prop.coordination_record_id::text,now(),'CONFIRMED','ACTIVE') returning id into v_new_publication_key;
 for v_s in select s.* from portal_private.owner_price_snapshots s where s.source_reference=v_prop.base_publication_id and s.business_status<>'SUPERSEDED' order by s.product,s.final_station,s.id loop
  v_snapshots:=v_snapshots+1;v_product:=v_s.product;v_producer:=v_s.producer;v_supplier:=v_s.supplier;v_purchase:=v_s.purchase_price;v_rail:=v_s.rail_tariff;v_segments:=v_s.rail_segments;v_basis:=v_s.basis;v_border:=v_s.border_crossing;v_station:=v_s.final_station;v_landed:=v_s.landed_cost;v_margin:=v_s.rona_margin;v_sale:=v_s.sale_price;v_currency:=btrim(v_s.currency);v_payment:=v_s.payment_terms;v_commercial:=v_s.commercial_terms;
  for v_change in select value from jsonb_array_elements(v_prop.changes) where value->>'snapshot_id'=v_s.id::text loop
   case v_change->>'field'
    when 'product' then v_product:=v_change->>'new_value'; when 'producer' then v_producer:=v_change->>'new_value'; when 'supplier' then v_supplier:=v_change->>'new_value';
    when 'purchase_price' then v_purchase:=(v_change->>'new_value')::numeric; when 'rail_tariff' then v_rail:=(v_change->>'new_value')::numeric; when 'rail_segments' then v_segments:=v_change->'new_value';
    when 'basis' then v_basis:=v_change->>'new_value'; when 'border_crossing' then v_border:=v_change->>'new_value'; when 'final_station' then v_station:=v_change->>'new_value';
    when 'landed_cost' then v_landed:=(v_change->>'new_value')::numeric; when 'rona_margin' then v_margin:=(v_change->>'new_value')::numeric; when 'sale_price' then v_sale:=(v_change->>'new_value')::numeric;
    when 'currency' then v_currency:=upper(v_change->>'new_value'); when 'payment_terms' then v_payment:=v_change->>'new_value'; when 'commercial_terms' then v_commercial:=v_change->>'new_value';
    else raise exception using errcode='P0001',message='PRICE_UPDATE_FIELD_NOT_ALLOWED'; end case;v_changed:=v_changed+1;
  end loop;
  if coalesce(btrim(v_product),'')='' or v_sale is null or v_sale<=0 or v_currency!~'^[A-Z]{3}$' or coalesce(btrim(v_payment),'')='' then raise exception using errcode='P0001',message='PRICE_UPDATE_VALUE_INVALID'; end if;
  select pi.* into v_item from portal_private.publication_items pi where pi.id=v_s.source_publication_item_key;
  if not found or v_item.item_type::text<>'PRICE' then raise exception using errcode='P0001',message='PRICE_UPDATE_SOURCE_ITEM_MISSING'; end if;
  v_item_basis:=case when coalesce(btrim(v_basis),'')<>'' and coalesce(btrim(v_station),'')<>'' then btrim(v_basis)||' '||btrim(v_station) else coalesce(nullif(btrim(v_item.basis),''),nullif(btrim(v_basis),''),nullif(btrim(v_station),'')) end;
  insert into portal_private.publication_items(publication_key,item_type,item_order,product,basis,currency,price,delivery_period_from,delivery_period_to,payment_terms,valid_from,valid_to,audience,distribution_allowed,headline,content_text,client_active_from,client_active_until,analytics_as_of,analytics_period_from,analytics_period_to,forecast_scenario,actual_value,forecast_value,analytics_unit,metadata,source_system,source_version,source_timestamp,authority_state,lifecycle_state,source_item_subtype,source_visibility_state)
  values(v_new_publication_key,v_item.item_type,v_item.item_order,v_product,v_item_basis,v_currency,v_sale,v_item.delivery_period_from,v_item.delivery_period_to,v_payment,v_item.valid_from,v_item.valid_to,v_item.audience,v_s.publish_client,v_item.headline,case when exists(select 1 from jsonb_array_elements(v_prop.changes) z where z->>'snapshot_id'=v_s.id::text and z->>'field'='commercial_terms') then v_commercial else v_item.content_text end,v_item.client_active_from,v_item.client_active_until,v_item.analytics_as_of,v_item.analytics_period_from,v_item.analytics_period_to,v_item.forecast_scenario,v_item.actual_value,v_item.forecast_value,v_item.analytics_unit,coalesce(v_item.metadata,'{}'::jsonb)||jsonb_build_object('price_update_proposal_id',v_prop.id,'supersedes_item_id',v_item.id),'OWNER_PRICE_UPDATE_GATE','PRICE_PROPOSAL:'||v_prop.coordination_record_id::text,now(),'CONFIRMED','ACTIVE',v_item.source_item_subtype,v_item.source_visibility_state) returning id into v_new_item;
  insert into portal_private.owner_price_snapshots(source_publication_item_key,product,producer,supplier,purchase_price,rail_tariff,rail_segments,basis,border_crossing,final_station,landed_cost,rona_margin,sale_price,currency,payment_terms,commercial_terms,source_reference,business_status,agreed_at,published_at,published_by,source_system,publish_client,publish_agent,client_published_at,agent_published_at)
  values(v_new_item,v_product,v_producer,v_supplier,v_purchase,v_rail,coalesce(v_segments,'[]'::jsonb),v_basis,v_border,v_station,v_landed,v_margin,v_sale,v_currency,v_payment,v_commercial,v_new_publication_id,case when v_s.publish_client or v_s.publish_agent then 'PUBLISHED' else 'AGREED' end,now(),case when v_s.publish_client or v_s.publish_agent then now() else null end,case when v_s.publish_client or v_s.publish_agent then v_actor else null end,'OWNER_PRICE_UPDATE_GATE',v_s.publish_client,v_s.publish_agent,case when v_s.publish_client then now() else null end,case when v_s.publish_agent then now() else null end);
  v_client:=v_client or v_s.publish_client;v_agent:=v_agent or v_s.publish_agent;
 end loop;
 if v_snapshots=0 or v_changed=0 then raise exception using errcode='P0001',message='PRICE_UPDATE_EMPTY'; end if;
 update portal_private.publication_items set distribution_allowed=false,lifecycle_state='SUPERSEDED',updated_at=now() where publication_key=v_prop.base_publication_key and item_type::text='PRICE';
 update portal_private.owner_price_snapshots set business_status='SUPERSEDED',publish_client=false,publish_agent=false,updated_at=now() where source_reference=v_prop.base_publication_id and business_status<>'SUPERSEDED';
 update portal_private.publications set status='SUPERSEDED',superseded_at=now(),superseded_by_publication=v_new_publication_key,lifecycle_state='SUPERSEDED',updated_at=now() where id=v_prop.base_publication_key;
 update portal_private.owner_price_list_controls set internal_state='RETIRED',client_enabled=false,agent_enabled=false,lifecycle_state='SUPERSEDED',updated_at=now() where publication_key=v_prop.base_publication_key;
 update portal_private.owner_price_list_controls set internal_state='CURRENT',client_enabled=v_client,agent_enabled=v_agent,client_published_at=case when v_client then now() else null end,agent_published_at=case when v_agent then now() else null end,published_by=v_actor,authority_state='CONFIRMED',lifecycle_state='ACTIVE',updated_at=now() where publication_key=v_new_publication_key;
 update portal_private.owner_agent_commercial_proposals set status='STALE_PRICE_SOURCE',updated_at=now() where publication_key=v_prop.base_publication_key and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and status not in ('RETIRED','STALE_PRICE_SOURCE');
 get diagnostics v_stale_cp=row_count;
 if v_agent then
  for v_a in select * from portal_private.agent_legal_entities where lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum) loop
   insert into portal_private.owner_agent_commercial_proposals(cp_id,publication_key,agent_legal_entity_key,version,status,source_refs,authority_state,lifecycle_state)
   values('CP-'||substr(replace(v_new_publication_key::text,'-',''),1,12)||'-'||v_a.agent_legal_entity_id,v_new_publication_key,v_a.id,1,'REQUESTED',jsonb_build_array(v_new_publication_id,'RONA-AGENT-CP-2026-001',v_prop.coordination_record_id::text),'SOURCE_RECEIVED','ACTIVE') on conflict(publication_key,agent_legal_entity_key,version) do nothing;
  end loop;
 end if;
 update portal_private.owner_price_change_proposals set proposal_status='APPLIED',applied_at=now(),applied_by=v_actor,new_publication_key=v_new_publication_key,updated_at=now() where id=v_prop.id;
 update portal_private.owner_price_change_proposals set proposal_status='SUPERSEDED',updated_at=now() where id<>v_prop.id and proposal_status='UPDATE_AVAILABLE' and base_publication_id=v_prop.base_publication_id;
 insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,'ADMIN','OWNER_PRICE_UPDATE_APPLIED','PRICE_LIST',v_new_publication_id,jsonb_build_object('proposal_id',v_prop.id,'coordination_record_id',v_prop.coordination_record_id,'base_publication_id',v_prop.base_publication_id,'new_publication_id',v_new_publication_id,'change_count',v_changed,'client_propagated',v_client,'agent_propagated',v_agent,'stale_agent_cp_count',v_stale_cp));
 return jsonb_build_object('proposalId',v_prop.id,'basePublicationId',v_prop.base_publication_id,'newPublicationId',v_new_publication_id,'changeCount',v_changed,'clientPropagated',v_client,'agentPropagated',v_agent,'staleAgentCpCount',v_stale_cp);
end $$;

-- Reconcile the current list control with actual current snapshot flags.
update portal_private.owner_price_list_controls c set
 internal_state='CURRENT',
 client_enabled=x.client_enabled,
 agent_enabled=x.agent_enabled,
 client_published_at=case when x.client_enabled then coalesce(c.client_published_at,now()) else null end,
 agent_published_at=case when x.agent_enabled then coalesce(c.agent_published_at,now()) else null end,
 authority_state='CONFIRMED',lifecycle_state='ACTIVE',updated_at=now()
from (
 select p.id publication_key,coalesce(bool_or(s.publish_client),false) client_enabled,coalesce(bool_or(s.publish_agent),false) agent_enabled
 from portal_private.publications p join portal_private.owner_price_snapshots s on s.source_reference=p.publication_id and s.business_status<>'SUPERSEDED'
 where p.publication_type::text='PRICE' and p.status::text='PUBLISHED' and p.lifecycle_state::text='ACTIVE' and p.authority_state::text='CONFIRMED'
 group by p.id
) x where c.publication_key=x.publication_key;

revoke all on function public.owner_price_updates_bootstrap() from public;
revoke all on function public.owner_apply_price_change_proposal(uuid) from public;
revoke all on function public.owner_reject_price_change_proposal(uuid,text) from public;
revoke all on function public.owner_set_price_publication_audience(boolean,boolean) from public;
grant execute on function public.owner_price_updates_bootstrap() to authenticated;
grant execute on function public.owner_apply_price_change_proposal(uuid) to authenticated;
grant execute on function public.owner_reject_price_change_proposal(uuid,text) to authenticated;
grant execute on function public.owner_set_price_publication_audience(boolean,boolean) to authenticated;
