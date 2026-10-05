-- Correct Agent Rewards V1 read-model duplicate-column aliases after initial activation.
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
