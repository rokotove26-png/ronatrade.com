-- Admin Prices Operations handoff v2.
-- Accepts the compact successor handoff emitted by Operations Director,
-- materializes it into the Admin approval queue without auto-publication,
-- and supports an explicit Owner/Admin apply that clones the confirmed
-- source price publication into a new successor revision.

create or replace function portal_private.price_publication_source_fingerprint_v1(p_publication_key uuid)
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'portal_private'
as $function$
  select md5(coalesce(string_agg(
    concat_ws('|',
      i.item_order::text,
      coalesce(i.product,''),
      coalesce(i.basis,''),
      coalesce(i.currency,''),
      coalesce(i.price::text,''),
      coalesce(i.delivery_period_from::text,''),
      coalesce(i.delivery_period_to::text,''),
      coalesce(i.payment_terms,''),
      coalesce(i.content_text,''),
      coalesce(s.product,''),
      coalesce(s.final_station,''),
      coalesce(s.sale_price::text,''),
      coalesce(s.currency,''),
      coalesce(s.payment_terms,''),
      coalesce(s.commercial_terms,'')
    ), E'\n' order by i.item_order, s.id
  ),''))
  from portal_private.publication_items i
  left join portal_private.owner_price_snapshots s on s.source_publication_item_key=i.id
  where i.publication_key=p_publication_key
    and i.item_type::text='PRICE';
$function$;

create or replace function portal_private.materialize_operations_price_compact_decision_v2(p_decision_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private'
as $function$
declare
  v_decision portal_private.ai_coordination_records%rowtype;
  v_parent portal_private.ai_coordination_records%rowtype;
  v_source portal_private.publications%rowtype;
  v_current portal_private.publications%rowtype;
  v_action text;
  v_value jsonb;
  v_state jsonb;
  v_changes jsonb:='[]'::jsonb;
  v_source_refs jsonb:='[]'::jsonb;
  v_products jsonb:='[]'::jsonb;
  v_stations jsonb:='[]'::jsonb;
  v_prices jsonb:='{}'::jsonb;
  v_source_id text;
  v_successor_id text;
  v_fingerprint text;
  v_payment text;
  v_commercial text;
  v_currency text;
  v_period_from date;
  v_period_to date;
  v_item_count integer:=0;
  v_snapshot_count integer:=0;
  v_distinct_payment integer:=0;
  v_distinct_currency integer:=0;
  v_error text;
begin
  select * into v_decision
  from portal_private.ai_coordination_records
  where record_id=p_decision_record_id;

  if not found
     or v_decision.record_type<>'OPERATIONS_INTERNAL_DECISION'
     or v_decision.functional_role::text<>'OPERATIONS_DIRECTOR'
     or coalesce(v_decision.identity_id,'')<>'AI-OPERATIONS-DIRECTOR'
     or v_decision.status<>'APPROVE_FOR_NEXT_STAGE'
     or v_decision.parent_record_id is null then
    return jsonb_build_object('status','IGNORED','reason','DECISION_NOT_ELIGIBLE');
  end if;

  select * into v_parent
  from portal_private.ai_coordination_records
  where record_id=v_decision.parent_record_id;

  if not found
     or v_parent.record_type<>'BUSINESS_CHANGE_PROPOSAL'
     or v_parent.functional_role::text<>'OPERATIONS_DIRECTOR'
     or coalesce(v_parent.identity_id,'')<>'AI-OPERATIONS-DIRECTOR'
     or coalesce(v_parent.target_type,'') not in ('PRICE_LIST','PRICE','PUBLICATION') then
    return jsonb_build_object('status','IGNORED','reason','PARENT_NOT_PRICE_PROPOSAL');
  end if;

  if exists(select 1 from portal_private.owner_price_change_proposals p where p.coordination_record_id=v_parent.record_id) then
    return jsonb_build_object('status','EXISTS','coordinationRecordId',v_parent.record_id);
  end if;

  v_action:=coalesce(v_parent.payload->>'proposed_action','');

  -- Existing canonical actions keep their existing materializers.
  if v_action in ('CREATE_SUCCESSOR_REVISION_FOR_APPROVAL','PROPOSE_PRICE_LIST_UPDATE') then
    return jsonb_build_object('status','DELEGATED','action',v_action);
  end if;

  select p.* into v_current
  from portal_private.publications p
  join portal_private.owner_price_list_controls c on c.publication_key=p.id
  where p.publication_type::text='PRICE'
    and p.status::text='PUBLISHED'
    and p.authority_state::text='CONFIRMED'
    and p.lifecycle_state::text='ACTIVE'
    and c.internal_state='CURRENT'
    and c.authority_state::text='CONFIRMED'
    and c.lifecycle_state::text='ACTIVE'
  order by p.published_at desc nulls last,p.created_at desc
  limit 1;

  v_source_refs:=case
    when jsonb_typeof(v_parent.payload->'evidence_refs')='array' then v_parent.payload->'evidence_refs'
    when jsonb_typeof(v_parent.source_refs)='array' then v_parent.source_refs
    else '[]'::jsonb
  end;
  v_source_refs:=v_source_refs
    || jsonb_build_array('COORDINATION:'||v_parent.record_id::text,'OPS_DECISION:'||v_decision.record_id::text);

  if v_action<>'CREATE_SUCCESSOR_FOR_ADMIN_APPROVAL' then
    insert into portal_private.owner_price_change_proposals(
      coordination_record_id,base_publication_key,base_publication_id,proposal_status,reason,changes,source_refs,
      internal_context,received_from_role,received_from_identity,received_at
    ) values(
      v_parent.record_id,v_current.id,coalesce(v_current.publication_id,'UNKNOWN'),'BLOCKED',
      coalesce(nullif(btrim(v_parent.payload->>'reason'),''),'Изменение прайса от Операционного директора'),
      '[]'::jsonb,v_source_refs,
      jsonb_build_object('materializer','operations-price-compact-v2','error','OPERATIONS_PRICE_HANDOFF_ACTION_UNSUPPORTED','raw_action',v_action,'decision_record_id',v_decision.record_id),
      'OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',coalesce(v_decision.created_at,now())
    ) on conflict(coordination_record_id) do nothing;
    return jsonb_build_object('status','BLOCKED','error','OPERATIONS_PRICE_HANDOFF_ACTION_UNSUPPORTED','action',v_action);
  end if;

  v_value:=coalesce(v_parent.payload->'proposed_value','{}'::jsonb);
  v_source_id:=nullif(btrim(coalesce(v_value->>'source_publication_id',v_parent.target_id)), '');
  v_successor_id:=nullif(btrim(v_value->>'successor_publication_id'),'');

  select * into v_source
  from portal_private.publications
  where publication_id=v_source_id
    and publication_type::text='PRICE'
    and authority_state::text='CONFIRMED'
    and status::text in ('PUBLISHED','APPROVED','SUPERSEDED')
  limit 1;

  if v_current.id is null then v_error:='CURRENT_PRICE_PUBLICATION_NOT_FOUND'; end if;
  if v_error is null and v_source.id is null then v_error:='SOURCE_PRICE_PUBLICATION_NOT_FOUND'; end if;
  if v_error is null and v_successor_id is null then v_error:='SUCCESSOR_PUBLICATION_ID_REQUIRED'; end if;
  if v_error is null and lower(coalesce(v_value->>'publish_after_approval_only','false'))<>'true' then v_error:='ADMIN_APPROVAL_GUARD_REQUIRED'; end if;
  if v_error is null and regexp_replace(v_successor_id,'-R[0-9]+$','')<>regexp_replace(v_source.publication_id,'-R[0-9]+$','') then v_error:='SUCCESSOR_SERIES_MISMATCH'; end if;
  if v_error is null and v_successor_id!~'-R[0-9]+$' then v_error:='SUCCESSOR_REVISION_INVALID'; end if;
  if v_error is null and exists(select 1 from portal_private.publications p where p.publication_id=v_successor_id) then v_error:='SUCCESSOR_REVISION_COLLISION'; end if;

  if v_error is null then
    select count(*) into v_item_count
    from portal_private.publication_items i
    where i.publication_key=v_source.id and i.item_type::text='PRICE';

    select count(*) into v_snapshot_count
    from portal_private.owner_price_snapshots s
    join portal_private.publication_items i on i.id=s.source_publication_item_key
    where i.publication_key=v_source.id and i.item_type::text='PRICE';

    if v_item_count=0 or v_item_count<>v_snapshot_count then v_error:='SOURCE_PRICE_ROWS_INCOMPLETE'; end if;
  end if;

  if v_error is null then
    select count(distinct s.payment_terms),min(s.payment_terms),count(distinct s.currency),min(s.currency),min(i.delivery_period_from),max(i.delivery_period_to),min(s.commercial_terms)
    into v_distinct_payment,v_payment,v_distinct_currency,v_currency,v_period_from,v_period_to,v_commercial
    from portal_private.owner_price_snapshots s
    join portal_private.publication_items i on i.id=s.source_publication_item_key
    where i.publication_key=v_source.id and i.item_type::text='PRICE';

    if v_distinct_payment<>1 then v_error:='SOURCE_PAYMENT_TERMS_AMBIGUOUS'; end if;
    if v_error is null and v_distinct_currency<>1 then v_error:='SOURCE_CURRENCY_AMBIGUOUS'; end if;
    if v_error is null and (v_period_from is null or v_period_to is null) then v_error:='SOURCE_DELIVERY_PERIOD_MISSING'; end if;
  end if;

  if v_error is null then
    select coalesce(jsonb_agg(x.product order by x.first_order),'[]'::jsonb)
    into v_products
    from (
      select s.product,min(i.item_order) first_order
      from portal_private.owner_price_snapshots s
      join portal_private.publication_items i on i.id=s.source_publication_item_key
      where i.publication_key=v_source.id and i.item_type::text='PRICE'
      group by s.product
    ) x;

    select coalesce(jsonb_agg(x.station order by x.first_order),'[]'::jsonb)
    into v_stations
    from (
      select coalesce(nullif(btrim(s.final_station),''),regexp_replace(btrim(i.basis),'^CPT\s+','','i')) station,min(i.item_order) first_order
      from portal_private.owner_price_snapshots s
      join portal_private.publication_items i on i.id=s.source_publication_item_key
      where i.publication_key=v_source.id and i.item_type::text='PRICE'
      group by coalesce(nullif(btrim(s.final_station),''),regexp_replace(btrim(i.basis),'^CPT\s+','','i'))
    ) x;

    with src as (
      select s.product,coalesce(nullif(btrim(s.final_station),''),regexp_replace(btrim(i.basis),'^CPT\s+','','i')) station,s.sale_price,i.item_order
      from portal_private.owner_price_snapshots s
      join portal_private.publication_items i on i.id=s.source_publication_item_key
      where i.publication_key=v_source.id and i.item_type::text='PRICE'
    ), products as (
      select product,min(item_order) product_order from src group by product
    ), stations as (
      select station,min(item_order) station_order from src group by station
    ), matrix as (
      select p.product,p.product_order,
             jsonb_agg(coalesce(to_jsonb(src.sale_price),'null'::jsonb) order by st.station_order) prices
      from products p
      cross join stations st
      left join src on src.product=p.product and src.station=st.station
      group by p.product,p.product_order
    )
    select coalesce(jsonb_object_agg(product,prices order by product_order),'{}'::jsonb)
    into v_prices
    from matrix;

    select coalesce(jsonb_agg(jsonb_build_object(
      'field','sale_price',
      'field_label',portal_private.price_change_field_label_v1('sale_price'),
      'product',s.product,
      'final_station',coalesce(nullif(btrim(s.final_station),''),regexp_replace(btrim(i.basis),'^CPT\s+','','i')),
      'old_value',null,
      'new_value',s.sale_price,
      'external_projection',true
    ) order by i.item_order),'[]'::jsonb)
    into v_changes
    from portal_private.owner_price_snapshots s
    join portal_private.publication_items i on i.id=s.source_publication_item_key
    where i.publication_key=v_source.id and i.item_type::text='PRICE';

    v_fingerprint:=portal_private.price_publication_source_fingerprint_v1(v_source.id);
    v_state:=jsonb_build_object(
      'title',coalesce(nullif(btrim(v_value->>'title'),''),v_source.title),
      'audience',v_source.audience,
      'ordered_products',v_products,
      'stations',v_stations,
      'prices',v_prices,
      'currency',v_currency,
      'conditions',jsonb_build_object('payment',v_payment,'commercial_terms',v_commercial),
      'delivery_period_from',v_period_from,
      'delivery_period_to',v_period_to,
      'publication_guard','DO_NOT_PUBLISH_BEFORE_ADMIN_APPROVAL',
      'successor_publication_id',v_successor_id,
      'source_publication_id',v_source.publication_id,
      'source_fingerprint',v_fingerprint,
      'source_sha256',nullif(btrim(v_value->>'source_sha256'),''),
      'source_drive_id',nullif(btrim(v_value->>'source_drive_id'),'')
    );

    v_source_refs:=v_source_refs||jsonb_build_array('SOURCE_PUBLICATION:'||v_source.publication_id);

    insert into portal_private.owner_price_change_proposals(
      coordination_record_id,base_publication_key,base_publication_id,proposal_status,reason,changes,source_refs,
      internal_context,received_from_role,received_from_identity,received_at
    ) values(
      v_parent.record_id,v_current.id,v_current.publication_id,'UPDATE_AVAILABLE',
      coalesce(nullif(btrim(v_parent.payload->>'reason'),''),'Новый прайс-лист от Операционного директора. Требуется решение Администратора; автопубликация запрещена.'),
      v_changes,v_source_refs,
      jsonb_build_object(
        'materializer','operations-price-compact-v2',
        'proposal_mode','FULL_PRICE_LIST_SOURCE_HANDOFF',
        'successor_publication_id',v_successor_id,
        'source_publication_id',v_source.publication_id,
        'source_fingerprint',v_fingerprint,
        'publication_guard','DO_NOT_PUBLISH_BEFORE_ADMIN_APPROVAL',
        'decision_record_id',v_decision.record_id,
        'target_state',v_state,
        'compact_source_payload',v_value
      ),
      'OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',coalesce(v_decision.created_at,now())
    ) on conflict(coordination_record_id) do nothing;

    return jsonb_build_object('status','UPDATE_AVAILABLE','coordinationRecordId',v_parent.record_id,'sourcePublicationId',v_source.publication_id,'successorPublicationId',v_successor_id,'rowCount',jsonb_array_length(v_changes));
  end if;

  insert into portal_private.owner_price_change_proposals(
    coordination_record_id,base_publication_key,base_publication_id,proposal_status,reason,changes,source_refs,
    internal_context,received_from_role,received_from_identity,received_at
  ) values(
    v_parent.record_id,v_current.id,coalesce(v_current.publication_id,'UNKNOWN'),'BLOCKED',
    coalesce(nullif(btrim(v_parent.payload->>'reason'),''),'Новый прайс-лист от Операционного директора'),
    coalesce(v_changes,'[]'::jsonb),v_source_refs,
    jsonb_build_object('materializer','operations-price-compact-v2','error',v_error,'raw_action',v_action,'decision_record_id',v_decision.record_id,'source_publication_id',v_source_id,'successor_publication_id',v_successor_id),
    'OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',coalesce(v_decision.created_at,now())
  ) on conflict(coordination_record_id) do nothing;

  return jsonb_build_object('status','BLOCKED','error',v_error,'coordinationRecordId',v_parent.record_id);
exception when others then
  begin
    if v_parent.record_id is not null then
      insert into portal_private.owner_price_change_proposals(
        coordination_record_id,base_publication_key,base_publication_id,proposal_status,reason,changes,source_refs,
        internal_context,received_from_role,received_from_identity,received_at
      ) values(
        v_parent.record_id,v_current.id,coalesce(v_current.publication_id,'UNKNOWN'),'BLOCKED',
        coalesce(nullif(btrim(v_parent.payload->>'reason'),''),'Изменение прайса от Операционного директора'),
        '[]'::jsonb,coalesce(v_source_refs,'[]'::jsonb),
        jsonb_build_object('materializer','operations-price-compact-v2','error','MATERIALIZATION_ERROR','detail',sqlerrm,'decision_record_id',p_decision_record_id),
        'OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',coalesce(v_decision.created_at,now())
      ) on conflict(coordination_record_id) do nothing;
    end if;
  exception when others then null;
  end;
  return jsonb_build_object('status','BLOCKED','error','MATERIALIZATION_ERROR','detail',sqlerrm);
end
$function$;

create or replace function portal_private.trg_materialize_operations_price_compact_handoff_v2()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private'
as $function$
begin
  perform portal_private.materialize_operations_price_compact_decision_v2(new.record_id);
  return new;
end
$function$;

drop trigger if exists trg_materialize_operations_price_compact_handoff_v2 on portal_private.ai_coordination_records;
create trigger trg_materialize_operations_price_compact_handoff_v2
after insert on portal_private.ai_coordination_records
for each row execute function portal_private.trg_materialize_operations_price_compact_handoff_v2();

create or replace function portal_private.owner_apply_full_price_source_handoff_v2(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
  v_actor uuid;
  v_prop portal_private.owner_price_change_proposals%rowtype;
  v_base portal_private.publications%rowtype;
  v_source portal_private.publications%rowtype;
  v_base_ctrl portal_private.owner_price_list_controls%rowtype;
  v_state jsonb;
  v_source_id text;
  v_target_id text;
  v_target_key uuid;
  v_target_title text;
  v_source_fingerprint text;
  v_current_fingerprint text;
  v_item_count integer:=0;
  v_snapshot_count integer:=0;
  v_rows integer:=0;
  v_new_item_key uuid;
  v_decision jsonb;
  r_item portal_private.publication_items%rowtype;
  r_snapshot portal_private.owner_price_snapshots%rowtype;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  select * into v_prop
  from portal_private.owner_price_change_proposals
  where id=p_proposal_id
  for update;
  if not found then raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_NOT_FOUND'; end if;
  if v_prop.proposal_status<>'UPDATE_AVAILABLE' then raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_NOT_APPLICABLE'; end if;
  if coalesce(v_prop.internal_context->>'proposal_mode','')<>'FULL_PRICE_LIST_SOURCE_HANDOFF' then raise exception using errcode='P0001',message='PRICE_UPDATE_PROPOSAL_MODE_INVALID'; end if;

  select p.* into v_base
  from portal_private.publications p
  join portal_private.owner_price_list_controls c on c.publication_key=p.id
  where p.id=v_prop.base_publication_key
    and p.publication_id=v_prop.base_publication_id
    and p.publication_type::text='PRICE'
    and p.status::text='PUBLISHED'
    and p.authority_state::text='CONFIRMED'
    and p.lifecycle_state::text='ACTIVE'
    and c.internal_state='CURRENT'
    and c.authority_state::text='CONFIRMED'
    and c.lifecycle_state::text='ACTIVE'
  for update of p;
  if not found then raise exception using errcode='P0001',message='PRICE_UPDATE_BASE_NOT_CURRENT'; end if;

  select * into v_base_ctrl
  from portal_private.owner_price_list_controls
  where publication_key=v_base.id
  for update;

  v_state:=coalesce(v_prop.internal_context->'target_state','{}'::jsonb);
  v_source_id:=nullif(btrim(coalesce(v_prop.internal_context->>'source_publication_id',v_state->>'source_publication_id')),'');
  v_target_id:=nullif(btrim(coalesce(v_prop.internal_context->>'successor_publication_id',v_state->>'successor_publication_id')),'');
  v_source_fingerprint:=nullif(btrim(coalesce(v_prop.internal_context->>'source_fingerprint',v_state->>'source_fingerprint')),'');

  select * into v_source
  from portal_private.publications
  where publication_id=v_source_id
    and publication_type::text='PRICE'
    and authority_state::text='CONFIRMED'
    and status::text in ('PUBLISHED','APPROVED','SUPERSEDED')
  limit 1;
  if not found then raise exception using errcode='P0001',message='PRICE_SOURCE_HANDOFF_SOURCE_NOT_FOUND'; end if;

  if v_target_id is null
     or v_target_id!~'-R[0-9]+$'
     or regexp_replace(v_target_id,'-R[0-9]+$','')<>regexp_replace(v_source.publication_id,'-R[0-9]+$','')
     or coalesce(v_state->>'publication_guard','')<>'DO_NOT_PUBLISH_BEFORE_ADMIN_APPROVAL' then
    raise exception using errcode='P0001',message='PRICE_SOURCE_HANDOFF_STATE_INVALID';
  end if;
  if exists(select 1 from portal_private.publications p where p.publication_id=v_target_id) then raise exception using errcode='P0001',message='PRICE_UPDATE_REVISION_COLLISION'; end if;

  v_current_fingerprint:=portal_private.price_publication_source_fingerprint_v1(v_source.id);
  if v_source_fingerprint is null or v_current_fingerprint<>v_source_fingerprint then
    raise exception using errcode='P0001',message='PRICE_SOURCE_HANDOFF_DRIFT';
  end if;

  select count(*) into v_item_count
  from portal_private.publication_items i
  where i.publication_key=v_source.id and i.item_type::text='PRICE';

  select count(*) into v_snapshot_count
  from portal_private.owner_price_snapshots s
  join portal_private.publication_items i on i.id=s.source_publication_item_key
  where i.publication_key=v_source.id and i.item_type::text='PRICE';

  if v_item_count=0 or v_item_count<>v_snapshot_count then
    raise exception using errcode='P0001',message='PRICE_SOURCE_HANDOFF_ROWS_INCOMPLETE';
  end if;

  v_target_title:=coalesce(nullif(btrim(v_state->>'title'),''),v_source.title);

  insert into portal_private.publications(
    publication_id,publication_type,title,status,audience,prepared_at,approved_at,
    source_system,source_version,source_timestamp,authority_state,lifecycle_state,metadata
  ) values(
    v_target_id,'PRICE',v_target_title,'APPROVED',v_source.audience,v_prop.received_at,v_prop.received_at,
    'OPERATIONS_DIRECTOR_SOURCE_HANDOFF','PRICE_SOURCE:'||v_source.publication_id||';PROPOSAL:'||v_prop.coordination_record_id::text,
    v_prop.received_at,'CONFIRMED','ACTIVE',
    coalesce(v_source.metadata,'{}'::jsonb)||jsonb_build_object(
      'proposal_id',v_prop.id,
      'coordination_record_id',v_prop.coordination_record_id,
      'operations_decision_record_id',v_prop.internal_context->>'decision_record_id',
      'base_publication_id',v_base.publication_id,
      'source_publication_id',v_source.publication_id,
      'source_fingerprint',v_source_fingerprint,
      'source_sha256',v_state->>'source_sha256',
      'source_drive_id',v_state->>'source_drive_id',
      'publication_guard','DO_NOT_PUBLISH_BEFORE_ADMIN_APPROVAL'
    )
  ) returning id into v_target_key;

  insert into portal_private.owner_price_list_controls(
    publication_key,internal_state,received_from_role,received_from_identity,received_at,
    client_enabled,agent_enabled,source_refs,authority_state,lifecycle_state
  ) values(
    v_target_key,'RECEIVED_IN_ADMIN','OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR',v_prop.received_at,
    false,false,v_prop.source_refs,'CONFIRMED','ACTIVE'
  );

  for r_item in
    select * from portal_private.publication_items
    where publication_key=v_source.id and item_type::text='PRICE'
    order by item_order
  loop
    select * into strict r_snapshot
    from portal_private.owner_price_snapshots
    where source_publication_item_key=r_item.id;

    insert into portal_private.publication_items(
      publication_key,item_type,item_order,product,basis,currency,price,
      delivery_period_from,delivery_period_to,payment_terms,valid_from,valid_to,audience,
      distribution_allowed,content_text,metadata,source_system,source_version,source_timestamp,
      authority_state,lifecycle_state
    ) values(
      v_target_key,'PRICE',r_item.item_order,r_item.product,r_item.basis,r_item.currency,r_item.price,
      r_item.delivery_period_from,r_item.delivery_period_to,r_item.payment_terms,
      coalesce(r_item.valid_from,now()),r_item.valid_to,v_source.audience,
      false,r_item.content_text,
      coalesce(r_item.metadata,'{}'::jsonb)||jsonb_build_object(
        'source_publication_id',v_source.publication_id,
        'source_publication_item_id',r_item.id,
        'proposal_id',v_prop.id
      ),
      'OPERATIONS_DIRECTOR_SOURCE_HANDOFF','PRICE_SOURCE:'||v_source.publication_id,
      v_prop.received_at,'CONFIRMED','ACTIVE'
    ) returning id into v_new_item_key;

    insert into portal_private.owner_price_snapshots(
      source_publication_item_key,product,producer,supplier,purchase_price,rail_tariff,rail_segments,
      basis,border_crossing,final_station,landed_cost,rona_margin,sale_price,currency,
      payment_terms,commercial_terms,source_reference,business_status,agreed_at,source_system,
      publish_client,publish_agent
    ) values(
      v_new_item_key,r_snapshot.product,r_snapshot.producer,r_snapshot.supplier,r_snapshot.purchase_price,
      r_snapshot.rail_tariff,r_snapshot.rail_segments,r_snapshot.basis,r_snapshot.border_crossing,
      r_snapshot.final_station,r_snapshot.landed_cost,r_snapshot.rona_margin,r_snapshot.sale_price,
      r_snapshot.currency,r_snapshot.payment_terms,r_snapshot.commercial_terms,v_target_id,'AGREED',
      v_prop.received_at,'OPERATIONS_DIRECTOR_SOURCE_HANDOFF',false,false
    );
    v_rows:=v_rows+1;
  end loop;

  if v_rows<>v_item_count then raise exception using errcode='P0001',message='PRICE_SOURCE_HANDOFF_CLONE_INCOMPLETE'; end if;

  v_decision:=public.owner_decide_received_price_list(v_target_id,'ACCEPT','Принято Администратором из очереди согласования Операционного директора');

  update portal_private.owner_price_change_proposals
  set proposal_status='APPLIED',applied_at=now(),applied_by=v_actor,new_publication_key=v_target_key,updated_at=now()
  where id=v_prop.id;

  insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(v_actor,'ADMIN','OWNER_OPERATIONS_PRICE_SOURCE_HANDOFF_APPLIED','PRICE_LIST',v_target_id,
    jsonb_build_object(
      'proposal_id',v_prop.id,
      'coordination_record_id',v_prop.coordination_record_id,
      'operations_decision_record_id',v_prop.internal_context->>'decision_record_id',
      'source_publication_id',v_source.publication_id,
      'source_fingerprint',v_source_fingerprint,
      'row_count',v_rows,
      'decision',v_decision
    )
  );

  return v_decision||jsonb_build_object('proposalId',v_prop.id,'mode','FULL_PRICE_LIST_SOURCE_HANDOFF','sourcePublicationId',v_source.publication_id);
end
$function$;

create or replace function public.owner_apply_price_change_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare v_mode text;
begin
  select internal_context->>'proposal_mode' into v_mode
  from portal_private.owner_price_change_proposals
  where id=p_proposal_id;

  if coalesce(v_mode,'')='FULL_PRICE_LIST_HANDOFF' then
    return portal_private.owner_apply_full_price_handoff_v1(p_proposal_id);
  end if;
  if coalesce(v_mode,'')='FULL_PRICE_LIST_SOURCE_HANDOFF' then
    return portal_private.owner_apply_full_price_source_handoff_v2(p_proposal_id);
  end if;
  return public.owner_apply_price_change_proposal_legacy(p_proposal_id);
end
$function$;

revoke all on function portal_private.price_publication_source_fingerprint_v1(uuid) from public,anon,authenticated;
revoke all on function portal_private.materialize_operations_price_compact_decision_v2(uuid) from public,anon,authenticated;
revoke all on function portal_private.owner_apply_full_price_source_handoff_v2(uuid) from public,anon,authenticated;
revoke all on function portal_private.trg_materialize_operations_price_compact_handoff_v2() from public,anon,authenticated;

-- Backfill only still-unmaterialized compact successor handoffs from the last day.
-- No publication is changed here: this creates an Admin approval item only.
do $block$
declare r record;
begin
  for r in
    select d.record_id
    from portal_private.ai_coordination_records d
    join portal_private.ai_coordination_records p on p.record_id=d.parent_record_id
    where d.record_type='OPERATIONS_INTERNAL_DECISION'
      and d.functional_role::text='OPERATIONS_DIRECTOR'
      and coalesce(d.identity_id,'')='AI-OPERATIONS-DIRECTOR'
      and d.status='APPROVE_FOR_NEXT_STAGE'
      and d.created_at>=now()-interval '1 day'
      and p.record_type='BUSINESS_CHANGE_PROPOSAL'
      and p.functional_role::text='OPERATIONS_DIRECTOR'
      and coalesce(p.identity_id,'')='AI-OPERATIONS-DIRECTOR'
      and coalesce(p.target_type,'') in ('PRICE_LIST','PRICE','PUBLICATION')
      and coalesce(p.payload->>'proposed_action','')='CREATE_SUCCESSOR_FOR_ADMIN_APPROVAL'
      and not exists(select 1 from portal_private.owner_price_change_proposals q where q.coordination_record_id=p.record_id)
  loop
    perform portal_private.materialize_operations_price_compact_decision_v2(r.record_id);
  end loop;
end
$block$;
