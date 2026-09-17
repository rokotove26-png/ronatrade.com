-- Payments V8: generic server-side materializer for an already approved Finance canonical state.
-- No deal/client/amount literals are embedded here: all business values come from the approved proposal payload.

create or replace function portal_private.materialize_atomic_payments_v7_canonical_state_v1(p_approval_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  v_approval portal_private.ai_coordination_records%rowtype;
  v_proposal portal_private.ai_coordination_records%rowtype;
  v_proposal_id uuid;
  v_state jsonb;
  v_receipts jsonb;
  v_per_deal jsonb;
  v_corr uuid;
  v_job portal_private.finance_approved_change_jobs_v7%rowtype;
  v_source_refs jsonb;
  v_policy_id text := 'FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY_V1';
  r jsonb;
  d record;
  v_deal portal_private.deals%rowtype;
  v_current portal_private.deal_finance_authority_v7%rowtype;
  v_current_count integer;
  v_currency text;
  v_currency_l text;
  v_amount numeric;
  v_idx integer := 0;
  v_effective_at timestamptz;
  v_payment_key uuid;
  v_allocation_id uuid;
  v_attr_id uuid;
  v_payment_id text;
  v_receipt_idem text;
  v_event_exists boolean;
  v_receipt_count integer := 0;
  v_authority_count integer := 0;
  v_received numeric;
  v_due numeric;
  v_cond numeric;
  v_expected numeric;
  v_actual numeric;
  v_remaining numeric;
  v_finance_status text;
  v_documentary_status text;
  v_authority_id uuid;
  v_authority_idem text;
  v_result jsonb;
  v_error text;
begin
  select * into v_approval from portal_private.ai_coordination_records where record_id=p_approval_record_id;
  if not found
     or v_approval.record_type <> 'OPERATIONS_INTERNAL_DECISION'
     or v_approval.functional_role::text <> 'OPERATIONS_DIRECTOR'
     or coalesce(v_approval.identity_id,'') <> 'AI-OPERATIONS-DIRECTOR'
     or coalesce(v_approval.tool_name,'') <> 'operations_internal_decision'
     or coalesce(v_approval.qa_only,false)=true
     or v_approval.status <> 'APPROVE_FOR_NEXT_STAGE'
     or upper(coalesce(v_approval.payload->>'action','')) <> 'APPROVE_FOR_NEXT_STAGE' then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','OPERATIONS_APPROVAL_INVALID');
  end if;

  begin
    v_proposal_id := coalesce(nullif(v_approval.payload->>'record_id','')::uuid, v_approval.parent_record_id);
  exception when others then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_PROPOSAL_ID_INVALID');
  end;

  select * into v_proposal from portal_private.ai_coordination_records where record_id=v_proposal_id;
  if not found
     or v_proposal.record_type <> 'BUSINESS_CHANGE_PROPOSAL'
     or v_proposal.functional_role::text <> 'FINANCE'
     or coalesce(v_proposal.identity_id,'') <> 'AI-FINANCE'
     or coalesce(v_proposal.tool_name,'') <> 'business_change_proposal_submit'
     or coalesce(v_proposal.qa_only,false)=true
     or v_proposal.status <> 'PROPOSED'
     or v_approval.parent_record_id is distinct from v_proposal.record_id
     or upper(coalesce(v_proposal.payload->>'proposed_action','')) <> 'ATOMIC_MATERIALIZE_PAYMENTS_V7_CANONICAL_STATE' then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_PROPOSAL_INVALID');
  end if;
  if exists(select 1 from portal_private.ai_coordination_records n where n.supersedes_id=v_proposal.record_id) then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_PROPOSAL_SUPERSEDED');
  end if;

  v_state := v_proposal.payload->'proposed_state';
  if jsonb_typeof(v_state) <> 'object' then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_APPROVED_STATE_INVALID');
  end if;
  v_receipts := coalesce(v_state->'receipt_materialization','[]'::jsonb);
  v_per_deal := coalesce(v_state->'per_deal','{}'::jsonb);
  if jsonb_typeof(v_receipts) <> 'array' or jsonb_typeof(v_per_deal) <> 'object' then
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','FINANCE_APPROVED_STATE_SHAPE_INVALID');
  end if;

  perform pg_advisory_xact_lock(hashtext('finance-atomic-payments-v7:'||v_proposal.record_id::text));

  insert into portal_private.finance_approved_change_jobs_v7(proposal_record_id,approval_record_id,proposed_action,status,attempt_count,updated_at)
  values(v_proposal.record_id,v_approval.record_id,'ATOMIC_MATERIALIZE_PAYMENTS_V7_CANONICAL_STATE','PROCESSING',1,clock_timestamp())
  on conflict(proposal_record_id) do nothing;

  select * into v_job from portal_private.finance_approved_change_jobs_v7 where proposal_record_id=v_proposal.record_id for update;
  if v_job.status='MATERIALIZED' then
    return coalesce(v_job.result_snapshot,'{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'job_id',v_job.job_id);
  end if;
  update portal_private.finance_approved_change_jobs_v7
     set approval_record_id=v_approval.record_id,
         proposed_action='ATOMIC_MATERIALIZE_PAYMENTS_V7_CANONICAL_STATE',
         status='PROCESSING',
         attempt_count=case when v_job.attempt_count < 1 then 1 else v_job.attempt_count+case when v_job.status='PROCESSING' then 0 else 1 end end,
         last_error=null,
         updated_at=clock_timestamp()
   where job_id=v_job.job_id;

  v_corr := coalesce(v_proposal.correlation_id, v_approval.correlation_id, gen_random_uuid());
  v_effective_at := coalesce(v_approval.created_at, clock_timestamp());
  v_source_refs := jsonb_build_array(
    jsonb_build_object('source_type','BUSINESS_CHANGE_PROPOSAL','source_id',v_proposal.record_id::text),
    jsonb_build_object('source_type','OPERATIONS_DECISION','source_id',v_approval.record_id::text),
    jsonb_build_object('source_type','GLOBAL_ROLE_POLICY','source_id',v_policy_id)
  );

  begin
    for r in select value from jsonb_array_elements(v_receipts) loop
      v_idx := v_idx + 1;
      if jsonb_typeof(r) <> 'object' then raise exception 'RECEIPT_ITEM_INVALID:%',v_idx; end if;
      select * into v_deal from portal_private.deals where deal_id=r->>'deal_id' and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by updated_at desc limit 1;
      if not found then raise exception 'RECEIPT_DEAL_NOT_FOUND:%',coalesce(r->>'deal_id',''); end if;
      begin v_amount := (r->>'amount')::numeric; exception when others then raise exception 'RECEIPT_AMOUNT_INVALID:%',v_idx; end;
      v_currency := upper(btrim(coalesce(r->>'currency','')));
      if v_amount is null or v_amount<=0 or v_currency !~ '^[A-Z]{3}$' or upper(coalesce(r->>'bank_fact_status','')) <> 'RECEIVED_UNVERIFIED' then
        raise exception 'RECEIPT_SEMANTICS_INVALID:%',v_idx;
      end if;
      if upper(coalesce(r->>'allocation','')) not in ('100_PERCENT_EXACT','EXACT','') then
        raise exception 'RECEIPT_ALLOCATION_INVALID:%',v_idx;
      end if;
      v_receipt_idem := 'finance-atomic-receipt:'||v_proposal.record_id::text||':'||v_idx::text||':'||v_deal.deal_id||':'||v_amount::text||':'||v_currency;
      select exists(select 1 from portal_private.finance_events_v7 where actor_id='AI-FINANCE' and idempotency_key=v_receipt_idem) into v_event_exists;
      if v_event_exists then continue; end if;

      v_payment_key := gen_random_uuid();
      v_allocation_id := gen_random_uuid();
      v_attr_id := gen_random_uuid();
      v_payment_id := 'PAYEV-'||to_char(v_effective_at,'YYYY')||'-'||lpad(nextval('portal_private.payment_event_seq')::text,6,'0');

      insert into portal_private.payments(
        id,payment_id,bank_transaction_reference,bank_fact_status,payment_at,amount,currency,
        payer_name,beneficiary_name,original_payment_purpose,finance_status,accounting_closure_status,
        source_system,source_version,source_timestamp,authority_state,lifecycle_state,
        payment_direction,payment_kind,counterparty_name,counterparty_role,bank_account_reference,bank_statement_date,
        bank_statement_line_fingerprint,finance_verification_status,finance_verified_at,finance_verification_note,
        fx_equivalent_amount,fx_equivalent_currency,fx_rate,fx_source_reference,
        deal_allocation_applicability,allocation_review_status,candidate_deal_ids
      ) values(
        v_payment_key,v_payment_id,null,'RECEIVED_UNVERIFIED',v_effective_at,v_amount,v_currency::char(3),
        null,null,'Owner-confirmed incoming receipt from approved Finance atomic canonical state; bank statement pending.','PAID','OPEN',
        'OWNER_CONFIRMED_FINANCE_AI_V7','ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',v_proposal.created_at,'CONFIRMED','ACTIVE',
        'INCOMING','CLIENT_PAYMENT',null,'CLIENT',null,null,
        null,'VERIFIED',v_effective_at,'Owner-confirmed Finance fact; later bank statement must reconcile to this payment without duplication.',
        null,null,null,null,
        'DEAL_ALLOCATABLE','VERIFIED',array[v_deal.deal_id]
      );

      insert into portal_private.payment_allocations(
        id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,
        accounting_closure_status,allocation_reference,allocated_at,allocated_by,source_system,source_version,
        source_timestamp,authority_state,lifecycle_state
      ) values(
        v_allocation_id,v_payment_key,v_deal.client_key,v_deal.contract_key,v_deal.id,v_amount,'ALLOCATED','PAID',
        'OPEN','FINANCE_ATOMIC_OWNER_CONFIRMED_RECEIPT:'||v_proposal.record_id::text||':'||v_idx::text,
        v_effective_at,null,'OWNER_CONFIRMED_FINANCE_AI_V7','ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',
        v_proposal.created_at,'CONFIRMED','ACTIVE'
      );

      insert into portal_private.payment_business_attributions_v7(
        id,payment_key,classification,attribution_mode,decision_type,authority_kind,authority_source_ref,
        business_scope_refs,scope_deal_keys,lines_snapshot,materialization_status,authority_state,lifecycle_state,
        effective_at,supersedes_authority_refs,source_version,source_timestamp,source_refs,source_locked,
        actor_id,actor_role,idempotency_key,correlation_id
      ) values(
        v_attr_id,v_payment_key,'RESOLVED','EXACT','BIND_TO_DEAL','FINANCE_OWNER_CONFIRMED_RECEIPT',
        'BUSINESS_CHANGE_PROPOSAL:'||v_proposal.record_id::text,
        array['BUSINESS_CHANGE_PROPOSAL:'||v_proposal.record_id::text],array[v_deal.id],
        jsonb_build_array(jsonb_build_object('deal_key',v_deal.id::text,'amount',v_amount,'currency',v_currency,'amount_status','EXACT','source_refs',v_source_refs)),
        'MATERIALIZED','AUTHORITATIVE','CURRENT',v_effective_at,'[]'::jsonb,
        'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',v_proposal.created_at,v_source_refs,true,
        'AI-FINANCE','FINANCE',v_receipt_idem,v_corr
      );

      insert into portal_private.finance_events_v7(
        event_type,event_identity,deal_key,payment_key,actor_id,actor_role,correlation_id,idempotency_key,
        payload_hash,expected_current_authority_id,source_refs,source_version,source_timestamp,effective_at,request_snapshot,result_snapshot
      ) values(
        'OWNER_CONFIRMED_RECEIPT_MATERIALIZED','OWNER_CONFIRMED_RECEIPT:'||v_payment_id,
        v_deal.id,v_payment_key,'AI-FINANCE','FINANCE',v_corr,v_receipt_idem,
        md5(r::text||v_proposal.record_id::text),null,v_source_refs,
        'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',v_proposal.created_at,v_effective_at,
        jsonb_build_object('finance_proposal_id',v_proposal.record_id,'operations_decision_id',v_approval.record_id,'receipt_index',v_idx,'receipt',r),
        jsonb_build_object('accepted',true,'materialized',true,'deal_id',v_deal.deal_id,'payment_id',v_payment_id,'payment_key',v_payment_key,'allocation_id',v_allocation_id,'amount',v_amount,'currency',v_currency,'bank_fact_status','RECEIVED_UNVERIFIED')
      );
      v_receipt_count := v_receipt_count + 1;
    end loop;

    for d in select key as deal_id, value as state from jsonb_each(v_per_deal) order by key loop
      if jsonb_typeof(d.state) <> 'object' then raise exception 'PER_DEAL_STATE_INVALID:%',d.deal_id; end if;
      select * into v_deal from portal_private.deals where deal_id=d.deal_id and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by updated_at desc limit 1;
      if not found then raise exception 'PER_DEAL_NOT_FOUND:%',d.deal_id; end if;
      select count(*) into v_current_count
      from portal_private.deal_finance_authority_v7 a
      where a.deal_key=v_deal.id and a.source_locked=true
        and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
        and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'));
      if v_current_count<>1 then raise exception 'CURRENT_FINANCE_AUTHORITY_REQUIRED:%',d.deal_id; end if;
      select * into v_current from portal_private.deal_finance_authority_v7 a
      where a.deal_key=v_deal.id and a.source_locked=true
        and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
        and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
        and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'))
      limit 1;

      v_currency := upper(btrim(v_current.obligation_currency::text));
      v_currency_l := lower(v_currency);
      v_received := coalesce(nullif(d.state->>('received_'||v_currency_l),'')::numeric, v_current.total_to_receive - v_current.due_now - v_current.expected_not_due - v_current.future_conditional);
      v_due := coalesce(nullif(d.state->>('due_now_'||v_currency_l),'')::numeric, v_current.due_now);
      v_cond := coalesce(nullif(d.state->>('conditional_'||v_currency_l),'')::numeric, v_current.future_conditional);
      v_expected := v_current.total_to_receive - v_received - v_due - v_cond;
      if abs(v_expected) < 0.01 then v_expected := 0; end if;
      if v_received < -0.01 or v_due < -0.01 or v_cond < -0.01 or v_expected < -0.01 then
        raise exception 'PER_DEAL_BUCKET_INTEGRITY:%',d.deal_id;
      end if;
      v_actual := coalesce(nullif(d.state->>('actual_spend_'||v_currency_l),'')::numeric, v_current.actual_spend);
      v_remaining := case
        when d.state ? ('funding_residual_'||v_currency_l) then nullif(d.state->>('funding_residual_'||v_currency_l),'')::numeric
        when d.state ? ('funding_gap_'||v_currency_l) then -1 * nullif(d.state->>('funding_gap_'||v_currency_l),'')::numeric
        else v_current.remaining_execution
      end;
      v_finance_status := upper(coalesce(nullif(d.state->>'finance_status',''), case when v_due>0 then 'DUE' when v_received>=v_current.total_to_receive-0.01 then 'PAID' when v_received>0 then 'PARTIAL' else 'NOT_DUE' end));
      if v_finance_status not in ('NOT_DUE','DUE','PARTIAL','PAID','OVERDUE','DISPUTED') then
        raise exception 'PER_DEAL_FINANCE_STATUS_INVALID:%',d.deal_id;
      end if;
      v_documentary_status := case when exists(select 1 from jsonb_array_elements(v_receipts) rr where rr->>'deal_id'=d.deal_id) then 'BANK_STATEMENT_PENDING' else coalesce(v_current.documentary_status,'TO_VERIFY') end;
      v_authority_idem := 'finance-atomic-authority:'||v_proposal.record_id::text||':'||d.deal_id;
      if exists(select 1 from portal_private.finance_events_v7 where actor_id='AI-FINANCE' and idempotency_key=v_authority_idem) then continue; end if;
      v_authority_id := gen_random_uuid();
      insert into portal_private.deal_finance_authority_v7(
        id,deal_key,total_to_receive,due_now,expected_not_due,future_conditional,
        obligation_currency,contractual_payment_currency,mixed_inbound_accounting_currency,
        actual_spend,actual_spend_status,remaining_execution,remaining_execution_status,execution_currency,execution_status,
        finance_status,documentary_status,authority_state,lifecycle_state,effective_at,supersedes_id,
        supersedes_authority_refs,source_version,source_timestamp,source_refs,source_locked,
        actor_id,actor_role,correlation_id,idempotency_key
      ) values(
        v_authority_id,v_current.deal_key,v_current.total_to_receive,v_due,v_expected,v_cond,
        v_current.obligation_currency,v_current.contractual_payment_currency,v_current.mixed_inbound_accounting_currency,
        v_actual,case when v_actual is null then v_current.actual_spend_status else 'AUTHORITATIVE' end,
        v_remaining,case when v_remaining is null then v_current.remaining_execution_status else 'AUTHORITATIVE' end,
        case when v_actual is null and v_remaining is null then v_current.execution_currency else v_currency::char(3) end,
        case when v_actual is null and v_remaining is null then v_current.execution_status when v_remaining<0 then 'CONFIRMED_SPEND_BEFORE_CLIENT_RECEIPT' else 'CONFIRMED_EXECUTION_STATE' end,
        v_finance_status,v_documentary_status,'AUTHORITATIVE','CURRENT',v_effective_at,v_current.id,
        coalesce(v_current.supersedes_authority_refs,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('source_type','FINANCE_AUTHORITY','source_id',v_current.id::text)),
        'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',v_proposal.created_at,
        coalesce(v_current.source_refs,'[]'::jsonb)||v_source_refs,true,
        'AI-FINANCE','FINANCE',v_corr,v_authority_idem
      );
      insert into portal_private.finance_events_v7(
        event_type,event_identity,deal_key,payment_key,actor_id,actor_role,correlation_id,idempotency_key,
        payload_hash,expected_current_authority_id,source_refs,source_version,source_timestamp,effective_at,request_snapshot,result_snapshot
      ) values(
        'DEAL_FINANCE_CANONICAL_STATE_MATERIALIZED','DEAL_FINANCE_CANONICAL_STATE:'||d.deal_id,
        v_deal.id,null,'AI-FINANCE','FINANCE',v_corr,v_authority_idem,
        md5(d.state::text||v_proposal.record_id::text),v_current.id,v_source_refs,
        'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',v_proposal.created_at,v_effective_at,
        jsonb_build_object('finance_proposal_id',v_proposal.record_id,'operations_decision_id',v_approval.record_id,'deal_id',d.deal_id,'state',d.state),
        jsonb_build_object('accepted',true,'materialized',true,'deal_id',d.deal_id,'finance_authority_id',v_authority_id,'supersedes_id',v_current.id,'due_now',v_due,'expected_not_due',v_expected,'future_conditional',v_cond,'actual_spend',v_actual,'remaining_execution',v_remaining)
      );
      v_authority_count := v_authority_count + 1;
    end loop;
  exception when others then
    v_error := left(sqlerrm,1000);
    update portal_private.finance_approved_change_jobs_v7
       set status='RETRY',last_error=v_error,result_snapshot=jsonb_build_object('accepted',false,'materialized',false,'reason_code','ATOMIC_PAYMENTS_V7_CANONICAL_STATE_ERROR','error',v_error),updated_at=clock_timestamp()
     where job_id=v_job.job_id;
    return jsonb_build_object('accepted',false,'materialized',false,'reason_code','ATOMIC_PAYMENTS_V7_CANONICAL_STATE_ERROR','error',v_error,'job_id',v_job.job_id);
  end;

  v_result := jsonb_build_object(
    'accepted',true,
    'materialized',true,
    'proposal_record_id',v_proposal.record_id,
    'approval_record_id',v_approval.record_id,
    'receipts_materialized',v_receipt_count,
    'finance_authorities_materialized',v_authority_count,
    'projection_refresh_required',true,
    'job_id',v_job.job_id
  );
  update portal_private.finance_approved_change_jobs_v7
     set status='MATERIALIZED',result_snapshot=v_result,last_error=null,updated_at=clock_timestamp()
   where job_id=v_job.job_id;
  return v_result;
end;
$function$;

grant execute on function portal_private.materialize_atomic_payments_v7_canonical_state_v1(uuid) to service_role;

create or replace function portal_private.trg_materialize_atomic_payments_v7_canonical_state_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  v_proposal_id uuid;
  v_action text;
begin
  if new.record_type='OPERATIONS_INTERNAL_DECISION'
     and new.functional_role::text='OPERATIONS_DIRECTOR'
     and coalesce(new.identity_id,'')='AI-OPERATIONS-DIRECTOR'
     and coalesce(new.qa_only,false)=false
     and new.status='APPROVE_FOR_NEXT_STAGE' then
    begin
      v_proposal_id := coalesce(nullif(new.payload->>'record_id','')::uuid, new.parent_record_id);
      select upper(coalesce(payload->>'proposed_action','')) into v_action
        from portal_private.ai_coordination_records
       where record_id=v_proposal_id;
      if v_action='ATOMIC_MATERIALIZE_PAYMENTS_V7_CANONICAL_STATE' then
        perform portal_private.materialize_atomic_payments_v7_canonical_state_v1(new.record_id);
      end if;
    exception when others then null;
    end;
  end if;
  return new;
end;
$function$;

drop trigger if exists materialize_atomic_payments_v7_canonical_state_v1 on portal_private.ai_coordination_records;
create trigger materialize_atomic_payments_v7_canonical_state_v1
after insert or update of status on portal_private.ai_coordination_records
for each row execute function portal_private.trg_materialize_atomic_payments_v7_canonical_state_v1();
