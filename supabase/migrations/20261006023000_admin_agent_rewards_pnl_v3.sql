-- Admin Agent Rewards P&L V3
-- Adds a source-locked three-column P&L projection without mutating Finance authority facts.

create or replace function public.rona_admin_agent_rewards_workspace_v2()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_base jsonb;
  v_deals jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_base:=public.rona_admin_agent_rewards_workspace_v1();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  enriched as (
    select
      b.item,
      b.deal_id,
      d.id deal_key,
      f.total_to_receive,
      nullif(btrim(f.obligation_currency::text),'') obligation_currency,
      f.actual_spend,
      f.actual_spend_status,
      nullif(btrim(f.execution_currency::text),'') execution_currency,
      odw.quantity_tonnes_value workflow_quantity,
      odw.payment_expectation_state,
      odw.payment_expectation_amount,
      nullif(btrim(odw.payment_expectation_currency::text),'') payment_expectation_currency,
      app.quantity_tonnes application_quantity,
      app.unit_price application_unit_price,
      app.application_currency,
      app.application_price_source,
      ps.purchase_price,
      ps.rail_tariff,
      ps.landed_cost,
      nullif(btrim(ps.currency::text),'') plan_cost_currency,
      ps.source_reference plan_cost_source_reference,
      ps.business_status plan_cost_business_status
    from base_deals b
    join portal_private.deals d on d.deal_id=b.deal_id
    left join lateral (
      select x.*
      from portal_private.deal_finance_authority_payments_v8_read_v1 x
      where x.deal_key=d.id
        and x.source_locked=true
        and x.authority_state='AUTHORITATIVE'
        and x.lifecycle_state='CURRENT'
      order by x.is_terminal desc,x.effective_at desc nulls last,x.created_at desc
      limit 1
    ) f on true
    left join portal_private.owner_deal_workflow odw on odw.deal_key=d.id
    left join lateral (
      select
        ca.id application_key,
        ca.quantity_tonnes,
        case
          when oaw.counter_offer_used=true and upper(coalesce(oaw.client_counter_response,''))='ACCEPTED' and oaw.counter_price is not null
            then oaw.counter_price
          else ca.proposed_price
        end unit_price,
        case
          when oaw.counter_offer_used=true and upper(coalesce(oaw.client_counter_response,''))='ACCEPTED' and oaw.counter_price is not null
            then nullif(btrim(oaw.counter_currency::text),'')
          else nullif(btrim(ca.proposed_currency::text),'')
        end application_currency,
        case
          when oaw.counter_offer_used=true and upper(coalesce(oaw.client_counter_response,''))='ACCEPTED' and oaw.counter_price is not null
            then 'OWNER_COUNTER_ACCEPTED'
          when ca.proposed_price is not null then 'CLIENT_APPLICATION_ACCEPTED'
          else 'TO_VERIFY'
        end application_price_source,
        coalesce(
          ca.source_publication_item_id,
          (
            select al.publication_item_key
            from portal_private.application_lines al
            where al.application_key=ca.id and al.publication_item_key is not null
            order by al.line_no
            limit 1
          )
        ) publication_item_key
      from portal_private.client_applications ca
      left join portal_private.owner_application_workflow oaw on oaw.application_key=ca.id
      where ca.linked_deal_key=d.id
        and ca.lifecycle_state::text not in ('ARCHIVED','SUPERSEDED')
      order by ca.updated_at desc
      limit 1
    ) app on true
    left join lateral (
      select ops.*
      from portal_private.owner_price_snapshots ops
      where app.publication_item_key is not null
        and ops.source_publication_item_key=app.publication_item_key
      order by
        case when upper(coalesce(ops.business_status,''))='PUBLISHED' then 0 else 1 end,
        ops.agreed_at desc nulls last,
        ops.updated_at desc
      limit 1
    ) ps on true
  ),
  shaped as (
    select
      e.*,
      coalesce(e.workflow_quantity,e.application_quantity) quantity_tonnes,
      case
        when e.total_to_receive is not null and e.obligation_currency is not null then e.obligation_currency
        when upper(coalesce(e.payment_expectation_state,''))='ACTIVE'
          and e.payment_expectation_amount is not null and e.payment_expectation_currency is not null
          then e.payment_expectation_currency
        when e.application_quantity is not null and e.application_unit_price is not null and e.application_currency is not null
          then e.application_currency
        else nullif(btrim(e.item->>'receiptCurrency'),'')
      end financial_currency,
      case
        when e.total_to_receive is not null and e.obligation_currency is not null then e.total_to_receive
        when upper(coalesce(e.payment_expectation_state,''))='ACTIVE'
          and e.payment_expectation_amount is not null and e.payment_expectation_currency is not null
          then e.payment_expectation_amount
        when e.application_quantity is not null and e.application_unit_price is not null and e.application_currency is not null
          then e.application_quantity*e.application_unit_price
        else null::numeric
      end planned_revenue,
      case
        when e.total_to_receive is not null and e.obligation_currency is not null then 'FINANCE_AUTHORITY_TOTAL_TO_RECEIVE'
        when upper(coalesce(e.payment_expectation_state,''))='ACTIVE'
          and e.payment_expectation_amount is not null and e.payment_expectation_currency is not null
          then 'OWNER_PAYMENT_EXPECTATION'
        when e.application_quantity is not null and e.application_unit_price is not null and e.application_currency is not null
          then e.application_price_source
        else 'TO_VERIFY'
      end planned_revenue_status
    from enriched e
  ),
  final_rows as (
    select
      s.*,
      (
        case when s.purchase_price is not null and s.quantity_tonnes is not null then
          jsonb_build_array(jsonb_build_object(
            'key','PURCHASE_PRICE',
            'label','Закупка товара',
            'amount',s.purchase_price*s.quantity_tonnes,
            'currency',s.plan_cost_currency,
            'source','OWNER_PRICE_SNAPSHOT'
          )) else '[]'::jsonb end
        ||
        case when s.rail_tariff is not null and s.quantity_tonnes is not null then
          jsonb_build_array(jsonb_build_object(
            'key','RAIL_TARIFF',
            'label','ЖД тариф',
            'amount',s.rail_tariff*s.quantity_tonnes,
            'currency',s.plan_cost_currency,
            'source','OWNER_PRICE_SNAPSHOT'
          )) else '[]'::jsonb end
        ||
        case when s.purchase_price is null and s.rail_tariff is null and s.landed_cost is not null and s.quantity_tonnes is not null then
          jsonb_build_array(jsonb_build_object(
            'key','LANDED_COST',
            'label','Landed cost',
            'amount',s.landed_cost*s.quantity_tonnes,
            'currency',s.plan_cost_currency,
            'source','OWNER_PRICE_SNAPSHOT'
          )) else '[]'::jsonb end
      ) plan_expense_lines,
      case
        when s.plan_cost_currency=s.financial_currency and s.quantity_tonnes is not null then
          coalesce(s.purchase_price*s.quantity_tonnes,0)
          +coalesce(s.rail_tariff*s.quantity_tonnes,0)
          +case when s.purchase_price is null and s.rail_tariff is null then coalesce(s.landed_cost*s.quantity_tonnes,0) else 0 end
        else null::numeric
      end plan_expense_known_total,
      case
        when s.quantity_tonnes is null then 'TO_VERIFY_QUANTITY'
        when s.purchase_price is null and s.rail_tariff is null and s.landed_cost is null then 'TO_VERIFY_PLAN_COST_SOURCE'
        when s.plan_cost_currency is null or s.financial_currency is null or s.plan_cost_currency<>s.financial_currency then 'TO_VERIFY_CURRENCY'
        else 'AVAILABLE_PARAMETERS_ONLY'
      end plan_expense_status,
      case
        when s.actual_spend_status='AUTHORITATIVE'
          and s.execution_currency=s.financial_currency
          then s.actual_spend
        else null::numeric
      end fact_actual_spend,
      case
        when s.actual_spend_status='AUTHORITATIVE'
          and s.execution_currency=s.financial_currency
          then 'AUTHORITATIVE'
        when s.actual_spend is null then 'TO_VERIFY'
        else 'TO_VERIFY_CURRENCY'
      end fact_actual_spend_status
    from shaped s
  )
  select coalesce(jsonb_agg(
    f.item
    || jsonb_build_object(
      'financialCurrency',f.financial_currency,
      'quantityTonnes',f.quantity_tonnes,
      'planInputs',jsonb_build_object(
        'revenue',f.planned_revenue,
        'revenueStatus',f.planned_revenue_status,
        'expenseLines',f.plan_expense_lines,
        'expenseKnownTotal',f.plan_expense_known_total,
        'expenseStatus',f.plan_expense_status,
        'taxesAndPayments',null,
        'taxesAndPaymentsStatus','TO_VERIFY',
        'fxDifference',null,
        'fxStatus','TO_VERIFY'
      ),
      'factInputs',jsonb_build_object(
        'revenue',f.planned_revenue,
        'revenueStatus',f.planned_revenue_status,
        'actualSpend',f.fact_actual_spend,
        'actualSpendStatus',f.fact_actual_spend_status,
        'cashReceived',f.item->'asIs'->'receivedAmount',
        'cashReceivedCurrency',f.item->>'receiptCurrency'
      ),
      'pnlSource',jsonb_build_object(
        'planCostSourceReference',f.plan_cost_source_reference,
        'planCostBusinessStatus',f.plan_cost_business_status,
        'applicationPriceSource',f.application_price_source
      )
    )
    order by f.deal_id
  ),'[]'::jsonb)
  into v_deals
  from final_rows f;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V3',
    'displayModel','THREE_COLUMN_PLAN_FACT_OWNER',
    'formulaOrder',jsonb_build_array(
      'REVENUE','OPERATING_EXPENSES','FINANCIAL_RESULT','TAXES_AND_PAYMENTS',
      'FX_DIFFERENCE','NET_PROFIT','AGENT_REWARD','RONA_PROFIT'
    ),
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v2() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v2() to authenticated;

create or replace function public.rona_admin_agent_rewards_correct_v3(
  p_deal_id text,
  p_assignment_id uuid,
  p_corrected_payload jsonb,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_deal_key uuid;
  v_version integer;
  v_existing portal_private.agent_reward_owner_corrections_v1%rowtype;
  v_allowed text[]:=array[
    'revenue','operatingExpenses','taxesAndPayments','fxDifference','agentReward',
    'receivedAmount','totalSpend','financialResult','conversionCost','bankFees'
  ];
  v_key text;
  v_value jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  if btrim(coalesce(p_deal_id,''))='' then raise exception 'DEAL_ID_REQUIRED'; end if;
  if p_assignment_id is null then raise exception 'ASSIGNMENT_ID_REQUIRED'; end if;
  if p_corrected_payload is null or jsonb_typeof(p_corrected_payload)<>'object' then raise exception 'CORRECTION_PAYLOAD_INVALID'; end if;
  if btrim(coalesce(p_idempotency_key,''))='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  select * into v_existing
  from portal_private.agent_reward_owner_corrections_v1
  where idempotency_key=p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'accepted',true,'idempotentReplay',true,'dealId',p_deal_id,
      'assignmentId',p_assignment_id,'version',v_existing.correction_version
    );
  end if;

  select d.id into v_deal_key
  from portal_private.deals d
  where d.deal_id=p_deal_id
  limit 1;
  if v_deal_key is null then raise exception 'DEAL_NOT_FOUND'; end if;

  for v_key,v_value in select key,value from jsonb_each(p_corrected_payload)
  loop
    if not (v_key=any(v_allowed)) then raise exception 'CORRECTION_FIELD_NOT_ALLOWED:%',v_key; end if;
    if jsonb_typeof(v_value) not in ('number','null') then raise exception 'CORRECTION_VALUE_NOT_NUMERIC:%',v_key; end if;
  end loop;

  perform 1
  from portal_private.agent_client_assignments aca
  join portal_private.agent_persons ap on ap.id=aca.agent_person_key and ap.lifecycle_state::text='ACTIVE'
  join portal_private.deals d on d.id=v_deal_key and d.client_key=aca.client_key
  where aca.id=p_assignment_id
    and aca.status::text='ACTIVE'
    and aca.lifecycle_state::text='ACTIVE'
    and aca.authority_state::text in ('CONFIRMED','VERIFIED')
    and aca.valid_from<=now()
    and (aca.valid_to is null or aca.valid_to>now())
  limit 1;
  if not found then raise exception 'DEAL_ASSIGNMENT_NOT_IN_AGENT_SCOPE'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'ADMIN_AGENT_REWARDS_V3:'||p_assignment_id::text||':'||v_deal_key::text,0
  ));

  select coalesce(max(correction_version),0)+1 into v_version
  from portal_private.agent_reward_owner_corrections_v1
  where assignment_id=p_assignment_id and deal_key=v_deal_key;

  insert into portal_private.agent_reward_owner_corrections_v1(
    deal_key,assignment_id,correction_version,corrected_payload,note,created_by,idempotency_key
  ) values (
    v_deal_key,p_assignment_id,v_version,p_corrected_payload,
    nullif(btrim(coalesce(p_note,'')),''),v_actor,p_idempotency_key
  );

  return jsonb_build_object(
    'accepted',true,'idempotentReplay',false,'dealId',p_deal_id,
    'assignmentId',p_assignment_id,'version',v_version,
    'correctedPayload',p_corrected_payload
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_correct_v3(text,uuid,jsonb,text,text) from public,anon;
grant execute on function public.rona_admin_agent_rewards_correct_v3(text,uuid,jsonb,text,text) to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v2() is
'Admin Agent Rewards P&L V3. Three-column PLAN / FACT / OWNER projection. Revenue is full planned deal revenue, never cash received. Missing plan cost/tax/fx facts fail closed as TO_VERIFY.';

comment on function public.rona_admin_agent_rewards_correct_v3(text,uuid,jsonb,text,text) is
'Owner-only immutable P&L correction overlay for Admin Agent Rewards P&L V3. Does not mutate Finance authority facts.';
