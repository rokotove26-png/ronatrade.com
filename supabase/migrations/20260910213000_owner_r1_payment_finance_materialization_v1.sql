-- Corrective materialization for Owner R1 payment handoff.
-- OWNER FINAL CLARIFICATION: one send atomically materializes authoritative finance/payment expectations and only then records SENT.
-- Source of truth: latest registered application + finalized Owner application workflow + confirmed deal quantity.
-- No deal/client-specific data is embedded here.

create or replace function portal_private.owner_r1_materialize_payment_finance(p_deal_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_deal uuid;
  v_client_id text;
  v_client_name text;
  v_application_id text;
  v_application_status text;
  v_linked_deal uuid;
  v_app_qty numeric;
  v_confirmed_qty numeric;
  v_proposed_price numeric;
  v_proposed_currency text;
  v_payment_terms text;
  v_registration_at timestamptz;
  v_business_status text;
  v_counter_price numeric;
  v_counter_currency text;
  v_counter_used boolean;
  v_counter_response text;
  v_finalized_at timestamptz;
  v_handoff_at timestamptz;
  v_price numeric;
  v_currency text;
  v_obligation numeric;
  v_received numeric := 0;
  v_remaining numeric;
  v_bank_currency_mismatch integer := 0;
  v_existing_count integer := 0;
  v_existing_valid boolean := false;
  v_source_kind text := 'ACCEPTED_APPLICATION';
  v_source_version text;
  v_shares text[];
  v_share1 numeric;
  v_share2 numeric;
  v_tranche1 numeric;
  v_tranche2 numeric;
  v_terms1 text;
  v_terms2 text;
  v_status1 text;
  v_status2 text;
begin
  select d.id,
         c.client_id,
         c.legal_name,
         ca.application_id,
         ca.status::text,
         ca.linked_deal_key,
         ca.quantity_tonnes,
         w.quantity_tonnes_value,
         ca.proposed_price,
         btrim(ca.proposed_currency),
         ca.payment_terms,
         dr.registered_at,
         aw.business_status,
         aw.counter_price,
         btrim(aw.counter_currency),
         aw.counter_offer_used,
         aw.client_counter_response,
         aw.finalized_at,
         w.payment_handoff_at
    into v_deal,v_client_id,v_client_name,v_application_id,v_application_status,v_linked_deal,
         v_app_qty,v_confirmed_qty,v_proposed_price,v_proposed_currency,v_payment_terms,
         v_registration_at,v_business_status,v_counter_price,v_counter_currency,
         v_counter_used,v_counter_response,v_finalized_at,v_handoff_at
    from portal_private.deals d
    join portal_private.clients c on c.id=d.client_key
    join portal_private.deal_registrations dr on dr.deal_key=d.id
    join portal_private.client_applications ca on ca.id=dr.application_key
    join portal_private.owner_application_workflow aw on aw.application_key=ca.id
    join portal_private.owner_deal_workflow w on w.deal_key=d.id
   where d.deal_id=p_deal_id
   order by dr.registered_at desc
   limit 1;

  if v_deal is null then
    return jsonb_build_object('materialized',false,'reason','REGISTERED_APPLICATION_NOT_FOUND');
  end if;
  if v_application_status<>'DEAL_REGISTERED' or v_linked_deal is distinct from v_deal
     or v_business_status<>'DEAL' or v_finalized_at is null then
    return jsonb_build_object('materialized',false,'reason','ACCEPTED_TERMS_NOT_FINAL');
  end if;
  if v_confirmed_qty is null or v_confirmed_qty<=0 then
    return jsonb_build_object('materialized',false,'reason','CONFIRMED_QUANTITY_NOT_AUTHORITATIVE');
  end if;
  if coalesce(btrim(v_payment_terms),'')='' then
    return jsonb_build_object('materialized',false,'reason','PAYMENT_TERMS_NOT_AUTHORITATIVE');
  end if;

  if coalesce(v_counter_used,false) then
    if upper(coalesce(v_counter_response,''))<>'ACCEPTED'
       or v_counter_price is null or v_counter_price<=0
       or coalesce(v_counter_currency,'')!~'^[A-Z]{3}$' then
      return jsonb_build_object('materialized',false,'reason','ACCEPTED_COUNTEROFFER_NOT_AUTHORITATIVE');
    end if;
    v_price:=v_counter_price;
    v_currency:=v_counter_currency;
    v_source_kind:='ACCEPTED_COUNTEROFFER';
    v_source_version:='OWNER_R1_ACCEPTED_COUNTEROFFER_V2';
  else
    if v_proposed_price is null or v_proposed_price<=0
       or coalesce(v_proposed_currency,'')!~'^[A-Z]{3}$' then
      return jsonb_build_object('materialized',false,'reason','ACCEPTED_APPLICATION_PRICE_NOT_AUTHORITATIVE');
    end if;
    v_price:=v_proposed_price;
    v_currency:=v_proposed_currency;
    v_source_version:='OWNER_R1_ACCEPTED_APPLICATION_V2';
  end if;

  -- Owner-final authority: the confirmed deal quantity drives the obligation.
  -- Application quantity remains lineage/audit context and is never substituted for the confirmed deal quantity.
  v_obligation:=round(v_price*v_confirmed_qty,2);

  select count(*),
         coalesce(bool_or(authority_state='CONFIRMED' and lifecycle_state='ACTIVE'
                    and obligation_amount is not null and obligation_amount>=0
                    and received_amount is not null and received_amount>=0
                    and client_remaining_amount is not null and client_remaining_amount>=0
                    and coalesce(btrim(currency),'')~'^[A-Z]{3}$'),false)
    into v_existing_count,v_existing_valid
    from portal_private.owner_deal_finance_summary
   where deal_id=p_deal_id;

  if v_existing_count>0 then
    if not v_existing_valid then
      return jsonb_build_object('materialized',false,'reason','EXISTING_FINANCE_SUMMARY_NOT_AUTHORITATIVE');
    end if;
    select obligation_amount,received_amount,client_remaining_amount,btrim(currency)
      into v_obligation,v_received,v_remaining,v_currency
      from portal_private.owner_deal_finance_summary
     where deal_id=p_deal_id and authority_state='CONFIRMED' and lifecycle_state='ACTIVE'
     limit 1;
    v_source_kind:='EXISTING_CONFIRMED_FINANCE';
  else
    select coalesce(sum(pa.allocated_amount) filter(where btrim(p.currency)=v_currency),0),
           count(*) filter(where btrim(p.currency)<>v_currency)
      into v_received,v_bank_currency_mismatch
      from portal_private.payment_allocations pa
      join portal_private.payments p on p.id=pa.payment_key
     where pa.deal_key=v_deal
       and pa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       and p.bank_fact_status='BANK_CONFIRMED'::portal_private.payment_bank_state_enum
       and pa.allocation_status in ('ALLOCATED'::portal_private.payment_allocation_state_enum,
                                    'VERIFIED'::portal_private.payment_allocation_state_enum);

    if v_bank_currency_mismatch>0 then
      return jsonb_build_object('materialized',false,'reason','BANK_FACT_CURRENCY_MISMATCH');
    end if;
    v_remaining:=greatest(v_obligation-v_received,0);

    insert into portal_private.owner_deal_finance_summary(
      deal_id,client_id,client_name,obligation_amount,received_amount,currency,client_remaining_amount,
      finance_status,accounting_status,cash_residual_amount,cash_residual_currency,cash_residual_status,
      cash_residual_note,source_document,source_version,source_timestamp,authority_state,lifecycle_state
    ) values(
      p_deal_id,v_client_id,v_client_name,v_obligation,v_received,v_currency,v_remaining,
      case when v_remaining=0 then 'PAID' when v_received>0 then 'PARTIALLY_PAID' else 'DUE' end,
      'OPEN',null,null,'NOT_APPLICABLE',null,
      'APPLICATION:'||v_application_id,v_source_version,coalesce(v_finalized_at,v_registration_at,now()),
      'CONFIRMED','ACTIVE'
    ) on conflict(deal_id) do nothing;

    -- A concurrent authoritative writer wins. Never overwrite it.
    select obligation_amount,received_amount,client_remaining_amount,btrim(currency)
      into v_obligation,v_received,v_remaining,v_currency
      from portal_private.owner_deal_finance_summary
     where deal_id=p_deal_id and authority_state='CONFIRMED' and lifecycle_state='ACTIVE'
     limit 1;
    if v_obligation is null or v_received is null or v_remaining is null or coalesce(v_currency,'')!~'^[A-Z]{3}$' then
      return jsonb_build_object('materialized',false,'reason','FINANCE_SUMMARY_CONCURRENT_CONFLICT');
    end if;
  end if;

  update portal_private.owner_deal_workflow
     set payment_expectation_state=case when v_remaining>0 then 'ACTIVE' else 'NOT_CREATED' end,
         payment_expectation_amount=v_remaining,
         payment_expectation_currency=v_currency,
         updated_at=now()
   where deal_key=v_deal;

  -- Existing plan rows are authoritative and remain untouched. If absent, derive the plan
  -- from the stored accepted payment terms without creating a parallel payment model.
  if not exists(select 1 from portal_private.owner_payment_plan where deal_key=v_deal) then
    select array_agg(m[1])
      into v_shares
      from regexp_matches(coalesce(v_payment_terms,''),'([0-9]+([.,][0-9]+)?)\s*%','g') as m;

    if coalesce(cardinality(v_shares),0)=2 then
      v_share1:=replace(v_shares[1],',','.')::numeric;
      v_share2:=replace(v_shares[2],',','.')::numeric;
    end if;

    if v_share1>0 and v_share2>0 and abs((v_share1+v_share2)-100)<0.0001 then
      v_tranche1:=round(v_obligation*v_share1/100,2);
      v_tranche2:=v_obligation-v_tranche1;
      v_terms1:=btrim(split_part(v_payment_terms,';',1));
      v_terms2:=btrim(regexp_replace(v_payment_terms,'^[^;]*;\s*',''));
      if v_terms2='' then v_terms2:=v_payment_terms; end if;
      v_status1:=case when v_received<=0 then 'EXPECTED' when v_received>=v_tranche1 then 'RECEIVED' else 'PARTIAL' end;
      v_status2:=case when v_received<=v_tranche1 then 'EXPECTED' when v_received>=v_obligation then 'RECEIVED' else 'PARTIAL' end;

      insert into portal_private.owner_payment_plan(deal_key,tranche_no,share_text,planned_amount,currency,due_at,status,source_system)
      values
        (v_deal,1,v_terms1,v_tranche1,v_currency,
         case when lower(coalesce(v_payment_terms,''))~'(предвар|deposit|prepay)' then coalesce(v_handoff_at,now()) else null end,
         v_status1,'ADMIN_DEAL_ACCEPTED_TERMS_R1'),
        (v_deal,2,v_terms2,v_tranche2,v_currency,null,v_status2,'ADMIN_DEAL_ACCEPTED_TERMS_R1')
      on conflict(deal_key,tranche_no) do nothing;
    else
      insert into portal_private.owner_payment_plan(deal_key,tranche_no,share_text,planned_amount,currency,status,source_system)
      values(v_deal,1,coalesce(nullif(v_payment_terms,''),'Ожидаемое поступление после передачи сделки в оплату'),
             v_remaining,v_currency,'EXPECTED','ADMIN_DEAL_HANDOFF_R1')
      on conflict(deal_key,tranche_no) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'materialized',true,
    'source',v_source_kind,
    'applicationId',v_application_id,
    'applicationQuantityTonnes',v_app_qty,
    'unitPrice',v_price,
    'quantityTonnes',v_confirmed_qty,
    'obligation',v_obligation,
    'received',v_received,
    'remaining',v_remaining,
    'currency',v_currency
  );
end
$$;

revoke all on function portal_private.owner_r1_materialize_payment_finance(text) from public;

create or replace function public.owner_r1_send_to_payments(p_deal_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_actor uuid;
  v_deal uuid;
  v_prod timestamptz;
  v_qty timestamptz;
  v_cancel text;
  v_handoff text;
  v_addendum int;
  v_invoice int;
  v_signed int;
  v_finance jsonb;
  v_amount numeric;
  v_currency text;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  select d.id,w.product_confirmed_at,w.quantity_confirmed_at,
         coalesce(w.cancellation_state,'ACTIVE'),coalesce(w.payment_handoff_state,'NOT_SENT')
    into v_deal,v_prod,v_qty,v_cancel,v_handoff
    from portal_private.deals d
    left join portal_private.owner_deal_workflow w on w.deal_key=d.id
   where d.deal_id=p_deal_id
   limit 1;

  if v_deal is null then raise exception using errcode='P0001',message='DEAL_NOT_FOUND'; end if;
  if v_cancel<>'ACTIVE' then raise exception using errcode='P0001',message='DEAL_NOT_ACTIVE'; end if;
  if v_prod is null then raise exception using errcode='P0001',message='PRODUCT_CONFIRMATION_REQUIRED'; end if;
  if v_qty is null then raise exception using errcode='P0001',message='VOLUME_CONFIRMATION_REQUIRED'; end if;

  select count(*) filter(where odd.document_kind in ('ADDENDUM','SIGNED_ADDENDUM')),
         count(*) filter(where odd.document_kind='INVOICE'),
         count(*) filter(where odd.document_kind='SIGNED_ADDENDUM')
    into v_addendum,v_invoice,v_signed
    from portal_private.owner_deal_documents odd
    join portal_private.documents doc on doc.id=odd.document_key
   where odd.deal_key=v_deal
     and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;

  if v_addendum=0 then raise exception using errcode='P0001',message='ADDENDUM_REQUIRED'; end if;
  if v_invoice=0 then raise exception using errcode='P0001',message='INVOICE_REQUIRED'; end if;
  if v_signed=0 then raise exception using errcode='P0001',message='SIGNED_ADDENDUM_REQUIRED'; end if;

  -- Same RPC transaction: materialization must succeed before SENT is written.
  v_finance:=portal_private.owner_r1_materialize_payment_finance(p_deal_id);
  if not coalesce((v_finance->>'materialized')::boolean,false) then
    raise exception using errcode='P0001',message='PAYMENT_ECONOMICS_NOT_MATERIALIZED',detail=coalesce(v_finance->>'reason','UNKNOWN');
  end if;

  v_amount:=(v_finance->>'remaining')::numeric;
  v_currency:=v_finance->>'currency';
  if v_amount is null or v_amount<0 or coalesce(v_currency,'')!~'^[A-Z]{3}$' then
    raise exception using errcode='P0001',message='PAYMENT_ECONOMICS_NOT_MATERIALIZED',detail='MATERIALIZED_RESULT_INVALID';
  end if;

  update portal_private.owner_deal_workflow
     set payment_handoff_state='SENT',
         payment_handoff_at=coalesce(payment_handoff_at,now()),
         payment_handoff_by=coalesce(payment_handoff_by,v_actor),
         payment_expectation_state=case when v_amount>0 then 'ACTIVE' else 'NOT_CREATED' end,
         payment_expectation_amount=v_amount,
         payment_expectation_currency=v_currency,
         updated_at=now()
   where deal_key=v_deal;

  return jsonb_build_object(
    'dealId',p_deal_id,
    'state','SENT',
    'amount',v_amount,
    'currency',v_currency,
    'unitPrice',(v_finance->>'unitPrice')::numeric,
    'quantityTonnes',(v_finance->>'quantityTonnes')::numeric,
    'obligation',(v_finance->>'obligation')::numeric,
    'received',(v_finance->>'received')::numeric,
    'financePending',false,
    'financeSource',v_finance->>'source',
    'idempotent',v_handoff='SENT'
  );
end
$$;

comment on function public.owner_r1_send_to_payments(text) is
'Owner R1 canonical atomic payment handoff: required document/product/volume gates first; then authoritative accepted economics are materialized in the same transaction; SENT is written only after successful finance/payment expectation materialization.';

-- Generic release-time repair for already-SENT eligible deals that lack authoritative finance.
-- Ambiguous economics are skipped; valid authoritative lineage self-heals without any deal-specific hardcode.
do $$
declare
  r record;
  v_result jsonb;
begin
  for r in
    select d.deal_id
      from portal_private.deals d
      join portal_private.owner_deal_workflow w on w.deal_key=d.id
     where d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       and coalesce(w.cancellation_state,'ACTIVE')='ACTIVE'
       and w.payment_handoff_state='SENT'
       and w.product_confirmed_at is not null
       and w.quantity_confirmed_at is not null
       and w.quantity_tonnes_value is not null
       and w.quantity_tonnes_value>0
       and exists(
         select 1 from portal_private.owner_deal_documents odd
         join portal_private.documents doc on doc.id=odd.document_key
         where odd.deal_key=d.id and odd.document_kind='SIGNED_ADDENDUM'
           and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       )
       and exists(
         select 1 from portal_private.owner_deal_documents odd
         join portal_private.documents doc on doc.id=odd.document_key
         where odd.deal_key=d.id and odd.document_kind='INVOICE'
           and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       )
       and not exists(
         select 1 from portal_private.owner_deal_finance_summary fs
         where fs.deal_id=d.deal_id and fs.authority_state='CONFIRMED' and fs.lifecycle_state='ACTIVE'
       )
  loop
    v_result:=portal_private.owner_r1_materialize_payment_finance(r.deal_id);
    -- No special-case mutation: successful materialization itself repairs the canonical expectation.
    -- Failed/ambiguous lineage leaves existing business state untouched for fail-closed review.
    continue when not coalesce((v_result->>'materialized')::boolean,false);
  end loop;
end
$$;