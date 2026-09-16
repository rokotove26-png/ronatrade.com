begin;

-- Canonical server-side executor for Finance-owned Payments V7 changes that require
-- Operations approval before authoritative materialization. No Deal IDs, payment IDs,
-- amounts or FX values are hardcoded here; all values are read from immutable Finance
-- proposals, current bank facts and current Finance authority.

create table if not exists portal_private.finance_approved_change_jobs_v7 (
  job_id uuid primary key default gen_random_uuid(),
  proposal_record_id uuid not null unique,
  approval_record_id uuid not null,
  proposed_action text not null,
  status text not null default 'PROCESSING' check (status in ('PROCESSING','MATERIALIZED','RETRY','DENIED')),
  attempt_count integer not null default 0,
  result_snapshot jsonb,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists finance_approved_change_jobs_v7_status_idx
  on portal_private.finance_approved_change_jobs_v7(status, updated_at);

create or replace function portal_private.materialize_approved_finance_change_v7(
  p_approval_record_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $$
declare
  v_approval portal_private.ai_coordination_records%rowtype;
  v_proposal portal_private.ai_coordination_records%rowtype;
  v_proposal_id uuid;
  v_action text;
  v_state jsonb;
  v_job portal_private.finance_approved_change_jobs_v7%rowtype;
  v_corr uuid;
  v_entry record;
  v_alloc record;
  v_spend record;
  v_payment portal_private.payments%rowtype;
  v_deal portal_private.deals%rowtype;
  v_current_attr portal_private.payment_business_attributions_v7%rowtype;
  v_current_finance portal_private.deal_finance_authority_v7%rowtype;
  v_payment_count integer := 0;
  v_execution_count integer := 0;
  v_chain_materialized_count integer := 0;
  v_count integer;
  v_lines jsonb;
  v_line_sum numeric;
  v_alloc_amount numeric;
  v_declared_total numeric;
  v_declared_currency text;
  v_event jsonb;
  v_result jsonb;
  v_source_refs jsonb;
  v_policies jsonb;
  v_policy jsonb;
  v_policy_id text;
  v_primary jsonb;
  v_exec_map jsonb;
  v_exec_currency text;
  v_exec_map_count integer := 0;
  v_new_spend numeric;
  v_new_remaining numeric;
  v_execution_status text;
  v_chain_count integer;
  v_chain_native_total numeric;
  v_chain_accounting_total numeric;
  v_chain_native_currency_min text;
  v_chain_native_currency_max text;
  v_chain_accounting_currency_min text;
  v_chain_accounting_currency_max text;
  v_accounting_scale integer;
  v_target_count integer;
  v_target_index integer;
  v_alloc_accounting numeric;
  v_alloc_accounting_so_far numeric;
  v_expected_chain_id uuid;
  v_error text;
begin
  select * into v_approval
  from portal_private.ai_coordination_records
  where record_id = p_approval_record_id;

  if not found
     or v_approval.record_type <> 'OPERATIONS_INTERNAL_DECISION'
     or v_approval.functional_role::text <> 'OPERATIONS_DIRECTOR'
     or coalesce(v_approval.identity_id,'') <> 'AI-OPERATIONS-DIRECTOR'
     or coalesce(v_approval.tool_name,'') <> 'operations_internal_decision'
     or coalesce(v_approval.qa_only,false) = true
     or v_approval.status <> 'APPROVE_FOR_NEXT_STAGE'
     or upper(coalesce(v_approval.payload->>'action','')) <> 'APPROVE_FOR_NEXT_STAGE' then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','OPERATIONS_APPROVAL_INVALID');
  end if;

  begin
    v_proposal_id := coalesce(nullif(v_approval.payload->>'record_id','')::uuid, v_approval.parent_record_id);
  exception when others then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_PROPOSAL_ID_INVALID');
  end;

  select * into v_proposal
  from portal_private.ai_coordination_records
  where record_id = v_proposal_id;

  if not found
     or v_proposal.record_type <> 'BUSINESS_CHANGE_PROPOSAL'
     or v_proposal.functional_role::text <> 'FINANCE'
     or coalesce(v_proposal.identity_id,'') <> 'AI-FINANCE'
     or coalesce(v_proposal.tool_name,'') <> 'business_change_proposal_submit'
     or coalesce(v_proposal.qa_only,false) = true
     or v_proposal.status <> 'PROPOSED'
     or v_approval.parent_record_id is distinct from v_proposal.record_id then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_PROPOSAL_INVALID');
  end if;

  if exists(select 1 from portal_private.ai_coordination_records n where n.supersedes_id=v_proposal.record_id) then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_PROPOSAL_SUPERSEDED');
  end if;

  v_action := upper(coalesce(v_proposal.payload->>'proposed_action',''));
  if v_action <> 'REPLACE_PAYMENT_ALLOCATIONS_WITH_PROPORTIONAL_SPLIT' then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_APPROVED_ACTION_NOT_SERVER_EXECUTABLE','proposed_action',v_action);
  end if;

  v_state := v_proposal.payload->'proposed_state';
  if jsonb_typeof(v_state) <> 'object' then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_APPROVED_STATE_INVALID');
  end if;

  perform pg_advisory_xact_lock(hashtext('finance-approved-change:'||v_proposal.record_id::text));

  insert into portal_private.finance_approved_change_jobs_v7(
    proposal_record_id, approval_record_id, proposed_action, status, attempt_count, updated_at
  ) values(
    v_proposal.record_id, v_approval.record_id, v_action, 'PROCESSING', 1, clock_timestamp()
  ) on conflict(proposal_record_id) do nothing;

  select * into v_job
  from portal_private.finance_approved_change_jobs_v7
  where proposal_record_id=v_proposal.record_id
  for update;

  if v_job.status='MATERIALIZED' then
    return coalesce(v_job.result_snapshot,'{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'job_id',v_job.job_id);
  end if;

  update portal_private.finance_approved_change_jobs_v7
     set approval_record_id=v_approval.record_id,
         proposed_action=v_action,
         status='PROCESSING',
         attempt_count=case when v_job.attempt_count < 1 then 1 else v_job.attempt_count + case when v_job.status='PROCESSING' then 0 else 1 end end,
         last_error=null,
         updated_at=clock_timestamp()
   where job_id=v_job.job_id;

  v_corr := coalesce(v_proposal.correlation_id, v_approval.correlation_id, gen_random_uuid());
  v_source_refs := jsonb_build_array(
    jsonb_build_object('source_type','BUSINESS_CHANGE_PROPOSAL','source_id',v_proposal.record_id::text),
    jsonb_build_object('source_type','OPERATIONS_DECISION','source_id',v_approval.record_id::text)
  );

  select portal_private.ai_role_global_policies_current_v1('FINANCE'::portal_private.ai_business_role_enum) into v_policies;
  select value into v_policy
  from jsonb_array_elements(coalesce(v_policies,'[]'::jsonb)) p(value)
  where coalesce(p.value->>'policy_key',p.value->'policy'->>'policy_key')='FINANCE_GLOBAL_PAYMENT_SEMANTICS'
  order by coalesce((p.value->>'version')::integer,(p.value->'policy'->>'version')::integer,0) desc
  limit 1;
  v_primary := coalesce(v_policy->'policy'->'rules'->'FUNDING_CURRENCY_PRIMARY_SEMANTICS',v_policy->'rules'->'FUNDING_CURRENCY_PRIMARY_SEMANTICS','{}'::jsonb);
  v_policy_id := coalesce(v_policy->>'policy_id',v_policy->'policy'->>'policy_id');
  if v_policy is null
     or upper(coalesce(v_primary->>'actual_spend_owner',''))<>'FINANCE'
     or upper(coalesce(v_primary->>'remaining_owner',''))<>'FINANCE'
     or coalesce(v_policy_id,'')='' then
    update portal_private.finance_approved_change_jobs_v7
       set status='DENIED',last_error='FINANCE_EXECUTION_POLICY_NOT_ACTIVE',updated_at=clock_timestamp()
     where job_id=v_job.job_id;
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_EXECUTION_POLICY_NOT_ACTIVE','job_id',v_job.job_id);
  end if;
  v_source_refs := v_source_refs || jsonb_build_array(jsonb_build_object('source_type','GLOBAL_ROLE_POLICY','source_id',v_policy_id));

  -- Finance may publish primary spend in any ISO-3 funding currency as
  -- primary_actual_spend_<iso3>. The server never performs browser/market/CBR FX.
  for v_entry in
    select key,value from jsonb_each(v_state)
    where key ~ '^primary_actual_spend_[A-Za-z]{3}$' and jsonb_typeof(value)='object'
  loop
    v_exec_map_count := v_exec_map_count + 1;
    if v_exec_map_count > 1 then
      update portal_private.finance_approved_change_jobs_v7 set status='DENIED',last_error='MULTIPLE_EXECUTION_CURRENCIES_IN_PROPOSAL',updated_at=clock_timestamp() where job_id=v_job.job_id;
      return jsonb_build_object('accepted',false,'materialized',false,'reason_code','MULTIPLE_EXECUTION_CURRENCIES_IN_PROPOSAL','job_id',v_job.job_id);
    end if;
    v_exec_map := v_entry.value;
    v_exec_currency := upper(right(v_entry.key,3));
  end loop;

  begin
    -- 1. Exact attribution replacement from the approved Finance state.
    for v_entry in
      select key,value from jsonb_each(v_state)
      where jsonb_typeof(value)='object'
        and value ? 'allocations'
        and value ? 'total'
        and value ? 'currency'
      order by key
    loop
      v_payment_count := v_payment_count + 1;
      select count(*) into v_target_count from jsonb_object_keys(v_entry.value->'allocations');
      if jsonb_typeof(v_entry.value->'allocations')<>'object' or v_target_count=0 then
        raise exception 'APPROVED_SPLIT_ALLOCATIONS_REQUIRED:%',v_entry.key;
      end if;
      begin
        v_declared_total := (v_entry.value->>'total')::numeric;
      exception when others then
        raise exception 'APPROVED_SPLIT_TOTAL_INVALID:%',v_entry.key;
      end;
      v_declared_currency := upper(coalesce(v_entry.value->>'currency',''));

      select count(*) into v_count
      from portal_private.payments p
      where p.payment_id=v_entry.key
        and p.lifecycle_state::text='ACTIVE'
        and p.authority_state::text in ('VERIFIED','CONFIRMED')
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.payment_direction::text='OUTGOING';
      if v_count<>1 then raise exception 'APPROVED_SPLIT_PAYMENT_NOT_UNIQUE:%',v_entry.key; end if;

      select * into v_payment
      from portal_private.payments p
      where p.payment_id=v_entry.key
        and p.lifecycle_state::text='ACTIVE'
        and p.authority_state::text in ('VERIFIED','CONFIRMED')
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.payment_direction::text='OUTGOING'
      limit 1;

      if v_declared_total<>v_payment.amount or v_declared_currency<>upper(btrim(v_payment.currency::text)) then
        raise exception 'APPROVED_SPLIT_PAYMENT_FACT_MISMATCH:%',v_entry.key;
      end if;

      v_lines := '[]'::jsonb;
      v_line_sum := 0;
      for v_alloc in select key,value from jsonb_each_text(v_entry.value->'allocations') order by key loop
        begin v_alloc_amount:=v_alloc.value::numeric; exception when others then raise exception 'APPROVED_SPLIT_AMOUNT_INVALID:%:%',v_entry.key,v_alloc.key; end;
        if v_alloc_amount<=0 then raise exception 'APPROVED_SPLIT_AMOUNT_INVALID:%:%',v_entry.key,v_alloc.key; end if;
        select count(*) into v_count from portal_private.deals d where d.deal_id=v_alloc.key and d.lifecycle_state::text='ACTIVE';
        if v_count<>1 then raise exception 'APPROVED_SPLIT_DEAL_NOT_UNIQUE:%',v_alloc.key; end if;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('deal_id',v_alloc.key,'amount',v_alloc_amount));
        v_line_sum := v_line_sum + v_alloc_amount;
      end loop;
      if v_line_sum<>v_payment.amount then raise exception 'APPROVED_SPLIT_SUM_MISMATCH:%',v_entry.key; end if;

      select count(*) into v_count
      from portal_private.payment_business_attributions_v7 a
      where a.payment_key=v_payment.id and a.source_locked=true
        and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
        and not exists(select 1 from portal_private.payment_business_attributions_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'));
      if v_count<>1 then raise exception 'APPROVED_SPLIT_CURRENT_ATTRIBUTION_REQUIRED:%',v_entry.key; end if;

      select * into v_current_attr
      from portal_private.payment_business_attributions_v7 a
      where a.payment_key=v_payment.id and a.source_locked=true
        and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
        and not exists(select 1 from portal_private.payment_business_attributions_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'))
      limit 1;

      v_event := jsonb_build_object(
        'event_type','OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED',
        'payment_id',v_payment.payment_id,
        'expected_current_authority_id',v_current_attr.id::text,
        'idempotency_key','finance-approved-split:'||v_proposal.record_id::text||':'||v_payment.payment_id,
        'payload',jsonb_build_object('attribution_mode','EXACT','lines',v_lines),
        'source_refs',v_source_refs,
        'source_version',v_policy_id,
        'source_timestamp',v_approval.created_at::text,
        'effective_at',v_approval.created_at::text
      );
      v_result := portal_private.persist_finance_event_v7(
        jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id',v_corr::text,'execution_contour','SERVER_APPROVED_FINANCE_CHANGE_V7'),
        v_event
      );
      if coalesce((v_result->>'accepted')::boolean,false)<>true then
        raise exception 'APPROVED_SPLIT_ATTRIBUTION_PERSIST_FAILED:%:%',v_entry.key,coalesce(v_result->>'reason_code','UNKNOWN');
      end if;

      -- 2. Reallocate only an already authoritative/reconciled resource-chain total.
      -- This is secondary display/provenance data; primary actual_spend remains Finance-owned.
      select count(*),coalesce(sum(c.native_amount),0),coalesce(sum(c.accounting_amount),0),
             min(upper(btrim(c.native_currency::text))),max(upper(btrim(c.native_currency::text))),
             min(upper(btrim(c.accounting_currency::text))),max(upper(btrim(c.accounting_currency::text)))
        into v_chain_count,v_chain_native_total,v_chain_accounting_total,
             v_chain_native_currency_min,v_chain_native_currency_max,
             v_chain_accounting_currency_min,v_chain_accounting_currency_max
      from portal_private.payment_resource_chains_v7 c
      where c.payment_key=v_payment.id and c.source_locked=true
        and upper(c.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(c.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
        and not exists(select 1 from portal_private.payment_resource_chains_v7 n where n.supersedes_id=c.id and n.source_locked=true);

      if v_chain_count>0 then
        if v_chain_native_total<>v_payment.amount
           or v_chain_native_currency_min is distinct from v_chain_native_currency_max
           or v_chain_native_currency_min<>upper(btrim(v_payment.currency::text))
           or v_chain_accounting_currency_min is distinct from v_chain_accounting_currency_max
           or coalesce(v_chain_accounting_currency_min,'')='' then
          raise exception 'APPROVED_SPLIT_RESOURCE_CHAIN_NOT_RECONCILED:%',v_entry.key;
        end if;

        v_accounting_scale := greatest(scale(v_chain_accounting_total),2);
        v_target_index := 0;
        v_alloc_accounting_so_far := 0;
        for v_alloc in select key,value from jsonb_each_text(v_entry.value->'allocations') order by key loop
          v_target_index := v_target_index + 1;
          v_alloc_amount := v_alloc.value::numeric;
          if v_target_index=v_target_count then
            v_alloc_accounting := v_chain_accounting_total - v_alloc_accounting_so_far;
          else
            v_alloc_accounting := round(v_chain_accounting_total * v_alloc_amount / v_payment.amount, v_accounting_scale);
            v_alloc_accounting_so_far := v_alloc_accounting_so_far + v_alloc_accounting;
          end if;

          select * into v_deal from portal_private.deals d where d.deal_id=v_alloc.key and d.lifecycle_state::text='ACTIVE' limit 1;
          select count(*) into v_count
          from portal_private.payment_resource_chains_v7 c
          where c.payment_key=v_payment.id and c.deal_key=v_deal.id and c.source_locked=true
            and upper(c.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
            and upper(c.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
            and not exists(select 1 from portal_private.payment_resource_chains_v7 n where n.supersedes_id=c.id and n.source_locked=true);
          if v_count>1 then raise exception 'APPROVED_SPLIT_RESOURCE_CHAIN_CONFLICT:%:%',v_entry.key,v_alloc.key; end if;
          v_expected_chain_id := null;
          if v_count=1 then
            select c.id into v_expected_chain_id
            from portal_private.payment_resource_chains_v7 c
            where c.payment_key=v_payment.id and c.deal_key=v_deal.id and c.source_locked=true
              and upper(c.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
              and upper(c.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
              and not exists(select 1 from portal_private.payment_resource_chains_v7 n where n.supersedes_id=c.id and n.source_locked=true)
            limit 1;
          end if;

          v_event := jsonb_build_object(
            'event_type','PAYMENT_RESOURCE_CHAIN_CONFIRMED',
            'deal_id',v_deal.deal_id,
            'payment_id',v_payment.payment_id,
            'expected_current_authority_id',case when v_expected_chain_id is null then null else v_expected_chain_id::text end,
            'idempotency_key','finance-approved-chain:'||v_proposal.record_id::text||':'||v_payment.payment_id||':'||v_deal.deal_id,
            'payload',jsonb_build_object(
              'native_amount',v_alloc_amount,
              'native_currency',upper(btrim(v_payment.currency::text)),
              'accounting_amount',v_alloc_accounting,
              'accounting_currency',v_chain_accounting_currency_min,
              'conversion_source_basis','FINANCE_APPROVED_PROPORTIONAL_REALLOCATION'
            ),
            'source_refs',v_source_refs,
            'source_version',v_policy_id,
            'source_timestamp',v_approval.created_at::text,
            'effective_at',v_approval.created_at::text
          );
          v_result := portal_private.persist_finance_event_v7(
            jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id',v_corr::text,'execution_contour','SERVER_APPROVED_FINANCE_CHANGE_V7'),
            v_event
          );
          if coalesce((v_result->>'accepted')::boolean,false)<>true then
            raise exception 'APPROVED_SPLIT_RESOURCE_CHAIN_PERSIST_FAILED:%:%:%',v_entry.key,v_alloc.key,coalesce(v_result->>'reason_code','UNKNOWN');
          end if;
          v_chain_materialized_count := v_chain_materialized_count + 1;
        end loop;
      end if;
    end loop;

    if v_payment_count=0 then raise exception 'APPROVED_SPLIT_NO_PAYMENT_STATES'; end if;

    -- 3. Materialize Finance primary actual_spend and preserve the existing authoritative
    -- funding pool when reallocating spend across Deals.
    if v_exec_map is not null then
      for v_spend in select key,value from jsonb_each_text(v_exec_map) order by key loop
        begin v_new_spend:=v_spend.value::numeric; exception when others then raise exception 'APPROVED_SPLIT_EXECUTION_AMOUNT_INVALID:%',v_spend.key; end;
        if v_new_spend<0 then raise exception 'APPROVED_SPLIT_EXECUTION_AMOUNT_INVALID:%',v_spend.key; end if;

        select * into v_deal from portal_private.deals d where d.deal_id=v_spend.key and d.lifecycle_state::text='ACTIVE' limit 1;
        if not found then raise exception 'APPROVED_SPLIT_EXECUTION_DEAL_NOT_FOUND:%',v_spend.key; end if;

        select count(*) into v_count
        from portal_private.deal_finance_authority_v7 a
        where a.deal_key=v_deal.id and a.source_locked=true
          and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
          and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
          and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'));
        if v_count<>1 then raise exception 'APPROVED_SPLIT_CURRENT_FINANCE_AUTHORITY_REQUIRED:%',v_spend.key; end if;

        select * into v_current_finance
        from portal_private.deal_finance_authority_v7 a
        where a.deal_key=v_deal.id and a.source_locked=true
          and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
          and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
          and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'))
        limit 1;

        if upper(coalesce(v_current_finance.actual_spend_status,''))<>'AUTHORITATIVE'
           or upper(coalesce(v_current_finance.remaining_execution_status,''))<>'AUTHORITATIVE'
           or upper(coalesce(btrim(v_current_finance.execution_currency::text),''))<>v_exec_currency
           or v_current_finance.actual_spend is null
           or v_current_finance.remaining_execution is null then
          raise exception 'APPROVED_SPLIT_EXECUTION_BASE_NOT_AUTHORITATIVE:%',v_spend.key;
        end if;

        v_new_remaining := v_current_finance.remaining_execution + v_current_finance.actual_spend - v_new_spend;
        v_execution_status := case
          when v_new_spend=0 and v_new_remaining=0 then 'CONFIRMED_ZERO_RECEIPT_PENDING'
          when v_new_remaining<0 then 'CONFIRMED_SPEND_BEFORE_CLIENT_RECEIPT'
          else 'CONFIRMED_EXECUTION_STATE'
        end;

        v_event := jsonb_build_object(
          'event_type','DEAL_EXECUTION_STATE_CONFIRMED',
          'deal_id',v_deal.deal_id,
          'expected_current_authority_id',v_current_finance.id::text,
          'idempotency_key','finance-approved-execution:'||v_proposal.record_id::text||':'||v_deal.deal_id,
          'payload',jsonb_build_object(
            'currency',v_exec_currency,
            'actual_spend',v_new_spend,
            'actual_spend_status','AUTHORITATIVE',
            'remaining_execution',v_new_remaining,
            'remaining_execution_status','AUTHORITATIVE',
            'execution_status',v_execution_status
          ),
          'source_refs',v_source_refs,
          'source_version',v_policy_id,
          'source_timestamp',v_approval.created_at::text,
          'effective_at',v_approval.created_at::text
        );
        v_result := portal_private.persist_finance_event_v7(
          jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id',v_corr::text,'execution_contour','SERVER_APPROVED_FINANCE_CHANGE_V7'),
          v_event
        );
        if coalesce((v_result->>'accepted')::boolean,false)<>true then
          raise exception 'APPROVED_SPLIT_EXECUTION_PERSIST_FAILED:%:%',v_spend.key,coalesce(v_result->>'reason_code','UNKNOWN');
        end if;
        v_execution_count := v_execution_count + 1;
      end loop;
    end if;

  exception when others then
    v_error := left(sqlerrm,1000);
    update portal_private.finance_approved_change_jobs_v7
       set status='RETRY',last_error=v_error,result_snapshot=jsonb_build_object('accepted',false,'materialized',false,'reason_code','APPROVED_FINANCE_CHANGE_EXECUTION_ERROR','error',v_error),updated_at=clock_timestamp()
     where job_id=v_job.job_id;
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','APPROVED_FINANCE_CHANGE_EXECUTION_ERROR','error',v_error,'job_id',v_job.job_id);
  end;

  v_result := jsonb_build_object(
    'accepted',true,
    'materialized',true,
    'proposal_record_id',v_proposal.record_id,
    'approval_record_id',v_approval.record_id,
    'proposed_action',v_action,
    'payment_attributions_materialized',v_payment_count,
    'resource_chains_materialized',v_chain_materialized_count,
    'execution_authorities_materialized',v_execution_count,
    'projection_refresh_required',true,
    'job_id',v_job.job_id
  );
  update portal_private.finance_approved_change_jobs_v7
     set status='MATERIALIZED',result_snapshot=v_result,last_error=null,updated_at=clock_timestamp()
   where job_id=v_job.job_id;
  return v_result;
end;
$$;

revoke all on function portal_private.materialize_approved_finance_change_v7(uuid) from public;

create or replace function portal_private.auto_materialize_approved_finance_change_v7()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $$
declare
  r record;
begin
  if new.record_type='OPERATIONS_INTERNAL_DECISION'
     and new.functional_role::text='OPERATIONS_DIRECTOR'
     and coalesce(new.identity_id,'')='AI-OPERATIONS-DIRECTOR'
     and coalesce(new.tool_name,'')='operations_internal_decision'
     and coalesce(new.qa_only,false)=false
     and new.status='APPROVE_FOR_NEXT_STAGE'
     and upper(coalesce(new.payload->>'action',''))='APPROVE_FOR_NEXT_STAGE' then
    begin
      perform portal_private.materialize_approved_finance_change_v7(new.record_id);
    exception when others then
      raise warning 'Approved Finance change auto materialization isolated failure: %',left(sqlerrm,500);
    end;
  end if;

  -- Bounded opportunistic retry for transient failures.
  for r in
    select approval_record_id
    from portal_private.finance_approved_change_jobs_v7
    where status='RETRY'
    order by updated_at
    limit 3
  loop
    begin
      perform portal_private.materialize_approved_finance_change_v7(r.approval_record_id);
    exception when others then
      raise warning 'Approved Finance change retry isolated failure: %',left(sqlerrm,500);
    end;
  end loop;
  return new;
end;
$$;

revoke all on function portal_private.auto_materialize_approved_finance_change_v7() from public;

drop trigger if exists finance_auto_materialize_approved_change_v7 on portal_private.ai_coordination_records;
create trigger finance_auto_materialize_approved_change_v7
after insert on portal_private.ai_coordination_records
for each row execute function portal_private.auto_materialize_approved_finance_change_v7();

-- Safe, source-driven backfill for already-approved proposals. No business values are injected.
do $$
declare
  r record;
begin
  for r in
    select a.record_id
    from portal_private.ai_coordination_records a
    join portal_private.ai_coordination_records p
      on p.record_id=coalesce(nullif(a.payload->>'record_id','')::uuid,a.parent_record_id)
    where a.record_type='OPERATIONS_INTERNAL_DECISION'
      and a.functional_role::text='OPERATIONS_DIRECTOR'
      and coalesce(a.identity_id,'')='AI-OPERATIONS-DIRECTOR'
      and coalesce(a.tool_name,'')='operations_internal_decision'
      and coalesce(a.qa_only,false)=false
      and a.status='APPROVE_FOR_NEXT_STAGE'
      and upper(coalesce(a.payload->>'action',''))='APPROVE_FOR_NEXT_STAGE'
      and p.record_type='BUSINESS_CHANGE_PROPOSAL'
      and p.functional_role::text='FINANCE'
      and coalesce(p.identity_id,'')='AI-FINANCE'
      and upper(coalesce(p.payload->>'proposed_action',''))='REPLACE_PAYMENT_ALLOCATIONS_WITH_PROPORTIONAL_SPLIT'
      and not exists(select 1 from portal_private.finance_approved_change_jobs_v7 j where j.proposal_record_id=p.record_id and j.status='MATERIALIZED')
    order by a.created_at,a.record_id
  loop
    perform portal_private.materialize_approved_finance_change_v7(r.record_id);
  end loop;
end;
$$;

revoke all on portal_private.finance_approved_change_jobs_v7 from public;

commit;
