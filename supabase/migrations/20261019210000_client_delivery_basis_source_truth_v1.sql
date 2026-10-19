-- RONA APPLICATION -> DEAL canonical delivery basis, Owner approved policy, 2026-10-19
-- Customer destination != Incoterms place by default.
-- REQUEST_DELIVERED_PRICE with destination_price_requested=true and no explicit
-- requested basis implies Owner-defined DAP to the named destination station.
-- PUBLISHED_PRICE retains the published Incoterms basis even when route destination differs.
-- Published price itself NEVER overwrites accepted Owner counter-offer.
-- Technical source migration, no retrospective price/quantity/resource/document writes.

create or replace function portal_private.client_intake_requested_delivery_basis_v1(p_payload jsonb)
returns text
language plpgsql immutable
set search_path='pg_catalog','portal_private'
as $basis$
declare
 p jsonb:=coalesce(p_payload,'{}'::jsonb);
 station text;
 quoted text;
 explicit_basis text;
 contract text;
 named_place text;
begin
 if p->>'message_type' <> 'DELIVERED_PRICE_CALCULATION_REQUEST_V1'
    or p#>>'{commercial,price_mode}' <> 'REQUEST_DELIVERED_PRICE'
    or coalesce(p#>>'{commercial,destination_price_requested}','false')<>'true'
 then raise exception 'DELIVERED_BASIS_SOURCE_MODE_MISMATCH';end if;

 station:=nullif(btrim(case
  when jsonb_typeof(p->'destination')='object' then p#>>'{destination,station}'
  else p->>'destination'
 end),'');
 if station is null or length(station)>160
   then raise exception 'DELIVERED_BASIS_EXACT_STATION_REQUIRED';end if;
 if station !~ '^[[:alpha:][:digit:] .''()/-]+$'
   then raise exception 'DELIVERED_BASIS_UNSAFE_STATION_NAME';end if;

 -- Treat the published shipment basis ONLY as source reference, never as agreed
 -- buyer destination terms. The new client portal may send an explicit requested
 -- delivery basis; if so preserve it, but require location consistency.
 explicit_basis:=coalesce(
  nullif(btrim(p#>>'{commercial,requested_delivery_basis}'),''),
  nullif(btrim(p#>>'{shipment,requested_delivery_basis}'),''),
  nullif(btrim(p#>>'{shipment,delivery_basis_requested}'),'')
 );
 if explicit_basis is not null then
   if length(explicit_basis)>230
      or explicit_basis !~* '^(DAP|CPT|CIP|DPU|DDP|FCA)[[:space:]]+'
   then raise exception 'CLIENT_REQUESTED_BASIS_FORMAT_INVALID';end if;
   contract:=upper(split_part(explicit_basis,' ',1));
   named_place:=btrim(regexp_replace(
     regexp_replace(explicit_basis,'^[A-Za-z]+[[:space:]]+','','i'),
     ',?[[:space:]]*Incoterms[[:space:]]*2020[[:space:]]*$','','i'
   ));
   named_place:=btrim(regexp_replace(named_place,'^ст\.[[:space:]]*','','i'));
   if lower(named_place)<>lower(station) then
     raise exception 'CLIENT_REQUESTED_BASIS_STATION_CONFLICT';
   end if;
   return contract||' ст. '||station||', Incoterms 2020';
 end if;
 return 'DAP ст. '||station||', Incoterms 2020';
end;
$basis$;

revoke all on function portal_private.client_intake_requested_delivery_basis_v1(jsonb)
 from public,anon,authenticated;
comment on function portal_private.client_intake_requested_delivery_basis_v1(jsonb)
is 'Exact client-delivered-price source rule. Published shipment.source_basis is a price-list reference, never automatically the agreed delivered basis.';

do $patch$
declare
 v_source text;
 v_modified text;
 v_anchor text;
begin
 select pg_get_functiondef(p.oid) into v_source
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='portal_private'
   and p.proname='materialize_client_application_v2'
   and pg_get_function_identity_arguments(p.oid)='p_intake_id uuid';
 if v_source is null then raise exception 'CLIENT_MATERIALIZER_NOT_FOUND';end if;
 if strpos(v_source,'client_intake_requested_delivery_basis_v1')>0 then return;end if;
 if encode(extensions.digest(v_source,'sha256'),'hex')
    <> '51146501bec49cd99d7056021d14d9385aa7c10cdf92ae594cde5d64ed640a23'
 then raise exception 'CLIENT_MATERIALIZER_SOURCE_DRIFT';end if;
 v_anchor:='p#>>''{shipment,source_basis}'',source_destination';
 if length(v_source)-length(replace(v_source,v_anchor,''))<>length(v_anchor)
 then raise exception 'CLIENT_MATERIALIZER_BASIS_ANCHOR_MISMATCH';end if;
 insert into portal_private.operations_rpc_source_backups_v1
 (routine_name,backup_tag,source_sha256,sql_definition)
 values ('portal_private.materialize_client_application_v2(uuid)',
 'BEFORE_CLIENT_DELIVERED_BASIS_SOURCE_20261019',
 encode(extensions.digest(v_source,'sha256'),'hex'),v_source)
 on conflict do nothing;
 v_modified:=replace(v_source,v_anchor,
  'portal_private.client_intake_requested_delivery_basis_v1(p),source_destination');
 execute v_modified;
end $patch$;

-- Guard against a future regression where even a correctly materialized
-- buyer request is silently overwritten by the published reference before
-- the Operator registers a deal. A matching, explicitly recorded Owner-approved
-- basis override remains valid. All existing supplier resource rules stay.
do $register$
declare
 v_before text;
 v_after text;
 v_anchor text:='  did:=portal_private.next_deal_business_id();';
 v_extra text:=$guard$
  if a.source_price_mode='REQUEST_DELIVERED_PRICE' then
    if a.source_intake_key is null then
      raise exception 'DEAL_BASIS_CLIENT_INTAKE_SOURCE_MISSING';end if;
    if a.delivery_basis is distinct from
       portal_private.client_intake_requested_delivery_basis_v1(
         portal_private.client_intake_effective_payload_v1(a.source_intake_key))
       and not exists(
         select 1 from portal_private.client_application_audit_v2 ba
         where ba.application_id=a.application_id
           and ba.event_type='OWNER_APPROVED_DELIVERY_BASIS_RECONCILED_V1'
           and ba.evidence->>'approved_basis'=a.delivery_basis
           and nullif(ba.evidence->>'owner_directive_source','') is not null
       )
    then raise exception 'DEAL_DELIVERED_BASIS_NOT_SOURCE_LOCKED';end if;
  elsif a.source_price_mode='PUBLISHED_PRICE' and a.source_publication_item_id is not null then
    if a.delivery_basis is distinct from (
        select pi.basis from portal_private.publication_items pi
        where pi.id=a.source_publication_item_id)
      and not exists(
        select 1 from portal_private.client_application_audit_v2 ba
        where ba.application_id=a.application_id
          and ba.event_type='OWNER_APPROVED_DELIVERY_BASIS_RECONCILED_V1'
          and ba.evidence->>'approved_basis'=a.delivery_basis
          and nullif(ba.evidence->>'owner_directive_source','') is not null
      )
    then raise exception 'DEAL_PUBLISHED_BASIS_NOT_SOURCE_LOCKED';end if;
  end if;

$guard$;
begin
 select pg_get_functiondef(p.oid) into v_before
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='portal_private'
   and p.proname='server_executive_register_deal_v12'
   and pg_get_function_identity_arguments(p.oid)=
    'p_actor uuid, p_role portal_private.staff_functional_role_enum, p_application_id text, p_request_id uuid, p_correlation_id uuid';
 if v_before is null then raise exception 'DEAL_REGISTER_FUNCTION_NOT_FOUND';end if;
 if strpos(v_before,'DEAL_DELIVERED_BASIS_NOT_SOURCE_LOCKED')>0 then return;end if;
 if encode(extensions.digest(v_before,'sha256'),'hex')
   <>'543ac3ea0890a756780aa6d279c51ba0532e1e0dab5a4bfe4aa4c8f5cc2eac88'
 then raise exception 'DEAL_REGISTER_FUNCTION_SOURCE_DRIFT';end if;
 if length(v_before)-length(replace(v_before,v_anchor,''))<>length(v_anchor)
 then raise exception 'DEAL_REGISTER_BASIS_INSERT_ANCHOR_MISMATCH';end if;
 insert into portal_private.operations_rpc_source_backups_v1
 (routine_name,backup_tag,source_sha256,sql_definition)
 values('portal_private.server_executive_register_deal_v12(uuid,portal_private.staff_functional_role_enum,text,uuid,uuid)',
 'BEFORE_DELIVERY_BASIS_SOURCE_LOCK_20261019',
 encode(extensions.digest(v_before,'sha256'),'hex'),v_before)
 on conflict do nothing;
 v_after:=replace(v_before,v_anchor,v_extra||v_anchor);
 execute v_after;
end $register$;
