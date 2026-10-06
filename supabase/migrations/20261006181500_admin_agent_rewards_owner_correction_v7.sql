-- Admin Agent Rewards FACT FX semantics + Owner line corrections v7
-- Owner-directed DELTA_ONLY.
-- 1) Stops treating unused converted-resource residual as realized FX.
-- 2) Narrows Owner correction to per-expense-line overrides plus FX only.
-- 3) Leaves authoritative payment/Finance records untouched.

create or replace function public.rona_admin_agent_rewards_workspace_v6()
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
  v_base:=public.rona_admin_agent_rewards_workspace_v5();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  normalized as (
    select
      b.*,
      (
        select sum((x->>'receiptCurrencyEquivalent')::numeric)
        from jsonb_array_elements(coalesce(b.item->'expenses','[]'::jsonb)) x
        where upper(coalesce(x->>'paymentKind','')) in ('COUNTERPARTY_PAYMENT','BANK_FEE')
          and nullif(x->>'receiptCurrencyEquivalent','') is not null
          and coalesce(x->>'receiptCurrency','') =
              coalesce(nullif(b.item->>'financialCurrency',''),nullif(b.item->>'receiptCurrency',''),'')
      ) as consumed_spend
    from base_deals b
  )
  select coalesce(
    jsonb_agg(
      n.item
      || jsonb_build_object(
        'factInputs',
          coalesce(n.item->'factInputs','{}'::jsonb)
          || jsonb_build_object(
            'actualSpend',n.consumed_spend,
            'actualSpendStatus',
              case when n.consumed_spend is null
                then 'TO_VERIFY_RESOURCE_CHAIN_CONSUMPTION'
                else 'AUTHORITATIVE_RESOURCE_CHAIN_CONSUMPTION_V6'
              end,
            'fxDifference',null,
            'fxStatus','TO_VERIFY_REALIZED_FX_SOURCE_REQUIRED',
            'fxSemantics','NO_SYNTHETIC_FX_FROM_CONVERSION_RESIDUAL'
          ),
        'asIs',
          coalesce(n.item->'asIs','{}'::jsonb)
          || jsonb_build_object(
            'fxDifference',null,
            'fxStatus','TO_VERIFY_REALIZED_FX_SOURCE_REQUIRED'
          ),
        'factFxAuthority',jsonb_build_object(
          'status','TO_VERIFY_REALIZED_FX_SOURCE_REQUIRED',
          'method','FINANCE_GLOBAL_PAYMENT_SEMANTICS_V6',
          'recognition','EXACT_LINKED_CONFIRMED_CONSUMPTION_ONLY',
          'grossConversionIsSpend',false,
          'unusedConvertedBalanceIsRealizedFx',false,
          'legacySyntheticFxSuppressed',true
        )
      )
      order by n.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from normalized n;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V7_OWNER_LINE_CORRECTIONS',
    'factFxSemantics','NO_SYNTHETIC_REALIZED_FX_FROM_FUNDING_RESIDUAL',
    'ownerCorrectionContract','EXPENSE_LINES_PLUS_FX_ONLY',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v6() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v6() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v6() is
'Admin Agent Rewards P&L v7. Suppresses legacy synthetic FX derived from gross conversion funding versus consumed settlement amounts, projects current resource-chain consumption as actual spend, and exposes Owner correction contract EXPENSE_LINES_PLUS_FX_ONLY.';

create or replace function public.rona_admin_agent_rewards_correct_v4(
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
  v_key text;
  v_value jsonb;
  v_expenses jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  if btrim(coalesce(p_deal_id,''))='' then raise exception 'DEAL_ID_REQUIRED'; end if;
  if p_assignment_id is null then raise exception 'ASSIGNMENT_ID_REQUIRED'; end if;
  if p_corrected_payload is null or jsonb_typeof(p_corrected_payload)<>'object' then raise exception 'CORRECTION_PAYLOAD_INVALID'; end if;
  if btrim(coalesce(p_idempotency_key,''))='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  for v_key,v_value in select key,value from jsonb_each(p_corrected_payload)
  loop
    if v_key not in ('expenseLines','fxDifference') then
      raise exception 'CORRECTION_FIELD_NOT_ALLOWED:%',v_key;
    end if;
  end loop;

  if p_corrected_payload ? 'fxDifference'
     and jsonb_typeof(p_corrected_payload->'fxDifference') not in ('number','null') then
    raise exception 'CORRECTION_VALUE_NOT_NUMERIC:fxDifference';
  end if;

  v_expenses:=coalesce(p_corrected_payload->'expenseLines','{}'::jsonb);
  if jsonb_typeof(v_expenses)<>'object' then
    raise exception 'CORRECTION_EXPENSE_LINES_INVALID';
  end if;

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

  perform 1
  from portal_private.agent_client_assignments aca
  join portal_private.agent_persons ap
    on ap.id=aca.agent_person_key and ap.lifecycle_state::text='ACTIVE'
  join portal_private.deals d
    on d.id=v_deal_key and d.client_key=aca.client_key
  where aca.id=p_assignment_id
    and aca.status::text='ACTIVE'
    and aca.lifecycle_state::text='ACTIVE'
    and aca.authority_state::text in ('CONFIRMED','VERIFIED')
    and aca.valid_from<=now()
    and (aca.valid_to is null or aca.valid_to>now())
  limit 1;
  if not found then raise exception 'DEAL_ASSIGNMENT_NOT_IN_AGENT_SCOPE'; end if;

  for v_key,v_value in select key,value from jsonb_each(v_expenses)
  loop
    if btrim(coalesce(v_key,''))='' then raise exception 'CORRECTION_EXPENSE_KEY_REQUIRED'; end if;
    if jsonb_typeof(v_value) not in ('number','null') then
      raise exception 'CORRECTION_VALUE_NOT_NUMERIC:%',v_key;
    end if;

    perform 1
    from portal_private.payment_resource_chains_effective_v8 rc
    join portal_private.payments p on p.id=rc.payment_key
    where rc.deal_key=v_deal_key
      and p.payment_id=v_key
      and p.payment_kind::text='COUNTERPARTY_PAYMENT'
      and rc.source_locked=true
      and rc.authority_state::text='AUTHORITATIVE'
      and rc.lifecycle_state::text='CURRENT'
    limit 1;
    if not found then
      raise exception 'CORRECTION_EXPENSE_LINE_NOT_ALLOWED:%',v_key;
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(
    'ADMIN_AGENT_REWARDS_V4:'||p_assignment_id::text||':'||v_deal_key::text,0
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

revoke all on function public.rona_admin_agent_rewards_correct_v4(text,uuid,jsonb,text,text) from public,anon;
grant execute on function public.rona_admin_agent_rewards_correct_v4(text,uuid,jsonb,text,text) to authenticated;

comment on function public.rona_admin_agent_rewards_correct_v4(text,uuid,jsonb,text,text) is
'Owner correction v4 for Agent Rewards. Immutable overlay accepts only exact current COUNTERPARTY_PAYMENT expense-line overrides keyed by payment_id plus fxDifference. Revenue, expense total, taxes/payments, financial result, net profit, agent reward and RONA profit are computed/read-only.';
