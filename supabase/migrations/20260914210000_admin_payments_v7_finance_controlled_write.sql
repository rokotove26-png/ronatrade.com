-- Admin Payments V7 — Finance AI controlled write contract.
-- Owner architectural decision: OWNER source -> FINANCE AI source-lock -> structured Finance event
-- -> canonical portal storage -> Payments V7 projection -> UI.
-- No bank feed, no browser authority, no synthetic FX and no manual KPI mutation.

create table if not exists portal_private.finance_events_v7 (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'CLIENT_PAYMENT_CONFIRMED',
    'DEAL_FINANCIAL_OBLIGATION_CONFIRMED',
    'DEAL_PAYMENT_SCHEDULE_CONFIRMED',
    'PAYMENT_TRIGGER_CONFIRMED',
    'OUTGOING_PAYMENT_CONFIRMED',
    'OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED',
    'PAYMENT_RESOURCE_CHAIN_CONFIRMED',
    'DOCUMENTARY_STATUS_CONFIRMED'
  )),
  event_identity text not null,
  deal_key uuid null references portal_private.deals(id) on delete restrict,
  payment_key uuid null references portal_private.payments(id) on delete restrict,
  actor_id text not null check (actor_id='AI-FINANCE'),
  actor_role text not null check (actor_role='FINANCE'),
  correlation_id uuid not null,
  idempotency_key text not null,
  payload_hash text not null,
  expected_current_authority_id uuid null,
  source_refs jsonb not null check (jsonb_typeof(source_refs)='array' and jsonb_array_length(source_refs)>0),
  source_version text not null check (btrim(source_version)<>''),
  source_timestamp timestamptz not null,
  effective_at timestamptz not null,
  request_snapshot jsonb not null check (jsonb_typeof(request_snapshot)='object'),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot)='object'),
  created_at timestamptz not null default now(),
  unique(actor_id,idempotency_key)
);

create table if not exists portal_private.payment_resource_chains_v7 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id) on delete restrict,
  deal_key uuid not null references portal_private.deals(id) on delete restrict,
  native_amount numeric(24,8) not null check (native_amount>0),
  native_currency char(3) not null check (native_currency~'^[A-Z]{3}$'),
  accounting_amount numeric(24,8) not null check (accounting_amount>0),
  accounting_currency char(3) not null check (accounting_currency~'^[A-Z]{3}$'),
  conversion_source_basis text not null check (btrim(conversion_source_basis)<>''),
  source_locked boolean not null default true check (source_locked),
  authority_state text not null default 'AUTHORITATIVE' check (authority_state='AUTHORITATIVE'),
  lifecycle_state text not null default 'CURRENT' check (lifecycle_state='CURRENT'),
  effective_at timestamptz not null,
  supersedes_id uuid null references portal_private.payment_resource_chains_v7(id) on delete restrict,
  supersedes_authority_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(supersedes_authority_refs)='array'),
  source_refs jsonb not null check (jsonb_typeof(source_refs)='array' and jsonb_array_length(source_refs)>0),
  source_version text not null check (btrim(source_version)<>''),
  source_timestamp timestamptz not null,
  actor_id text not null check (actor_id='AI-FINANCE'),
  actor_role text not null check (actor_role='FINANCE'),
  correlation_id uuid not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(payment_key,deal_key,idempotency_key)
);

alter table portal_private.deal_finance_authority_v7 add column if not exists actor_id text;
alter table portal_private.deal_finance_authority_v7 add column if not exists actor_role text;
alter table portal_private.deal_finance_authority_v7 add column if not exists correlation_id uuid;
alter table portal_private.deal_finance_authority_v7 add column if not exists idempotency_key text;
alter table portal_private.payment_business_attributions_v7 add column if not exists correlation_id uuid;
create unique index if not exists deal_finance_authority_v7_finance_idem_uidx
  on portal_private.deal_finance_authority_v7(deal_key,idempotency_key)
  where idempotency_key is not null;

create trigger finance_events_v7_immutable
before update or delete on portal_private.finance_events_v7
for each row execute function portal_private.reject_v7_authority_mutation();
create trigger payment_resource_chains_v7_immutable
before update or delete on portal_private.payment_resource_chains_v7
for each row execute function portal_private.reject_v7_authority_mutation();

create or replace function portal_private.persist_finance_event_v7(p_actor jsonb,p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_event_type text:=upper(coalesce(p_event->>'event_type',''));
  v_actor_id text:=coalesce(p_actor->>'identity_id','');
  v_actor_role text:=upper(coalesce(p_actor->>'role',''));
  v_correlation uuid;
  v_idem text:=coalesce(p_event->>'idempotency_key','');
  v_payload jsonb:=coalesce(p_event->'payload','{}'::jsonb);
  v_source_refs jsonb:=coalesce(p_event->'source_refs','[]'::jsonb);
  v_source_version text:=coalesce(p_event->>'source_version','');
  v_source_timestamp timestamptz;
  v_effective_at timestamptz;
  v_payload_hash text:=md5(coalesce(p_event::text,''));
  v_existing portal_private.finance_events_v7%rowtype;
  v_deal portal_private.deals%rowtype;
  v_deal_id text:=nullif(btrim(coalesce(p_event->>'deal_id','')),'');
  v_payment portal_private.payments%rowtype;
  v_payment_id text:=nullif(btrim(coalesce(p_event->>'payment_id','')),'');
  v_payment_key uuid;
  v_expected uuid;
  v_current_finance portal_private.deal_finance_authority_v7%rowtype;
  v_current_finance_count integer:=0;
  v_current_attr portal_private.payment_business_attributions_v7%rowtype;
  v_current_attr_count integer:=0;
  v_current_chain portal_private.payment_resource_chains_v7%rowtype;
  v_current_chain_count integer:=0;
  v_new_authority uuid;
  v_new_payment uuid;
  v_new_allocation uuid;
  v_new_attr uuid;
  v_new_chain uuid;
  v_total numeric;
  v_due numeric;
  v_expected_amount numeric;
  v_conditional numeric;
  v_currency text;
  v_contract_currency text;
  v_finance_status text;
  v_documentary_status text;
  v_amount numeric;
  v_payment_currency text;
  v_payment_kind text;
  v_bank_reference text;
  v_counterparty text;
  v_attribution_mode text;
  v_lines jsonb:='[]'::jsonb;
  v_scope uuid[]:='{}'::uuid[];
  v_scope_count integer:=0;
  v_line_count integer:=0;
  v_line_sum numeric:=0;
  v_result jsonb;
  v_native_amount numeric;
  v_accounting_amount numeric;
  v_accounting_currency text;
  v_basis text;
  v_line_amount numeric;
begin
  if v_actor_role<>'FINANCE' or v_actor_id<>'AI-FINANCE' then
    return jsonb_build_object('accepted',false,'reason_code','FINANCE_ROLE_BINDING_REQUIRED','action_class','TECHNICAL_MATERIALIZATION_REQUIRED');
  end if;
  begin v_correlation:=(p_actor->>'correlation_id')::uuid; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','CORRELATION_ID_REQUIRED','action_class','TECHNICAL_MATERIALIZATION_REQUIRED');
  end;
  if v_event_type not in ('CLIENT_PAYMENT_CONFIRMED','DEAL_FINANCIAL_OBLIGATION_CONFIRMED','DEAL_PAYMENT_SCHEDULE_CONFIRMED','PAYMENT_TRIGGER_CONFIRMED','OUTGOING_PAYMENT_CONFIRMED','OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED','PAYMENT_RESOURCE_CHAIN_CONFIRMED','DOCUMENTARY_STATUS_CONFIRMED') then
    return jsonb_build_object('accepted',false,'reason_code','FINANCE_EVENT_TYPE_UNSUPPORTED','action_class','FINANCE_ACTION_REQUIRED');
  end if;
  if v_idem !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$' then
    return jsonb_build_object('accepted',false,'reason_code','IDEMPOTENCY_KEY_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end if;
  if jsonb_typeof(v_payload)<>'object' or jsonb_typeof(v_source_refs)<>'array' or jsonb_array_length(v_source_refs)=0 or btrim(v_source_version)='' then
    return jsonb_build_object('accepted',false,'reason_code','SOURCE_LOCK_INCOMPLETE','action_class','FINANCE_ACTION_REQUIRED');
  end if;
  begin v_source_timestamp:=(p_event->>'source_timestamp')::timestamptz; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','SOURCE_TIMESTAMP_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end;
  begin v_effective_at:=(p_event->>'effective_at')::timestamptz; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','EFFECTIVE_AT_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end;
  begin v_expected:=nullif(p_event->>'expected_current_authority_id','')::uuid; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','EXPECTED_AUTHORITY_ID_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end;

  perform pg_advisory_xact_lock(hashtext('finance-v7:'||v_actor_id||':'||v_idem));
  select * into v_existing from portal_private.finance_events_v7 where actor_id=v_actor_id and idempotency_key=v_idem limit 1;
  if found then
    if v_existing.payload_hash<>v_payload_hash then
      return jsonb_build_object('accepted',false,'reason_code','FINANCE_EVENT_IDEMPOTENCY_CONFLICT','action_class','FINANCE_ACTION_REQUIRED');
    end if;
    return v_existing.result_snapshot||jsonb_build_object('idempotent_replay',true,'finance_event_id',v_existing.id);
  end if;

  if v_deal_id is not null then
    select * into v_deal from portal_private.deals where deal_id=v_deal_id and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by updated_at desc limit 1;
    if not found then
      return jsonb_build_object('accepted',false,'reason_code','DEAL_NOT_FOUND','action_class','FINANCE_ACTION_REQUIRED');
    end if;
  end if;
  if v_payment_id is not null then
    select * into v_payment from portal_private.payments where payment_id=v_payment_id and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum limit 1;
    if found then v_payment_key:=v_payment.id; end if;
  end if;

  if v_event_type in ('DEAL_FINANCIAL_OBLIGATION_CONFIRMED','DEAL_PAYMENT_SCHEDULE_CONFIRMED','PAYMENT_TRIGGER_CONFIRMED','DOCUMENTARY_STATUS_CONFIRMED') then
    if v_deal_id is null then return jsonb_build_object('accepted',false,'reason_code','DEAL_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    select count(*) into v_current_finance_count
      from portal_private.deal_finance_authority_v7 a
     where a.deal_key=v_deal.id and a.source_locked=true
       and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
       and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
       and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'));
    if v_current_finance_count<>1 then return jsonb_build_object('accepted',false,'reason_code',case when v_current_finance_count=0 then 'CURRENT_FINANCE_AUTHORITY_REQUIRED' else 'FINANCE_AUTHORITY_CONFLICT' end,'action_class','FINANCE_ACTION_REQUIRED'); end if;
    select * into v_current_finance
      from portal_private.deal_finance_authority_v7 a
     where a.deal_key=v_deal.id and a.source_locked=true
       and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
       and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
       and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'))
     limit 1;
    if v_expected is null or v_expected<>v_current_finance.id then
      return jsonb_build_object('accepted',false,'reason_code','STALE_AUTHORITY','action_class','FINANCE_ACTION_REQUIRED','current_authority_id',v_current_finance.id);
    end if;

    v_total:=v_current_finance.total_to_receive;
    v_due:=v_current_finance.due_now;
    v_expected_amount:=v_current_finance.expected_not_due;
    v_conditional:=v_current_finance.future_conditional;
    v_currency:=upper(btrim(v_current_finance.obligation_currency::text));
    v_contract_currency:=upper(btrim(coalesce(v_current_finance.contractual_payment_currency::text,v_currency)));
    v_finance_status:=v_current_finance.finance_status;
    v_documentary_status:=v_current_finance.documentary_status;

    if v_event_type='DEAL_FINANCIAL_OBLIGATION_CONFIRMED' then
      if jsonb_typeof(v_payload->'total_to_receive')<>'number' then return jsonb_build_object('accepted',false,'reason_code','TOTAL_TO_RECEIVE_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
      v_total:=(v_payload->>'total_to_receive')::numeric;
      v_currency:=upper(coalesce(v_payload->>'currency',''));
      v_contract_currency:=upper(coalesce(v_payload->>'contractual_payment_currency',v_currency));
      v_finance_status:=coalesce(nullif(upper(v_payload->>'finance_status'),''),v_finance_status);
      if v_currency!~'^[A-Z]{3}$' or v_contract_currency!~'^[A-Z]{3}$' or v_total<0 then return jsonb_build_object('accepted',false,'reason_code','OBLIGATION_PAYLOAD_INVALID','action_class','FINANCE_ACTION_REQUIRED'); end if;
      if v_currency<>upper(btrim(v_current_finance.obligation_currency::text)) and (v_due<>0 or v_expected_amount<>0 or v_conditional<>0) then
        return jsonb_build_object('accepted',false,'reason_code','SCHEDULE_RECONFIRM_REQUIRED_FOR_CURRENCY_CHANGE','action_class','FINANCE_ACTION_REQUIRED');
      end if;
    elsif v_event_type in ('DEAL_PAYMENT_SCHEDULE_CONFIRMED','PAYMENT_TRIGGER_CONFIRMED') then
      if jsonb_typeof(v_payload->'due_now')<>'number' or jsonb_typeof(v_payload->'expected_not_due')<>'number' or jsonb_typeof(v_payload->'future_conditional')<>'number' then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_SCHEDULE_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
      v_due:=(v_payload->>'due_now')::numeric;
      v_expected_amount:=(v_payload->>'expected_not_due')::numeric;
      v_conditional:=(v_payload->>'future_conditional')::numeric;
      v_finance_status:=coalesce(nullif(upper(v_payload->>'finance_status'),''),v_finance_status);
    elsif v_event_type='DOCUMENTARY_STATUS_CONFIRMED' then
      v_documentary_status:=upper(coalesce(v_payload->>'documentary_status',''));
      if v_documentary_status not in ('CONFIRMED','TO_VERIFY','NOT_APPLICABLE') then return jsonb_build_object('accepted',false,'reason_code','DOCUMENTARY_STATUS_INVALID','action_class','FINANCE_ACTION_REQUIRED'); end if;
    end if;
    if v_total<0 or v_due<0 or v_expected_amount<0 or v_conditional<0 or v_due+v_expected_amount+v_conditional>v_total then
      return jsonb_build_object('accepted',false,'reason_code','FINANCE_BUCKET_INTEGRITY_ERROR','action_class','FINANCE_ACTION_REQUIRED');
    end if;

    v_new_authority:=gen_random_uuid();
    insert into portal_private.deal_finance_authority_v7(
      id,deal_key,total_to_receive,due_now,expected_not_due,future_conditional,obligation_currency,contractual_payment_currency,mixed_inbound_accounting_currency,
      finance_status,documentary_status,authority_state,lifecycle_state,effective_at,supersedes_id,supersedes_authority_refs,source_version,source_timestamp,source_refs,source_locked,
      actor_id,actor_role,correlation_id,idempotency_key
    ) values(
      v_new_authority,v_deal.id,v_total,v_due,v_expected_amount,v_conditional,v_currency::char(3),v_contract_currency::char(3),v_current_finance.mixed_inbound_accounting_currency,
      v_finance_status,v_documentary_status,'AUTHORITATIVE','CURRENT',v_effective_at,v_current_finance.id,
      jsonb_build_array(jsonb_build_object('source_type','FINANCE_AUTHORITY','source_id',v_current_finance.id::text)),v_source_version,v_source_timestamp,v_source_refs,true,
      v_actor_id,v_actor_role,v_correlation,v_idem
    );
    v_result:=jsonb_build_object('accepted',true,'event_type',v_event_type,'deal_id',v_deal_id,'authority_id',v_new_authority,'supersedes_id',v_current_finance.id,'projection_refresh_required',true);

  elsif v_event_type='CLIENT_PAYMENT_CONFIRMED' then
    if v_deal_id is null or v_payment_id is null then return jsonb_build_object('accepted',false,'reason_code','DEAL_AND_PAYMENT_ID_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if v_payment_key is not null then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_ID_ALREADY_EXISTS','action_class','FINANCE_ACTION_REQUIRED','payment_id',v_payment_id); end if;
    if jsonb_typeof(v_payload->'amount')<>'number' then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_AMOUNT_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    v_amount:=(v_payload->>'amount')::numeric; v_payment_currency:=upper(coalesce(v_payload->>'currency','')); v_bank_reference:=nullif(btrim(coalesce(v_payload->>'bank_transaction_reference','')),''); v_counterparty:=nullif(btrim(coalesce(v_payload->>'counterparty_name','')),'');
    if v_amount<=0 or v_payment_currency!~'^[A-Z]{3}$' or v_bank_reference is null then return jsonb_build_object('accepted',false,'reason_code','CLIENT_PAYMENT_PAYLOAD_INVALID','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if to_regprocedure('portal_private.resolve_deal_resource_state(uuid)') is not null and exists(select 1 from portal_private.resolve_deal_resource_state(v_deal.id) r where coalesce(r.resource_status,'RESOURCE_PENDING')<>'RESOURCE_CONFIRMED') then
      return jsonb_build_object('accepted',false,'reason_code','RESOURCE_CONFIRMATION_REQUIRED_BEFORE_PAYMENT','action_class','FINANCE_ACTION_REQUIRED');
    end if;
    v_new_payment:=gen_random_uuid(); v_new_allocation:=gen_random_uuid();
    insert into portal_private.payments(id,payment_id,bank_transaction_reference,bank_fact_status,payment_at,amount,currency,payer_name,beneficiary_name,original_payment_purpose,finance_status,accounting_closure_status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,payment_direction,payment_kind,counterparty_name,counterparty_role,bank_account_reference,bank_statement_date,bank_statement_line_fingerprint,finance_verification_status,finance_verified_at,finance_verification_note,fx_equivalent_amount,fx_equivalent_currency,fx_rate,fx_source_reference,deal_allocation_applicability,allocation_review_status,candidate_deal_ids)
    values(v_new_payment,v_payment_id,v_bank_reference,'BANK_CONFIRMED',v_effective_at,v_amount,v_payment_currency::char(3),v_counterparty,nullif(v_payload->>'beneficiary_name',''),nullif(v_payload->>'payment_purpose',''),'PAID','OPEN','FINANCE_AI_V7',v_source_version,v_source_timestamp,'CONFIRMED','ACTIVE','INCOMING','CLIENT_PAYMENT',v_counterparty,'CLIENT',nullif(v_payload->>'bank_account_reference',''),case when nullif(v_payload->>'bank_statement_date','') is null then null else (v_payload->>'bank_statement_date')::date end,nullif(v_payload->>'bank_statement_line_fingerprint',''),'VERIFIED',v_effective_at,'AI-FINANCE source-locked confirmation',null,null,null,null,'DEAL_ALLOCATABLE','VERIFIED',array[v_deal_id]);
    insert into portal_private.payment_allocations(id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,accounting_closure_status,allocation_reference,allocated_at,allocated_by,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
    values(v_new_allocation,v_new_payment,v_deal.client_key,v_deal.contract_key,v_deal.id,v_amount,'VERIFIED','PAID','OPEN','FINANCE_EVENT:'||v_idem,v_effective_at,null,'FINANCE_AI_V7',v_source_version,v_source_timestamp,'CONFIRMED','ACTIVE');
    v_payment_key:=v_new_payment;
    v_result:=jsonb_build_object('accepted',true,'event_type',v_event_type,'deal_id',v_deal_id,'payment_id',v_payment_id,'payment_key',v_new_payment,'allocation_id',v_new_allocation,'projection_refresh_required',true);

  elsif v_event_type='OUTGOING_PAYMENT_CONFIRMED' then
    if v_payment_id is null then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_ID_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if v_payment_key is not null then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_ID_ALREADY_EXISTS','action_class','FINANCE_ACTION_REQUIRED','payment_id',v_payment_id); end if;
    if jsonb_typeof(v_payload->'amount')<>'number' then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_AMOUNT_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    v_amount:=(v_payload->>'amount')::numeric; v_payment_currency:=upper(coalesce(v_payload->>'currency','')); v_payment_kind:=upper(coalesce(v_payload->>'payment_kind','COUNTERPARTY_PAYMENT')); v_bank_reference:=nullif(btrim(coalesce(v_payload->>'bank_transaction_reference','')),''); v_counterparty:=nullif(btrim(coalesce(v_payload->>'beneficiary','')),''); v_attribution_mode:=upper(coalesce(v_payload->>'attribution_mode',''));
    if v_amount<=0 or v_payment_currency!~'^[A-Z]{3}$' or v_bank_reference is null or v_payment_kind not in ('COUNTERPARTY_PAYMENT','BANK_FEE','OTHER','INTERNAL_TRANSFER') or v_attribution_mode not in ('EXACT','SCOPE_ONLY') then return jsonb_build_object('accepted',false,'reason_code','OUTGOING_PAYMENT_PAYLOAD_INVALID','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if v_attribution_mode='EXACT' then
      if jsonb_typeof(v_payload->'lines')<>'array' or jsonb_array_length(v_payload->'lines')=0 then return jsonb_build_object('accepted',false,'reason_code','EXACT_ALLOCATION_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
      select coalesce(jsonb_agg(jsonb_build_object('deal_key',d.id::text,'amount',(x->>'amount')::numeric,'currency',v_payment_currency,'amount_status','EXACT','source_refs',v_source_refs) order by x->>'deal_id'),'[]'::jsonb),coalesce(array_agg(d.id order by x->>'deal_id'),'{}'::uuid[]),count(*),coalesce(sum((x->>'amount')::numeric),0)
        into v_lines,v_scope,v_line_count,v_line_sum from jsonb_array_elements(v_payload->'lines') x join portal_private.deals d on d.deal_id=x->>'deal_id' and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;
      if v_line_count<>jsonb_array_length(v_payload->'lines') or v_line_sum<>v_amount then return jsonb_build_object('accepted',false,'reason_code','EXACT_ALLOCATION_INVALID','action_class','FINANCE_ACTION_REQUIRED'); end if;
    else
      if jsonb_typeof(v_payload->'scope_deal_ids')<>'array' or jsonb_array_length(v_payload->'scope_deal_ids')=0 then return jsonb_build_object('accepted',false,'reason_code','KNOWN_SCOPE_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
      select coalesce(array_agg(d.id order by j.value),'{}'::uuid[]),count(*) into v_scope,v_scope_count from jsonb_array_elements_text(v_payload->'scope_deal_ids') j(value) join portal_private.deals d on d.deal_id=j.value and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;
      if v_scope_count<>jsonb_array_length(v_payload->'scope_deal_ids') then return jsonb_build_object('accepted',false,'reason_code','KNOWN_SCOPE_DEAL_NOT_FOUND','action_class','FINANCE_ACTION_REQUIRED'); end if;
    end if;
    v_new_payment:=gen_random_uuid(); v_new_attr:=gen_random_uuid();
    insert into portal_private.payments(id,payment_id,bank_transaction_reference,bank_fact_status,payment_at,amount,currency,payer_name,beneficiary_name,original_payment_purpose,finance_status,accounting_closure_status,source_system,source_version,source_timestamp,authority_state,lifecycle_state,payment_direction,payment_kind,counterparty_name,counterparty_role,bank_account_reference,bank_statement_date,bank_statement_line_fingerprint,finance_verification_status,finance_verified_at,finance_verification_note,fx_equivalent_amount,fx_equivalent_currency,fx_rate,fx_source_reference,deal_allocation_applicability,allocation_review_status,candidate_deal_ids)
    values(v_new_payment,v_payment_id,v_bank_reference,'BANK_CONFIRMED',v_effective_at,v_amount,v_payment_currency::char(3),null,v_counterparty,nullif(v_payload->>'payment_purpose',''),'PAID','OPEN','FINANCE_AI_V7',v_source_version,v_source_timestamp,'CONFIRMED','ACTIVE','OUTGOING',v_payment_kind::portal_private.payment_kind_enum,v_counterparty,'COUNTERPARTY',nullif(v_payload->>'bank_account_reference',''),case when nullif(v_payload->>'bank_statement_date','') is null then null else (v_payload->>'bank_statement_date')::date end,nullif(v_payload->>'bank_statement_line_fingerprint',''),'VERIFIED',v_effective_at,'AI-FINANCE source-locked confirmation',null,null,null,null,'DEAL_ALLOCATABLE',(case when v_attribution_mode='EXACT' then 'VERIFIED' else 'TO_VERIFY' end)::portal_private.allocation_review_state_enum,array(select d.deal_id from portal_private.deals d where d.id=any(v_scope) order by d.deal_id));
    insert into portal_private.payment_business_attributions_v7(id,payment_key,classification,attribution_mode,decision_type,authority_kind,authority_source_ref,business_scope_refs,scope_deal_keys,lines_snapshot,materialization_status,authority_state,lifecycle_state,effective_at,supersedes_authority_refs,source_version,source_timestamp,source_refs,source_locked,actor_id,actor_role,idempotency_key,correlation_id)
    values(v_new_attr,v_new_payment,case when v_attribution_mode='EXACT' and cardinality(v_scope)>1 then 'KNOWN_MULTI_DEAL_EXACT_SPLIT' when v_attribution_mode='EXACT' then 'RESOLVED' else 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY' end,v_attribution_mode,null,'FINANCE_AI','FINANCE_EVENT:'||v_idem,array['FINANCE_EVENT:'||v_idem],v_scope,v_lines,'MATERIALIZED','AUTHORITATIVE','CURRENT',v_effective_at,'[]'::jsonb,v_source_version,v_source_timestamp,v_source_refs,true,v_actor_id,v_actor_role,v_idem,v_correlation);
    v_payment_key:=v_new_payment;
    v_result:=jsonb_build_object('accepted',true,'event_type',v_event_type,'payment_id',v_payment_id,'payment_key',v_new_payment,'attribution_id',v_new_attr,'attribution_mode',v_attribution_mode,'projection_refresh_required',true);

  elsif v_event_type='OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED' then
    if v_payment_key is null then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_NOT_FOUND','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if upper(v_payment.payment_direction::text)<>'OUTGOING' then return jsonb_build_object('accepted',false,'reason_code','OUTGOING_PAYMENT_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    select count(*) into v_current_attr_count from portal_private.payment_business_attributions_v7 a where a.payment_key=v_payment_key and a.source_locked=true and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE') and not exists(select 1 from portal_private.payment_business_attributions_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'));
    if v_current_attr_count>1 then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_ATTRIBUTION_CONFLICT','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if v_current_attr_count=1 then
      select * into v_current_attr from portal_private.payment_business_attributions_v7 a where a.payment_key=v_payment_key and a.source_locked=true and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE') and not exists(select 1 from portal_private.payment_business_attributions_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')) limit 1;
      if v_expected is null or v_expected<>v_current_attr.id then return jsonb_build_object('accepted',false,'reason_code','STALE_AUTHORITY','action_class','FINANCE_ACTION_REQUIRED','current_authority_id',v_current_attr.id); end if;
    elsif v_expected is not null then return jsonb_build_object('accepted',false,'reason_code','STALE_AUTHORITY','action_class','FINANCE_ACTION_REQUIRED','current_authority_id',null); end if;
    v_amount:=v_payment.amount; v_payment_currency:=upper(btrim(v_payment.currency::text)); v_attribution_mode:=upper(coalesce(v_payload->>'attribution_mode',''));
    if v_attribution_mode='EXACT' then
      if jsonb_typeof(v_payload->'lines')<>'array' or jsonb_array_length(v_payload->'lines')=0 then return jsonb_build_object('accepted',false,'reason_code','EXACT_ALLOCATION_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
      select coalesce(jsonb_agg(jsonb_build_object('deal_key',d.id::text,'amount',(x->>'amount')::numeric,'currency',v_payment_currency,'amount_status','EXACT','source_refs',v_source_refs) order by x->>'deal_id'),'[]'::jsonb),coalesce(array_agg(d.id order by x->>'deal_id'),'{}'::uuid[]),count(*),coalesce(sum((x->>'amount')::numeric),0) into v_lines,v_scope,v_line_count,v_line_sum from jsonb_array_elements(v_payload->'lines') x join portal_private.deals d on d.deal_id=x->>'deal_id' and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;
      if v_line_count<>jsonb_array_length(v_payload->'lines') or v_line_sum<>v_amount then return jsonb_build_object('accepted',false,'reason_code','EXACT_ALLOCATION_INVALID','action_class','FINANCE_ACTION_REQUIRED'); end if;
    elsif v_attribution_mode='SCOPE_ONLY' then
      if jsonb_typeof(v_payload->'scope_deal_ids')<>'array' or jsonb_array_length(v_payload->'scope_deal_ids')=0 then return jsonb_build_object('accepted',false,'reason_code','KNOWN_SCOPE_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
      select coalesce(array_agg(d.id order by j.value),'{}'::uuid[]),count(*) into v_scope,v_scope_count from jsonb_array_elements_text(v_payload->'scope_deal_ids') j(value) join portal_private.deals d on d.deal_id=j.value and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;
      if v_scope_count<>jsonb_array_length(v_payload->'scope_deal_ids') then return jsonb_build_object('accepted',false,'reason_code','KNOWN_SCOPE_DEAL_NOT_FOUND','action_class','FINANCE_ACTION_REQUIRED'); end if;
    else return jsonb_build_object('accepted',false,'reason_code','ATTRIBUTION_MODE_INVALID','action_class','FINANCE_ACTION_REQUIRED'); end if;
    v_new_attr:=gen_random_uuid();
    insert into portal_private.payment_business_attributions_v7(id,payment_key,classification,attribution_mode,decision_type,authority_kind,authority_source_ref,business_scope_refs,scope_deal_keys,lines_snapshot,materialization_status,authority_state,lifecycle_state,effective_at,supersedes_id,supersedes_authority_refs,source_version,source_timestamp,source_refs,source_locked,actor_id,actor_role,idempotency_key,correlation_id)
    values(v_new_attr,v_payment_key,case when v_attribution_mode='EXACT' and cardinality(v_scope)>1 then 'KNOWN_MULTI_DEAL_EXACT_SPLIT' when v_attribution_mode='EXACT' then 'RESOLVED' else 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY' end,v_attribution_mode,null,'FINANCE_AI','FINANCE_EVENT:'||v_idem,array['FINANCE_EVENT:'||v_idem],v_scope,v_lines,'MATERIALIZED','AUTHORITATIVE','CURRENT',v_effective_at,case when v_current_attr_count=1 then v_current_attr.id else null end,case when v_current_attr_count=1 then jsonb_build_array(jsonb_build_object('source_type','PAYMENT_ATTRIBUTION','source_id',v_current_attr.id::text)) else '[]'::jsonb end,v_source_version,v_source_timestamp,v_source_refs,true,v_actor_id,v_actor_role,v_idem,v_correlation);
    v_result:=jsonb_build_object('accepted',true,'event_type',v_event_type,'payment_id',v_payment_id,'payment_key',v_payment_key,'attribution_id',v_new_attr,'supersedes_id',case when v_current_attr_count=1 then v_current_attr.id else null end,'projection_refresh_required',true);

  elsif v_event_type='PAYMENT_RESOURCE_CHAIN_CONFIRMED' then
    if v_payment_key is null or v_deal_id is null then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_AND_DEAL_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if upper(v_payment.payment_direction::text)<>'OUTGOING' then return jsonb_build_object('accepted',false,'reason_code','OUTGOING_PAYMENT_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    select count(*) into v_current_attr_count from portal_private.payment_business_attributions_v7 a where a.payment_key=v_payment_key and a.source_locked=true and a.attribution_mode='EXACT' and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE') and not exists(select 1 from portal_private.payment_business_attributions_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'));
    if v_current_attr_count<>1 then return jsonb_build_object('accepted',false,'reason_code','EXACT_PAYMENT_ATTRIBUTION_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    select * into v_current_attr from portal_private.payment_business_attributions_v7 a where a.payment_key=v_payment_key and a.source_locked=true and a.attribution_mode='EXACT' and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE') and not exists(select 1 from portal_private.payment_business_attributions_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')) limit 1;
    select (x->>'amount')::numeric into v_line_amount from jsonb_array_elements(v_current_attr.lines_snapshot)x where (x->>'deal_key')::uuid=v_deal.id limit 1;
    if v_line_amount is null then return jsonb_build_object('accepted',false,'reason_code','PAYMENT_DEAL_LINE_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    select count(*) into v_current_finance_count from portal_private.deal_finance_authority_v7 a where a.deal_key=v_deal.id and a.source_locked=true and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE') and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE'));
    if v_current_finance_count<>1 then return jsonb_build_object('accepted',false,'reason_code','CURRENT_FINANCE_AUTHORITY_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    select * into v_current_finance from portal_private.deal_finance_authority_v7 a where a.deal_key=v_deal.id and a.source_locked=true and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')) limit 1;
    if jsonb_typeof(v_payload->'native_amount')<>'number' or jsonb_typeof(v_payload->'accounting_amount')<>'number' then return jsonb_build_object('accepted',false,'reason_code','RESOURCE_CHAIN_AMOUNTS_REQUIRED','action_class','FINANCE_ACTION_REQUIRED'); end if;
    v_native_amount:=(v_payload->>'native_amount')::numeric; v_payment_currency:=upper(coalesce(v_payload->>'native_currency','')); v_accounting_amount:=(v_payload->>'accounting_amount')::numeric; v_accounting_currency:=upper(coalesce(v_payload->>'accounting_currency','')); v_basis:=upper(btrim(coalesce(v_payload->>'conversion_source_basis','')));
    if v_native_amount<>v_line_amount or v_payment_currency<>upper(btrim(v_payment.currency::text)) or v_accounting_currency<>upper(btrim(v_current_finance.obligation_currency::text)) or v_accounting_amount<=0 or v_basis='' then return jsonb_build_object('accepted',false,'reason_code','RESOURCE_CHAIN_SCOPE_MISMATCH','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if v_basis like '%CBR%' or v_basis like '%MARKET%' or v_basis like '%CONTRACTUAL_FX%' or v_basis like '%APPROX%' then return jsonb_build_object('accepted',false,'reason_code','SYNTHETIC_FX_FORBIDDEN','action_class','FINANCE_ACTION_REQUIRED'); end if;
    select count(*) into v_current_chain_count from portal_private.payment_resource_chains_v7 a where a.payment_key=v_payment_key and a.deal_key=v_deal.id and a.source_locked=true and not exists(select 1 from portal_private.payment_resource_chains_v7 n where n.supersedes_id=a.id and n.source_locked=true);
    if v_current_chain_count>1 then return jsonb_build_object('accepted',false,'reason_code','RESOURCE_CHAIN_AUTHORITY_CONFLICT','action_class','FINANCE_ACTION_REQUIRED'); end if;
    if v_current_chain_count=1 then select * into v_current_chain from portal_private.payment_resource_chains_v7 a where a.payment_key=v_payment_key and a.deal_key=v_deal.id and a.source_locked=true and not exists(select 1 from portal_private.payment_resource_chains_v7 n where n.supersedes_id=a.id and n.source_locked=true) limit 1; if v_expected is null or v_expected<>v_current_chain.id then return jsonb_build_object('accepted',false,'reason_code','STALE_AUTHORITY','action_class','FINANCE_ACTION_REQUIRED','current_authority_id',v_current_chain.id); end if; elsif v_expected is not null then return jsonb_build_object('accepted',false,'reason_code','STALE_AUTHORITY','action_class','FINANCE_ACTION_REQUIRED','current_authority_id',null); end if;
    v_new_chain:=gen_random_uuid();
    insert into portal_private.payment_resource_chains_v7(id,payment_key,deal_key,native_amount,native_currency,accounting_amount,accounting_currency,conversion_source_basis,source_locked,authority_state,lifecycle_state,effective_at,supersedes_id,supersedes_authority_refs,source_refs,source_version,source_timestamp,actor_id,actor_role,correlation_id,idempotency_key)
    values(v_new_chain,v_payment_key,v_deal.id,v_native_amount,v_payment_currency::char(3),v_accounting_amount,v_accounting_currency::char(3),v_basis,true,'AUTHORITATIVE','CURRENT',v_effective_at,case when v_current_chain_count=1 then v_current_chain.id else null end,case when v_current_chain_count=1 then jsonb_build_array(jsonb_build_object('source_type','RESOURCE_CHAIN','source_id',v_current_chain.id::text)) else '[]'::jsonb end,v_source_refs,v_source_version,v_source_timestamp,v_actor_id,v_actor_role,v_correlation,v_idem);
    v_result:=jsonb_build_object('accepted',true,'event_type',v_event_type,'deal_id',v_deal_id,'payment_id',v_payment_id,'resource_chain_id',v_new_chain,'supersedes_id',case when v_current_chain_count=1 then v_current_chain.id else null end,'projection_refresh_required',true);
  end if;

  if v_result is null then return jsonb_build_object('accepted',false,'reason_code','FINANCE_EVENT_NOT_MATERIALIZED','action_class','TECHNICAL_MATERIALIZATION_REQUIRED'); end if;
  insert into portal_private.finance_events_v7(event_type,event_identity,deal_key,payment_key,actor_id,actor_role,correlation_id,idempotency_key,payload_hash,expected_current_authority_id,source_refs,source_version,source_timestamp,effective_at,request_snapshot,result_snapshot)
  values(v_event_type,coalesce(v_payment_id,v_deal_id,v_event_type),case when v_deal_id is null then null else v_deal.id end,v_payment_key,v_actor_id,v_actor_role,v_correlation,v_idem,v_payload_hash,v_expected,v_source_refs,v_source_version,v_source_timestamp,v_effective_at,p_event,v_result);
  return v_result||jsonb_build_object('idempotent_replay',false);
end
$$;

revoke all on portal_private.finance_events_v7 from public,anon,authenticated,service_role;
revoke all on portal_private.payment_resource_chains_v7 from public,anon,authenticated,service_role;
revoke all on function portal_private.persist_finance_event_v7(jsonb,jsonb) from public,anon,authenticated,service_role;
grant select on portal_private.payment_resource_chains_v7 to rona_payments_v7_reader;

insert into portal_private.admin_payments_v7_provider_readiness(provider_key,is_ready,ready_at,validation_ref,updated_at)
values('PAYMENT_RESOURCE_CHAIN_AUTHORITY',true,now(),'FINANCE_CONTROLLED_WRITE_V1',now())
on conflict(provider_key) do update set is_ready=excluded.is_ready,ready_at=excluded.ready_at,validation_ref=excluded.validation_ref,updated_at=excluded.updated_at;
