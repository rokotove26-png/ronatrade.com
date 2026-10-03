-- Rail Logistics current-position authority view.
-- RAIL_LOGISTICS owns current wagon dislocation for Online Rail.
-- Other profile roles are notification/read consumers and do not approve this Rail fact.

create or replace view portal_private.rail_logistics_confirmed_position_v1
with (security_invoker=true)
as
select distinct on (d.id,w.wagon_number)
  r.record_id as coordination_record_id,
  r.created_at as confirmed_at,
  r.payload_hash,
  r.source_refs,
  r.evidence_refs,
  d.id as deal_key,
  d.deal_id,
  cp.current_rail_document_key as rail_document_key,
  w.wagon_number,
  w.ordinality::integer as wagon_ordinal,
  nullif(btrim(r.payload#>>'{proposed_state,station_name}'),'') as station_name,
  nullif(btrim(r.payload#>>'{proposed_state,station_code}'),'') as station_code,
  nullif(btrim(r.payload#>>'{proposed_state,operation}'),'') as operation,
  coalesce(nullif(r.payload#>>'{proposed_state,fact_semantics}',''),upper(r.payload->>'proposed_action')) as authority_basis
from portal_private.ai_coordination_records r
join portal_private.deals d
  on d.deal_id=r.target_id
 and d.lifecycle_state::text='ACTIVE'
cross join lateral jsonb_array_elements_text(r.payload->'proposed_state'->'wagons')
  with ordinality as w(wagon_number,ordinality)
join portal_private.rail_xlsx_dislocation_current_position_v1 cp
  on cp.effective_deal_key=d.id
 and cp.wagon_number=w.wagon_number
where r.record_type='BUSINESS_CHANGE_PROPOSAL'
  and r.functional_role::text='RAIL_LOGISTICS'
  and coalesce(r.identity_id,'')='AI-RAIL-LOGISTICS'
  and coalesce(r.qa_only,false)=false
  and r.target_type='DEAL'
  and r.status='PROPOSED'
  and (
    (
      upper(coalesce(r.payload->>'proposed_action',''))='OWNER_CONFIRMED_DESTINATION_POSITION'
      and coalesce(r.payload#>>'{proposed_state,fact_semantics}','')='CURRENT_POSITION_CONFIRMED_BY_OWNER'
    )
    or
    (
      upper(coalesce(r.payload->>'proposed_action','')) in (
        'RAIL_LOGISTICS_CONFIRM_CURRENT_POSITION',
        'RAIL_LOGISTICS_CONFIRMED_CURRENT_POSITION'
      )
      and coalesce(r.payload#>>'{proposed_state,fact_semantics}','') in (
        'CURRENT_POSITION_CONFIRMED_BY_RAIL_LOGISTICS',
        'CURRENT_POSITION_CONFIRMED'
      )
    )
  )
  and nullif(btrim(r.payload#>>'{proposed_state,station_name}'),'') is not null
  and nullif(btrim(r.payload#>>'{proposed_state,station_code}'),'') is not null
order by d.id,w.wagon_number,r.created_at desc,r.record_id desc;
