-- Admin Agent Rewards Finance Workspace V1
-- Owner-controlled overlay on top of immutable AI-FINANCE / Finance V8 facts.

create table if not exists portal_private.agent_reward_owner_corrections_v1 (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id) on delete restrict,
  correction_version integer not null check (correction_version > 0),
  corrected_payload jsonb not null check (jsonb_typeof(corrected_payload)='object'),
  note text null,
  created_by uuid not null references portal_private.portal_users(id) on delete restrict,
  source_system text not null default 'ADMIN_AGENT_REWARDS_V1' check (source_system='ADMIN_AGENT_REWARDS_V1'),
  source_version text not null default 'ADMIN_AGENT_REWARDS_CORRECTION_V1' check (source_version='ADMIN_AGENT_REWARDS_CORRECTION_V1'),
  idempotency_key text not null unique check (btrim(idempotency_key)<>''),
  created_at timestamptz not null default now(),
  unique(deal_key,correction_version)
);

create index if not exists agent_reward_owner_corrections_v1_deal_created_idx
  on portal_private.agent_reward_owner_corrections_v1(deal_key,created_at desc);

revoke all on portal_private.agent_reward_owner_corrections_v1 from public,anon,authenticated;

create or replace function public.rona_admin_agent_rewards_workspace_v1()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_result jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  with active_assignments as (
    select
      aca.id assignment_id,
      aca.client_key,
      ale.legal_name agent_name,
      ale.agent_legal_entity_id,
      cl.client_id,
      cl.legal_name client_name
    from portal_private.agent_client_assignments aca
    join portal_private.agent_legal_entities ale on ale.id=aca.agent_legal_entity_key
    join portal_private.clients cl on cl.id=aca.client_key
    where aca.status::text='ACTIVE'
      and aca.lifecycle_state::text='ACTIVE'
      and aca.authority_state::text in ('CONFIRMED','VERIFIED')
      and aca.valid_from<=now()
      and (aca.valid_to is null or aca.valid_to>now())
      and ale.lifecycle_state::text='ACTIVE'
  ),
  scope as (
    select
      a.*,
      d.id deal_key,
      d.deal_id,
      d.business_status,
      d.finance_status::text finance_status,
      d.accounting_closure_status::text accounting_status
    from active_assignments a
    join portal_private.deals d on d.client_key=a.client_key
    where d.lifecycle_state::text not in ('ARCHIVED','SUPERSEDED')
  ),
  fin as (
    select distinct on (f.deal_key)
      f.deal_key,
      f.total_to_receive,
      f.due_now,
      f.expected_not_due,
      f.future_conditional,
      f.obligation_currency,
      f.contractual_payment_currency,
      f.actual_spend,
      f.actual_spend_status,
      f.remaining_execution,
      f.remaining_execution_status,
      f.execution_currency,
      f.finance_status,
      f.authority_state,
      f.lifecycle_state,
      f.effective_at,
      f.source_refs,
      f.source_locked,
      f.is_terminal,
      (
        coalesce(f.total_to_receive,0)
        -coalesce(f.due_now,0)
        -coalesce(f.expected_not_due,0)
        -coalesce(f.future_conditional,0)
      )::numeric as received_amount
    from portal_private.deal_finance_authority_payments_v8_read_v1 f
    where f.source_locked=true
      and f.authority_state='AUTHORITATIVE'
      and f.lifecycle_state='CURRENT'
    order by f.deal_key,f.is_terminal desc,f.effective_at desc nulls last,f.created_at desc
  ),
  resource_lines as (
    select
      rc.deal_key,
      jsonb_agg(
        jsonb_build_object(
          'paymentId',p.payment_id,
          'paidAt',p.payment_at,
          'counterparty',coalesce(nullif(p.counterparty_name,''),nullif(p.beneficiary_name,'')),
          'counterpartyRole',p.counterparty_role,
          'paymentKind',p.payment_kind::text,
          'nativeAmount',rc.native_amount,
          'nativeCurrency',btrim(rc.native_currency::text),
          'receiptCurrencyEquivalent',rc.accounting_amount,
          'receiptCurrency',btrim(rc.accounting_currency::text),
          'conversionSourceBasis',rc.conversion_source_basis,
          'sourceLocked',rc.source_locked
        )
        order by p.payment_at,p.payment_id
      ) as lines,
      sum(rc.accounting_amount) filter (
        where p.payment_kind::text in ('COUNTERPARTY_PAYMENT','BANK_FEE')
          and rc.source_locked=true
          and rc.authority_state='AUTHORITATIVE'
          and rc.lifecycle_state='CURRENT'
      )::numeric as settlement_equivalent_total,
      sum(rc.accounting_amount) filter (
        where p.payment_kind::text='BANK_FEE'
          and rc.source_locked=true
          and rc.authority_state='AUTHORITATIVE'
          and rc.lifecycle_state='CURRENT'
      )::numeric as bank_fee_equivalent_total
    from portal_private.payment_resource_chains_effective_v8 rc
    join portal_private.payments p on p.id=rc.payment_key
    group by rc.deal_key
  ),
  term as (
    select distinct on (t.deal_key)
      t.deal_key,t.id term_key,t.status::text term_status,t.commission_mode,
      t.commission_rate,t.commission_fixed_amount,btrim(t.currency::text) term_currency,
      t.term_reference,t.authority_state::text term_authority_state,
      t.lifecycle_state::text term_lifecycle_state,t.valid_from,t.valid_to,t.updated_at
    from portal_private.agent_deal_terms t
    order by t.deal_key,t.updated_at desc
  ),
  settlement as (
    select distinct on (st.deal_key)
      st.deal_key,st.settlement_id,st.settlement_state::text settlement_state,
      st.amount settlement_amount,btrim(st.currency::text) settlement_currency,
      st.authority_state::text settlement_authority_state,st.lifecycle_state::text settlement_lifecycle_state,
      st.payable_confirmed_at,st.paid_at,st.updated_at
    from portal_private.agent_settlements st
    where st.lifecycle_state::text='ACTIVE'
    order by st.deal_key,st.updated_at desc
  ),
  correction as (
    select distinct on (c.deal_key)
      c.deal_key,c.correction_version,c.corrected_payload,c.note,c.created_at,c.created_by
    from portal_private.agent_reward_owner_corrections_v1 c
    order by c.deal_key,c.correction_version desc
  ),
  deal_rows as (
    select
      s.assignment_id,s.client_key,s.agent_name,s.agent_legal_entity_id,s.client_id,s.client_name,
      s.deal_key,s.deal_id,s.business_status,s.finance_status as deal_finance_status,s.accounting_status,
      f.total_to_receive,f.due_now,f.expected_not_due,f.future_conditional,
      f.obligation_currency,f.contractual_payment_currency,
      f.actual_spend,f.actual_spend_status,f.remaining_execution,f.remaining_execution_status,f.execution_currency,
      f.finance_status as finance_authority_status,
      f.authority_state as finance_authority_state,
      f.lifecycle_state as finance_lifecycle_state,
      f.effective_at,f.source_refs,f.source_locked,f.is_terminal,f.received_amount,
      coalesce(rl.lines,'[]'::jsonb) expense_lines,
      rl.settlement_equivalent_total,
      rl.bank_fee_equivalent_total,
      t.term_key,t.term_status,t.commission_mode,t.commission_rate,t.commission_fixed_amount,
      t.term_currency,t.term_reference,t.term_authority_state,t.term_lifecycle_state,t.valid_from,t.valid_to,
      st.settlement_id,st.settlement_state,st.settlement_amount,st.settlement_currency,
      st.settlement_authority_state,st.settlement_lifecycle_state,st.payable_confirmed_at,st.paid_at,
      c.correction_version,c.corrected_payload,c.note correction_note,c.created_at correction_created_at,c.created_by correction_created_by,
      coalesce(nullif(btrim(f.execution_currency::text),''),nullif(btrim(f.obligation_currency::text),''),nullif(btrim(f.contractual_payment_currency::text),'')) receipt_currency
    from scope s
    left join fin f on f.deal_key=s.deal_key
    left join resource_lines rl on rl.deal_key=s.deal_key
    left join term t on t.deal_key=s.deal_key
    left join settlement st on st.deal_key=s.deal_key
    left join correction c on c.deal_key=s.deal_key
  ),
  shaped as (
    select
      d.*,
      case when d.actual_spend_status='AUTHORITATIVE' then d.received_amount-d.actual_spend else null::numeric end as financial_result,
      case
        when d.actual_spend_status='AUTHORITATIVE' and d.settlement_equivalent_total is not null
        then d.settlement_equivalent_total-d.actual_spend
        else null::numeric
      end as fx_difference,
      case
        when d.actual_spend_status='AUTHORITATIVE' and d.settlement_equivalent_total is not null
        then greatest(d.actual_spend-d.settlement_equivalent_total,0)
        else null::numeric
      end as conversion_cost,
      case
        when d.settlement_amount is not null and d.settlement_currency=d.receipt_currency
          and d.settlement_authority_state in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
          then d.settlement_amount
        when d.commission_mode='FIXED' and d.commission_fixed_amount is not null and d.term_currency=d.receipt_currency
          and d.term_authority_state in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
          and d.term_lifecycle_state='ACTIVE'
          then d.commission_fixed_amount
        else null::numeric
      end as agent_reward,
      case
        when d.settlement_amount is not null and d.settlement_currency=d.receipt_currency
          and d.settlement_authority_state in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
          then 'SETTLEMENT_AUTHORITY'
        when d.commission_mode='FIXED' and d.commission_fixed_amount is not null and d.term_currency=d.receipt_currency
          and d.term_authority_state in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
          and d.term_lifecycle_state='ACTIVE'
          then 'FIXED_TERM'
        when d.term_key is null then 'TERM_MISSING'
        else 'CALCULATION_BASIS_REQUIRED'
      end agent_reward_status
    from deal_rows d
  )
  select jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_FINANCE_WORKSPACE_V1',
    'generatedAt',now(),
    'financeIdentity',jsonb_build_object('role','FINANCE','identityId','AI-FINANCE'),
    'currencyRule','ALL_PRIMARY_VALUES_IN_RECEIPT_CURRENCY',
    'deals',
      coalesce(jsonb_agg(
        jsonb_build_object(
          'dealId',x.deal_id,
          'dealKey',x.deal_key,
          'clientId',x.client_id,
          'clientName',x.client_name,
          'agentName',x.agent_name,
          'businessStatus',x.business_status,
          'financeStatus',coalesce(x.finance_authority_status,x.deal_finance_status),
          'accountingStatus',x.accounting_status,
          'receiptCurrency',x.receipt_currency,
          'asIs',jsonb_build_object(
            'receivedAmount',x.received_amount,
            'totalSpend',case when x.actual_spend_status='AUTHORITATIVE' then x.actual_spend else null end,
            'financialResult',x.financial_result,
            'conversionCost',x.conversion_cost,
            'fxDifference',x.fx_difference,
            'bankFees',x.bank_fee_equivalent_total,
            'agentReward',x.agent_reward,
            'agentRewardStatus',x.agent_reward_status,
            'actualSpendStatus',x.actual_spend_status,
            'remainingExecution',x.remaining_execution,
            'remainingExecutionStatus',x.remaining_execution_status
          ),
          'expenses',x.expense_lines,
          'agentTerm',jsonb_build_object(
            'status',x.term_status,
            'mode',x.commission_mode,
            'rate',x.commission_rate,
            'fixedAmount',x.commission_fixed_amount,
            'currency',x.term_currency,
            'reference',x.term_reference,
            'authorityState',x.term_authority_state,
            'lifecycleState',x.term_lifecycle_state,
            'validFrom',x.valid_from,
            'validTo',x.valid_to
          ),
          'settlement',jsonb_build_object(
            'settlementId',x.settlement_id,
            'state',x.settlement_state,
            'amount',x.settlement_amount,
            'currency',x.settlement_currency,
            'authorityState',x.settlement_authority_state,
            'payableConfirmedAt',x.payable_confirmed_at,
            'paidAt',x.paid_at
          ),
          'ownerCorrection',case when x.correction_version is null then null else jsonb_build_object(
            'version',x.correction_version,
            'payload',x.corrected_payload,
            'note',x.correction_note,
            'createdAt',x.correction_created_at,
            'createdBy',x.correction_created_by
          ) end,
          'provenance',jsonb_build_object(
            'financeAuthorityState',x.finance_authority_state,
            'financeLifecycleState',x.finance_lifecycle_state,
            'financeSourceLocked',x.source_locked,
            'financeEffectiveAt',x.effective_at,
            'financeSourceRefs',x.source_refs
          )
        )
        order by x.deal_id
      ) filter (where x.deal_id is not null),'[]'::jsonb)
  )
  into v_result
  from shaped x;

  return v_result;
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v1() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v1() to authenticated;

create or replace function public.rona_admin_agent_rewards_correct_v1(
  p_deal_id text,
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
  v_allowed text[]:=array['receivedAmount','totalSpend','financialResult','conversionCost','fxDifference','bankFees','agentReward'];
  v_key text;
  v_value jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  if btrim(coalesce(p_deal_id,''))='' then raise exception 'DEAL_ID_REQUIRED'; end if;
  if p_corrected_payload is null or jsonb_typeof(p_corrected_payload)<>'object' then raise exception 'CORRECTION_PAYLOAD_INVALID'; end if;
  if btrim(coalesce(p_idempotency_key,''))='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  select * into v_existing
  from portal_private.agent_reward_owner_corrections_v1
  where idempotency_key=p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object('accepted',true,'idempotentReplay',true,'dealId',p_deal_id,'version',v_existing.correction_version);
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
  where aca.client_key=(select d.client_key from portal_private.deals d where d.id=v_deal_key)
    and aca.status::text='ACTIVE'
    and aca.lifecycle_state::text='ACTIVE'
    and aca.authority_state::text in ('CONFIRMED','VERIFIED')
    and aca.valid_from<=now()
    and (aca.valid_to is null or aca.valid_to>now())
  limit 1;
  if not found then raise exception 'DEAL_NOT_IN_AGENT_SCOPE'; end if;

  perform pg_advisory_xact_lock(hashtextextended('ADMIN_AGENT_REWARDS_V1:'||v_deal_key::text,0));

  select coalesce(max(correction_version),0)+1 into v_version
  from portal_private.agent_reward_owner_corrections_v1
  where deal_key=v_deal_key;

  insert into portal_private.agent_reward_owner_corrections_v1(
    deal_key,correction_version,corrected_payload,note,created_by,idempotency_key
  ) values (
    v_deal_key,v_version,p_corrected_payload,nullif(btrim(coalesce(p_note,'')),''),v_actor,p_idempotency_key
  );

  return jsonb_build_object(
    'accepted',true,
    'idempotentReplay',false,
    'dealId',p_deal_id,
    'version',v_version,
    'correctedPayload',p_corrected_payload
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_correct_v1(text,jsonb,text,text) from public,anon;
grant execute on function public.rona_admin_agent_rewards_correct_v1(text,jsonb,text,text) to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v1() is
'Admin Agent Rewards Finance Workspace V1. AS IS is source-locked Finance V8 + BANK_ACTUAL resource chains. Primary values are expressed in client receipt currency.';

comment on function public.rona_admin_agent_rewards_correct_v1(text,jsonb,text,text) is
'Owner-only immutable correction overlay for Admin Agent Rewards V1. Does not mutate Finance authority facts.';
