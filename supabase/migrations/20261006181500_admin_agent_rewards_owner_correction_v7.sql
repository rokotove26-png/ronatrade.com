-- Admin Agent Rewards FACT FX semantics + Owner line corrections v7
-- Owner-directed DELTA_ONLY.
-- 1) FACT FX uses approved Finance realized economic effect with intuitive sign.
-- 2) It never derives FX from unused converted-resource residual.
-- 3) Owner may edit exact expense lines + FX only; totals remain computed.
-- 4) Authoritative payment/Finance records and historical canonical workbook remain untouched.

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
  approved_fx as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      nullif(p.payload->'proposed_value'->>'amount_usd','')::numeric as economic_fx_usd,
      p.payload->'proposed_value'->>'sign_semantics' as sign_semantics,
      p.created_at as finance_proposal_created_at,
      o.created_at as operations_approval_created_at,
      coalesce(p.payload->'evidence_refs','[]'::jsonb) as evidence_refs
    from portal_private.ai_coordination_records p
    join portal_private.ai_coordination_records o
      on o.record_type='OPERATIONS_INTERNAL_DECISION'
     and o.functional_role::text='OPERATIONS_DIRECTOR'
     and o.target_type='DEAL'
     and o.target_id=p.target_id
     and o.status='APPROVE_FOR_NEXT_STAGE'
     and o.payload->>'record_id'=p.record_id::text
    where p.record_type='BUSINESS_CHANGE_PROPOSAL'
      and p.functional_role::text='FINANCE'
      and p.target_type='DEAL'
      and p.status='PROPOSED'
      and p.payload->>'proposed_field'='agent_rewards.fact.realized_fx_economic_effect'
      and p.payload->>'proposed_action'='MATERIALIZE_AGENT_REWARDS_FACT_FX_ECONOMIC_SIGN'
      and jsonb_typeof(p.payload->'proposed_value')='object'
    order by p.target_id,p.created_at desc,o.created_at desc
  ),
  normalized as (
    select
      b.*,
      fx.finance_proposal_id,
      fx.operations_approval_id,
      fx.economic_fx_usd,
      fx.sign_semantics,
      fx.finance_proposal_created_at,
      fx.operations_approval_created_at,
      fx.evidence_refs,
      (
        select sum((x->>'receiptCurrencyEquivalent')::numeric)
        from jsonb_array_elements(coalesce(b.item->'expenses','[]'::jsonb)) x
        where upper(coalesce(x->>'paymentKind','')) in ('COUNTERPARTY_PAYMENT','BANK_FEE')
          and nullif(x->>'receiptCurrencyEquivalent','') is not null
          and coalesce(x->>'receiptCurrency','') =
              coalesce(nullif(b.item->>'financialCurrency',''),nullif(b.item->>'receiptCurrency',''),'')
      ) as consumed_spend
    from base_deals b
    left join approved_fx fx on fx.deal_id=b.deal_id
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
            'fxDifference',n.economic_fx_usd,
            'fxStatus',
              case when n.finance_proposal_id is null
                then 'TO_VERIFY_REALIZED_FX_SOURCE_REQUIRED'
                else 'APPROVED_REALIZED_FX_ECONOMIC_EFFECT'
              end,
            'fxSemantics',
              case when n.finance_proposal_id is null
                then 'NO_SYNTHETIC_FX_FROM_CONVERSION_RESIDUAL'
                else 'POSITIVE_IS_ECONOMIC_BENEFIT__NEGATIVE_IS_ECONOMIC_LOSS'
              end
          ),
        'asIs',
          coalesce(n.item->'asIs','{}'::jsonb)
          || jsonb_build_object(
            'fxDifference',n.economic_fx_usd,
            'fxStatus',
              case when n.finance_proposal_id is null
                then 'TO_VERIFY_REALIZED_FX_SOURCE_REQUIRED'
                else 'APPROVED_REALIZED_FX_ECONOMIC_EFFECT'
              end
          ),
        'factFxAuthority',jsonb_build_object(
          'status',
            case when n.finance_proposal_id is null
              then 'TO_VERIFY_REALIZED_FX_SOURCE_REQUIRED'
              else 'APPROVED_FOR_UI_MATERIALIZATION'
            end,
          'method','FINANCE_GLOBAL_PAYMENT_SEMANTICS_V6',
          'recognition','EXACT_LINKED_CONFIRMED_CONSUMPTION_ONLY',
          'displaySign','POSITIVE_VALUE_MEANS_POSITIVE_ECONOMIC_EFFECT',
          'grossConversionIsSpend',false,
          'unusedConvertedBalanceIsRealizedFx',false,
          'legacyResidualFxSuppressed',true,
          'financeProposalRecordId',n.finance_proposal_id,
          'operationsApprovalRecordId',n.operations_approval_id,
          'financeProposalCreatedAt',n.finance_proposal_created_at,
          'operationsApprovalCreatedAt',n.operations_approval_created_at,
          'evidenceRefs',coalesce(n.evidence_refs,'[]'::jsonb)
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
    'factFxSemantics','APPROVED_REALIZED_ECONOMIC_EFFECT__NO_SYNTHETIC_RESIDUAL_FX',
    'ownerCorrectionContract','EXPENSE_LINES_PLUS_FX_ONLY',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v6() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v6() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v6() is
'Admin Agent Rewards P&L v7. FACT FX is shown with intuitive economic sign only from approved Finance realized-FX proposal plus Operations approval. Unused converted-resource residual never becomes FX. Owner correction is exact expense lines + FX only.';

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
