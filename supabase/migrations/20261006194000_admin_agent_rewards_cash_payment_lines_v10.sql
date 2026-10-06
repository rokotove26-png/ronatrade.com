-- Admin Agent Rewards cash FACT itemized counterparty payments v10
-- Owner-directed DELTA_ONLY after UAT.
-- Adds source-locked payment-line detail under the already approved DDS FACT total.
-- No new financial facts and no mutation of Payments, Accounting, Shipments, settlements, or legal records.

create or replace function public.rona_admin_agent_rewards_workspace_v9()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_base jsonb;
  v_cash jsonb;
  v_deals jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_base:=public.rona_admin_agent_rewards_workspace_v8();
  v_cash:=public.rona_admin_agent_rewards_workspace_v6();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  cash_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_cash->'deals','[]'::jsonb))
  ),
  shaped as (
    select
      b.item,
      b.deal_id,
      c.item as cash_item,
      coalesce(nullif(b.item->'cashFlow'->>'currency',''),nullif(b.item->>'financialCurrency','')) as cash_currency
    from base_deals b
    left join cash_deals c on c.deal_id=b.deal_id
  )
  select coalesce(
    jsonb_agg(
      s.item
      || jsonb_build_object(
        'cashPaymentLines',
          case
            when s.item->'cashFlow'->>'status' <> 'APPROVED_CASH_FLOW_DDS' then '[]'::jsonb
            else coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'paymentId',x->>'paymentId',
                  'counterparty',coalesce(nullif(x->>'counterparty',''),nullif(x->>'counterpartyName',''),'Контрагент'),
                  'amount',nullif(x->>'receiptCurrencyEquivalent','')::numeric,
                  'currency',x->>'receiptCurrency',
                  'nativeAmount',nullif(x->>'nativeAmount','')::numeric,
                  'nativeCurrency',x->>'nativeCurrency',
                  'paymentKind',x->>'paymentKind',
                  'source','SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN',
                  'authorityStatus',coalesce(nullif(x->>'expenseStatus',''),'AUTHORITATIVE_PAYMENT_RESOURCE_CHAIN')
                )
                order by ord
              )
              from jsonb_array_elements(coalesce(s.cash_item->'expenses','[]'::jsonb))
                   with ordinality t(x,ord)
              where upper(coalesce(x->>'paymentKind',''))='COUNTERPARTY_PAYMENT'
                and nullif(x->>'receiptCurrencyEquivalent','') is not null
                and coalesce(x->>'receiptCurrency','')=coalesce(s.cash_currency,'')
            ),'[]'::jsonb)
          end,
        'cashPaymentLineSemantics',jsonb_build_object(
          'status',
            case
              when s.item->'cashFlow'->>'status'='APPROVED_CASH_FLOW_DDS'
                then 'SOURCE_LOCKED_ITEMIZATION_ACTIVE'
              else 'TO_VERIFY_DDS_AUTHORITY'
            end,
          'scope','COUNTERPARTY_PAYMENT_ONLY',
          'totalAuthority','cashFlow.counterpartyCashOut',
          'lineAuthority','workspace_v6.expenses / payment resource chains',
          'aggregation','UI_GROUP_BY_PAYMENT_ID_AND_COUNTERPARTY',
          'bankFeesRemainSeparate',true,
          'mutationSemantics','READ_ONLY_PROJECTION'
        )
      )
      order by s.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from shaped s;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V10_CASH_FACT_ITEMIZED',
    'factPaymentDisplaySemantics','COUNTERPARTY_CASH_OUT_TOTAL_PLUS_SOURCE_LOCKED_LINES',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v9() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v9() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v9() is
'Admin Agent Rewards v10: compact DDS FACT with source-locked post-by-post counterparty payment detail under the counterparty cash-out total. Bank fees remain separate. Read-only projection only.';
