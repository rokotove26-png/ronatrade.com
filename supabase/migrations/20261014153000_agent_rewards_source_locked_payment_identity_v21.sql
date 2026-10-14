-- v21 technical read-projection repair: canonical counterparty match by uniquely
-- evidenced PAYMENT:<payment_id> OR exact legal name; never alter payment facts.
-- No contract, bank, settlement, finance calculation, or role mutation.
-- Existing duplicate identities remain unresolved by COUNT(DISTINCT id)=1 gate.
DO $source_lock$
BEGIN
  IF md5(pg_get_functiondef('public.rona_admin_agent_rewards_workspace_v15_legacy_source_v1()'::regprocedure)) <> 'b57df00f3d5fa819e736e482b0417468' THEN
    RAISE EXCEPTION 'RONA_BNK_LEGACY_SOURCE_CHANGED';
  END IF;
  IF md5(pg_get_functiondef('public.rona_admin_agent_rewards_workspace_v15()'::regprocedure)) <> '6eed7c3b37fbc92d989b62d0e83ed540' THEN
    RAISE EXCEPTION 'RONA_BNK_V15_SOURCE_CHANGED';
  END IF;
END
$source_lock$;

CREATE OR REPLACE FUNCTION public.rona_admin_agent_rewards_workspace_v15_legacy_source_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare
  v_actor uuid;
  v_base jsonb;
  v_deals jsonb;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');
  v_base := public.rona_admin_agent_rewards_workspace_v13();

  with base_deals as (
    select x.value as item,
           x.value->>'dealId' as deal_id,
           d.id as deal_key,
           nullif(x.value->'cashFlow'->>'cashReceived','')::numeric as received,
           nullif(x.value->'cashFlow'->>'currency','') as currency,
           nullif(x.value->'cashFlowAuthority'->>'financeProposalCreatedAt','')::timestamptz as approval_at
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb)) x(value)
    left join portal_private.deals d on d.deal_id=x.value->>'dealId'
  ), finance as (
    select distinct on (f.deal_key)
      f.deal_key,f.actual_spend,f.remaining_execution,f.execution_currency,
      f.source_version,f.effective_at,f.source_refs
    from portal_private.deal_finance_authority_payments_v8_read_v1 f
    where f.source_locked=true
      and f.authority_state='AUTHORITATIVE'
      and f.lifecycle_state='CURRENT'
      and f.actual_spend_status='AUTHORITATIVE'
      and f.remaining_execution_status='AUTHORITATIVE'
      and f.actual_spend is not null and f.remaining_execution is not null
    order by f.deal_key,f.effective_at desc,f.created_at desc,f.id desc
  ), scoped as (
    select b.*,f.actual_spend,f.remaining_execution,f.execution_currency,
           f.source_version,f.effective_at,f.source_refs,
           (b.deal_key is not null
             and b.item->'cashFlow'->>'status'='APPROVED_CASH_FLOW_DDS'
             and b.item->'ownerResultBridge'->>'recognition_status'='APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE'
             and b.approval_at is not null and f.source_version is not null) as source_candidate,
           (b.deal_key is not null
             and b.item->'cashFlow'->>'status'='APPROVED_CASH_FLOW_DDS'
             and b.item->'ownerResultBridge'->>'recognition_status'='APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE'
             and b.approval_at is not null and f.effective_at>b.approval_at) as source_newer
    from base_deals b left join finance f on f.deal_key=b.deal_key
  ), legacy_approved as (
    select s.deal_id,p.payload->'proposed_value'->'payment_ids' as ids
    from scoped s
    left join portal_private.ai_coordination_records p
      on p.record_id::text=s.item->'cashFlowAuthority'->>'financeProposalRecordId'
     and p.record_type='BUSINESS_CHANGE_PROPOSAL'
     and p.functional_role::text='FINANCE'
     and p.target_type='DEAL'
     and p.target_id=s.deal_id
     and p.status='PROPOSED'
     and p.payload->>'proposed_field'='agent_rewards.fact.dds_authority_v3'
  ), sources as (
    select s.deal_id,s.deal_key,p.payment_id,
           coalesce(nullif(i.canonical_counterparty_name,''),nullif(p.counterparty_name,''),'Контрагент') as counterparty,
           i.canonical_counterparty_id,
           c.accounting_amount as amount,
           trim(c.accounting_currency::text) as currency,
           c.native_amount,trim(c.native_currency::text) as native_currency,
           p.payment_kind::text as payment_kind
    from scoped s
    join lateral (
      select distinct on (c.payment_key) c.*
      from portal_private.payment_resource_chains_effective_v8 c
      where c.deal_key=s.deal_key and c.source_locked=true
        and (c.is_effective_execution_authority=true
             or c.effective_lifecycle_state='SUPERSEDED_FOR_EXECUTION')
      order by c.payment_key,
        case when c.is_effective_execution_authority=true then 0 else 1 end,
        c.effective_at desc,c.created_at desc,c.id desc
    ) c on true
    join portal_private.payments p on p.id=c.payment_key
    left join lateral (
      select case when count(distinct canonical_counterparty_id)=1
                    then min(canonical_counterparty_id) else null end as canonical_counterparty_id,
             case when count(distinct canonical_counterparty_id)=1
                    then min(canonical_counterparty_name) else null end as canonical_counterparty_name
      from portal_private.finance_counterparty_identities_v1 i
      where i.source_locked=true and i.lifecycle_state='ACTIVE'
        and (
          upper(btrim(i.canonical_counterparty_name))=upper(btrim(p.counterparty_name))
          or (
            jsonb_typeof(i.evidence_refs)='array'
            and nullif(btrim(p.payment_id),'') is not null
            and i.evidence_refs @> jsonb_build_array('PAYMENT:' || p.payment_id)
          )
        )
    ) i on true
    where s.source_candidate=true
      and c.source_locked=true
      and p.bank_fact_status::text='BANK_CONFIRMED'
      and p.finance_verification_status::text='VERIFIED'
      and p.authority_state::text in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
      and p.lifecycle_state::text='ACTIVE'
      and p.payment_kind::text in ('COUNTERPARTY_PAYMENT','BANK_FEE')
      and trim(c.accounting_currency::text)=trim(s.execution_currency::text)
      and c.accounting_amount is not null
  ), current_details as (
    select s.deal_id,
      coalesce(sum(s.amount) filter(where s.payment_kind='COUNTERPARTY_PAYMENT'),0::numeric) as counterparty_cash_out,
      coalesce(sum(s.amount) filter(where s.payment_kind='BANK_FEE'),0::numeric) as bank_fees,
      coalesce(sum(s.amount),0::numeric) as actual_spend,
      count(*) as row_count,
      count(distinct s.payment_id) as distinct_payment_count,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'paymentId',s.payment_id,
          'counterparty',s.counterparty,
          'canonicalCounterpartyId',s.canonical_counterparty_id,
          'counterpartyResolutionStatus',case when s.canonical_counterparty_id is null then 'TO_VERIFY' else 'RESOLVED' end,
          'amount',s.amount,'currency',s.currency,
          'nativeAmount',s.native_amount,'nativeCurrency',s.native_currency,
          'paymentKind','COUNTERPARTY_PAYMENT',
          'source','FINANCE_V8_SOURCE_LOCKED_RECONCILED',
          'authorityStatus','AUTHORITATIVE_FINANCE_PAYMENT'
        )
        order by s.payment_id
      ) filter(where s.payment_kind='COUNTERPARTY_PAYMENT'),'[]'::jsonb) as items
    from sources s group by s.deal_id
  ), old_details as (
    select s.deal_id,
      coalesce(jsonb_agg(
        x.value || jsonb_build_object(
          'canonicalCounterpartyId',i.canonical_counterparty_id,
          'counterpartyResolutionStatus',case when i.canonical_counterparty_id is null then 'TO_VERIFY' else 'RESOLVED' end,
          'counterparty',coalesce(i.canonical_counterparty_name,x.value->>'counterparty')
        ) order by x.ord
      ),'[]'::jsonb) as items,
      coalesce(sum(nullif(x.value->>'amount','')::numeric),0::numeric) as amount_total,
      count(x.ord) as item_count
    from scoped s
    left join legacy_approved a on a.deal_id=s.deal_id
    left join lateral (
      select z.value,z.ord
      from jsonb_array_elements(coalesce(s.item->'cashPaymentLines','[]'::jsonb))
           with ordinality z(value,ord)
      where jsonb_typeof(a.ids)='array'
        and z.value->>'paymentId' in (
          select jsonb_array_elements_text(a.ids)
        )
    ) x on true
    left join lateral (
      select case when count(distinct i.canonical_counterparty_id)=1
                    then min(i.canonical_counterparty_id) else null end as canonical_counterparty_id,
             case when count(distinct i.canonical_counterparty_id)=1
                    then min(i.canonical_counterparty_name) else null end as canonical_counterparty_name
      from portal_private.finance_counterparty_identities_v1 i
      where i.source_locked=true and i.lifecycle_state='ACTIVE'
        and (
          upper(btrim(i.canonical_counterparty_name))=upper(btrim(x.value->>'counterparty'))
          or (
            jsonb_typeof(i.evidence_refs)='array'
            and nullif(btrim(x.value->>'paymentId'),'') is not null
            and i.evidence_refs @> jsonb_build_array('PAYMENT:' || (x.value->>'paymentId'))
          )
        )
    ) i on true
    group by s.deal_id
  ), quality as (
    select s.*,c.counterparty_cash_out,c.bank_fees,c.actual_spend as chain_spend,
           c.row_count,c.distinct_payment_count,c.items as current_items,
           l.items as legacy_items,l.amount_total as legacy_amount,l.item_count,
           (s.source_candidate=true and s.received is not null and s.currency=s.execution_currency
             and c.row_count>0 and c.row_count=c.distinct_payment_count
             and abs(c.actual_spend-s.actual_spend)<=0.005
             and abs(s.received-s.actual_spend-s.remaining_execution)<=0.005
           ) as current_reconciled,
           (l.item_count>0
             and abs(l.amount_total-nullif(s.item->'cashFlow'->>'counterpartyCashOut','')::numeric)<=0.005
           ) as legacy_reconciled
    from scoped s
    left join current_details c on c.deal_id=s.deal_id
    left join old_details l on l.deal_id=s.deal_id
  ), projected as (
    select q.deal_id,
      case
        when q.source_candidate and q.current_reconciled then
          q.item || jsonb_build_object(
            'cashFlow',
              coalesce(q.item->'cashFlow','{}'::jsonb) || jsonb_build_object(
                'status','APPROVED_CASH_FLOW_DDS',
                'cashReceived',q.received,
                'counterpartyCashOut',q.counterparty_cash_out,
                'bankFees',q.bank_fees,
                'totalCashOut',q.actual_spend,
                'netCashFlow',q.received-q.actual_spend,
                'realizedFxReference',null,
                'semantics','CURRENT_FINANCE_V8_RECONCILED_SOURCE_LOCKED',
                'fxSemantics','PENDING_CURRENT_APPROVED_REFERENCE__DO_NOT_ADD_FX'
              ),
            'cashPaymentLines',coalesce(q.current_items,'[]'::jsonb),
            'cashPaymentLineSemantics',jsonb_build_object(
              'status','FINANCE_V8_CURRENT_RECONCILED',
              'aggregation','CANONICAL_COUNTERPARTY_ID_ONLY',
              'totalAuthority','CURRENT_FINANCE_V8_ACTUAL_SPEND_MINUS_BANK_FEES',
              'detailAuthority','SOURCE_LOCKED_PAYMENT_RESOURCE_CHAINS',
              'bankFeesRemainSeparate',true,
              'mutationSemantics','READ_ONLY_PROJECTION'
            ),
            'ownerResultBridge',
              coalesce(q.item->'ownerResultBridge','{}'::jsonb) || jsonb_build_object(
                'actual_financial_result',
                  coalesce(q.item->'ownerResultBridge'->'actual_financial_result','{}'::jsonb)
                    || jsonb_build_object('amount',q.received-q.actual_spend+
                      coalesce(nullif(q.item->'ownerResultBridge'->'open_settlement_adjustment'->>'amount','')::numeric,0::numeric),
                      'formula','CURRENT_FINANCE_NET_DDS_PLUS_OWNER_OPEN_SETTLEMENT_ADJUSTMENT')
              ),
            'financeSourceReconciliation',jsonb_build_object(
              'status','RECONCILED_CURRENT_FINANCE_V8',
              'sourceVersion',q.source_version,
              'sourceEffectiveAt',q.effective_at,
              'sourceRefs',coalesce(q.source_refs,'[]'::jsonb),
              'authoritativeSpend',q.actual_spend,
              'chainSpend',q.chain_spend,
              'sourcePaymentCount',q.row_count,
              'authority','FINANCE_V8_AUTHORITATIVE_CURRENT_SOURCE_LOCKED',
              'externalAgentPayableUnchanged',true
            )
          )
        when q.source_newer then
          q.item || jsonb_build_object(
            'cashFlow',coalesce(q.item->'cashFlow','{}'::jsonb) || jsonb_build_object(
              'status','TO_VERIFY_CURRENT_FINANCE_RECONCILIATION',
              'counterpartyCashOut',null,'bankFees',null,'totalCashOut',null,'netCashFlow',null,
              'realizedFxReference',null
            ),
            'cashPaymentLines','[]'::jsonb,
            'ownerResultBridge',coalesce(q.item->'ownerResultBridge','{}'::jsonb) ||
              jsonb_build_object('recognition_status','TO_VERIFY_CURRENT_FINANCE_RECONCILIATION'),
            'ownerCorrectionAuthority',coalesce(q.item->'ownerCorrectionAuthority','{}'::jsonb) ||
              jsonb_build_object('status','ON_HOLD_FINANCE_SOURCE_MISMATCH'),
            'financeSourceReconciliation',jsonb_build_object(
              'status','HOLD_CURRENT_FINANCE_SOURCE_MISMATCH',
              'sourceVersion',q.source_version,
              'authoritativeSpend',q.actual_spend,
              'chainSpend',q.chain_spend,
              'externalAgentPayableUnchanged',true
            )
          )
        else q.item || jsonb_build_object(
          'cashPaymentLines',
             case when q.legacy_reconciled then coalesce(q.legacy_items,'[]'::jsonb)
                  else '[]'::jsonb end,
          'cashPaymentLineSemantics',
             coalesce(q.item->'cashPaymentLineSemantics','{}'::jsonb) ||
             jsonb_build_object(
               'status',case when q.legacy_reconciled then 'SCOPED_TO_APPROVED_PAYMENT_IDS'
                             else 'TO_VERIFY_LEGACY_PAYMENT_DETAILS' end,
               'aggregation','CANONICAL_COUNTERPARTY_ID_ONLY',
               'bankFeesRemainSeparate',true
             ),
          'financeSourceReconciliation',jsonb_build_object(
             'status',case when q.legacy_reconciled then 'LEGACY_APPROVED_PAYMENT_SCOPE_RECONCILED'
                           else 'LEGACY_PAYMENT_DETAIL_TO_VERIFY' end,
             'externalAgentPayableUnchanged',true
          )
        )
      end as item
    from quality q
  )
  select coalesce(jsonb_agg(p.item order by p.deal_id),'[]'::jsonb)
    into v_deals from projected p;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_CURRENT_FINANCE_EFFECTIVE_CHAINS_V18',
    'paymentGroupSemantics','CANONICAL_COUNTERPARTY_ONLY__NO_SYNTHETIC_IDENTITY',
    'sourcePolicy','FINANCE_V8_CURRENT_AUTHORITATIVE__ONE_EFFECTIVE_CHAIN_PER_PAYMENT__RECONCILE',
    'externalAgentPayableSemantics','DO_NOT_MUTATE_SIGNED_AGENT_AGREEMENTS',
    'deals',v_deals
  );
end;
$function$;

DO $identity_check$
DECLARE v_id text;
BEGIN
  SELECT CASE WHEN count(DISTINCT canonical_counterparty_id)=1
    THEN min(canonical_counterparty_id) ELSE null END
    INTO v_id
  FROM portal_private.finance_counterparty_identities_v1 i
  WHERE i.source_locked=true AND i.lifecycle_state='ACTIVE'
    AND (upper(btrim(i.canonical_counterparty_name))=upper(btrim('ЗАО «БНК»'))
      OR (jsonb_typeof(i.evidence_refs)='array'
        AND i.evidence_refs @> jsonb_build_array('PAYMENT:OUT-2026-004-BNK')));
  IF v_id IS DISTINCT FROM 'SUPPLIER:S-001' THEN
    RAISE EXCEPTION 'RONA_BNK_PAYMENT_IDENTITY_NOT_UNIQUE';
  END IF;
END
$identity_check$;
