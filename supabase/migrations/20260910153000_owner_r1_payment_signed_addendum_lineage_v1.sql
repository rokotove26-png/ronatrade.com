create or replace function public.owner_r1_send_to_payments(p_deal_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private', 'auth'
as $function$
declare
  v_actor uuid; v_deal uuid; v_prod timestamptz; v_qty timestamptz; v_cancel text;
  v_handoff text; v_expect text; v_addendum int; v_invoice int; v_signed int;
  v_amount numeric; v_currency text; v_auth text; v_life text;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');
  select d.id,w.product_confirmed_at,w.quantity_confirmed_at,coalesce(w.cancellation_state,'ACTIVE'),
         coalesce(w.payment_handoff_state,'NOT_SENT'),coalesce(w.payment_expectation_state,'NOT_CREATED'),
         fs.client_remaining_amount,fs.currency,fs.authority_state,fs.lifecycle_state
    into v_deal,v_prod,v_qty,v_cancel,v_handoff,v_expect,v_amount,v_currency,v_auth,v_life
    from portal_private.deals d
    left join portal_private.owner_deal_workflow w on w.deal_key=d.id
    left join portal_private.owner_deal_finance_summary fs on fs.deal_id=d.deal_id
   where d.deal_id=p_deal_id limit 1;

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
   where odd.deal_key=v_deal and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;

  if v_addendum=0 then raise exception using errcode='P0001',message='ADDENDUM_REQUIRED'; end if;
  if v_invoice=0 then raise exception using errcode='P0001',message='INVOICE_REQUIRED'; end if;
  if v_signed=0 then raise exception using errcode='P0001',message='SIGNED_ADDENDUM_REQUIRED'; end if;
  if v_auth<>'CONFIRMED' or v_life<>'ACTIVE' or v_amount is null or v_amount<0 or coalesce(btrim(v_currency),'')='' then
    raise exception using errcode='P0001',message='PAYMENT_OBLIGATION_NOT_CONFIRMED';
  end if;

  if v_handoff='SENT' and (v_expect='ACTIVE' or v_amount=0) then
    return jsonb_build_object('dealId',p_deal_id,'state','SENT','amount',v_amount,'currency',v_currency,'idempotent',true);
  end if;

  insert into portal_private.owner_deal_workflow(deal_key) values(v_deal) on conflict(deal_key) do nothing;
  update portal_private.owner_deal_workflow
     set payment_handoff_state='SENT',payment_handoff_at=coalesce(payment_handoff_at,now()),payment_handoff_by=v_actor,
         payment_expectation_state=case when v_amount>0 then 'ACTIVE' else 'NOT_CREATED' end,
         payment_expectation_amount=v_amount,payment_expectation_currency=v_currency,updated_at=now()
   where deal_key=v_deal;

  if v_amount>0 then
    insert into portal_private.owner_payment_plan(deal_key,tranche_no,share_text,planned_amount,currency,status,source_system)
    values(v_deal,1,'Ожидаемое поступление после передачи сделки в оплату',v_amount,v_currency,'EXPECTED','ADMIN_DEAL_HANDOFF_R1')
    on conflict(deal_key,tranche_no) do update
      set share_text=excluded.share_text,planned_amount=excluded.planned_amount,currency=excluded.currency,
          status='EXPECTED',source_system=excluded.source_system,updated_at=now();
  end if;

  return jsonb_build_object('dealId',p_deal_id,'state','SENT','amount',v_amount,'currency',v_currency,'idempotent',false);
end $function$;

comment on function public.owner_r1_send_to_payments(text) is
'Admin R1 payment handoff. Authoritative ADDENDUM lineage accepts an active SIGNED_ADDENDUM successor while retaining separate SIGNED_ADDENDUM, INVOICE, product, volume and finance fail-closed prerequisites.';
