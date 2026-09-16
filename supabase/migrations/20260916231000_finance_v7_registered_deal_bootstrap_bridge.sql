-- Finance V7 registered-deal bootstrap bridge.
-- Purpose: materialize the initial Finance-authoritative Payments V7 projection
-- from already-authoritative registered-deal finance summary + accepted payment plan.
-- Fail-closed: no non-zero receipts, no incomplete plan, no mixed currencies,
-- no existing current Finance authority, no inactive Finance global policy.

create or replace function portal_private.bootstrap_registered_deal_finance_authority_v7(p_deal_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  v_deal portal_private.deals%rowtype;
  v_summary portal_private.owner_deal_finance_summary%rowtype;
  v_current_id uuid;
  v_existing_id uuid;
  v_registration_id uuid;
  v_application_id text;
  v_plan_count integer:=0;
  v_plan_expected_count integer:=0;
  v_plan_sum numeric:=0;
  v_plan_currency_count integer:=0;
  v_expected numeric:=0;
  v_conditional numeric:=0;
  v_total numeric;
  v_currency text;
  v_policy_id text;
  v_policies jsonb;
  v_policy jsonb;
  v_primary jsonb;
  v_authority_id uuid;
  v_source_refs jsonb;
  v_source_timestamp timestamptz;
  v_idempotency_key text;
begin
  if nullif(btrim(p_deal_id),'') is null then
    return jsonb_build_object('materialized',false,'reason_code','DEAL_ID_REQUIRED');
  end if;

  select * into v_deal
    from portal_private.deals
   where deal_id=p_deal_id
     and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and authority_state='CONFIRMED'::portal_private.authority_state_enum
   order by updated_at desc limit 1;
  if not found then
    return jsonb_build_object('materialized',false,'reason_code','ACTIVE_CONFIRMED_DEAL_REQUIRED');
  end if;

  select a.id into v_current_id
    from portal_private.deal_finance_authority_v7 a
   where a.deal_key=v_deal.id and a.source_locked=true
     and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
     and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
     and not exists(
       select 1 from portal_private.deal_finance_authority_v7 n
        where n.supersedes_id=a.id and n.source_locked=true
          and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
          and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
     ) limit 1;
  if v_current_id is not null then
    return jsonb_build_object('materialized',false,'reason_code','CURRENT_AUTHORITY_ALREADY_EXISTS','authority_id',v_current_id);
  end if;

  v_idempotency_key:='finance-bootstrap:'||v_deal.id::text;
  select id into v_existing_id
    from portal_private.deal_finance_authority_v7
   where deal_key=v_deal.id and idempotency_key=v_idempotency_key limit 1;
  if v_existing_id is not null then
    return jsonb_build_object('materialized',false,'reason_code','IDEMPOTENT_REPLAY','authority_id',v_existing_id);
  end if;

  select * into v_summary
    from portal_private.owner_deal_finance_summary
   where deal_id=p_deal_id and authority_state='CONFIRMED' and lifecycle_state='ACTIVE' limit 1;
  if not found
     or v_summary.obligation_amount is null or v_summary.obligation_amount<0
     or v_summary.received_amount is null or v_summary.received_amount<0
     or v_summary.client_remaining_amount is null or v_summary.client_remaining_amount<0
     or btrim(v_summary.currency::text)!~'^[A-Z]{3}$' then
    return jsonb_build_object('materialized',false,'reason_code','AUTHORITATIVE_OWNER_FINANCE_SUMMARY_REQUIRED');
  end if;

  -- Never infer an initial allocation once a receipt already exists.
  if v_summary.received_amount<>0 or v_summary.client_remaining_amount<>v_summary.obligation_amount then
    return jsonb_build_object('materialized',false,'reason_code','NONZERO_RECEIPT_REQUIRES_FINANCE_REVIEW');
  end if;

  v_total:=v_summary.obligation_amount;
  v_currency:=upper(btrim(v_summary.currency::text));

  select count(*),
         count(*) filter(where upper(coalesce(p.status,''))='EXPECTED'),
         coalesce(sum(p.planned_amount),0),
         count(distinct upper(btrim(p.currency::text)))
    into v_plan_count,v_plan_expected_count,v_plan_sum,v_plan_currency_count
    from portal_private.owner_payment_plan p where p.deal_key=v_deal.id;

  if v_plan_count=0
     or v_plan_expected_count<>v_plan_count
     or v_plan_sum<>v_total
     or v_plan_currency_count<>1
     or exists(select 1 from portal_private.owner_payment_plan p where p.deal_key=v_deal.id and upper(btrim(p.currency::text))<>v_currency)
     or exists(select 1 from portal_private.owner_payment_plan p where p.deal_key=v_deal.id and (p.planned_amount is null or p.planned_amount<0)) then
    return jsonb_build_object('materialized',false,'reason_code','AUTHORITATIVE_PAYMENT_PLAN_NOT_READY');
  end if;

  -- Derive buckets from authoritative accepted terms, never from UI or deal-specific constants.
  select
    coalesce(sum(p.planned_amount) filter(where not (
      lower(coalesce(p.share_text,'')) ~ '(против|against|гу-12|смгс|фактическ|после[^;]*(документ|отгруз|погруз|вагон|цистерн|гу-12|смгс))'
    )),0),
    coalesce(sum(p.planned_amount) filter(where (
      lower(coalesce(p.share_text,'')) ~ '(против|against|гу-12|смгс|фактическ|после[^;]*(документ|отгруз|погруз|вагон|цистерн|гу-12|смгс))'
    )),0)
    into v_expected,v_conditional
    from portal_private.owner_payment_plan p where p.deal_key=v_deal.id;

  if v_expected<0 or v_conditional<0 or v_expected+v_conditional<>v_total then
    return jsonb_build_object('materialized',false,'reason_code','PAYMENT_BUCKET_INTEGRITY_ERROR');
  end if;

  select portal_private.ai_role_global_policies_current_v1('FINANCE'::portal_private.ai_business_role_enum) into v_policies;
  select value into v_policy
    from jsonb_array_elements(coalesce(v_policies,'[]'::jsonb)) p(value)
   where coalesce(p.value->>'policy_key',p.value->'policy'->>'policy_key')='FINANCE_GLOBAL_PAYMENT_SEMANTICS'
   order by coalesce((p.value->>'version')::integer,(p.value->'policy'->>'version')::integer,0) desc limit 1;
  v_policy_id:=coalesce(v_policy->>'policy_id',v_policy->'policy'->>'policy_id');
  v_primary:=coalesce(v_policy->'policy'->'rules'->'FUNDING_CURRENCY_PRIMARY_SEMANTICS',v_policy->'rules'->'FUNDING_CURRENCY_PRIMARY_SEMANTICS','{}'::jsonb);
  if v_policy_id is null
     or upper(coalesce(v_primary->>'actual_spend_owner',''))<>'FINANCE'
     or upper(coalesce(v_primary->>'remaining_owner',''))<>'FINANCE'
     or lower(coalesce(v_primary->>'finance_authoritative_zero_when_no_actual_expense','false'))<>'true' then
    return jsonb_build_object('materialized',false,'reason_code','FINANCE_GLOBAL_POLICY_REQUIRED');
  end if;

  select dr.id,ca.application_id into v_registration_id,v_application_id
    from portal_private.deal_registrations dr
    join portal_private.client_applications ca on ca.id=dr.application_key
   where dr.deal_key=v_deal.id order by dr.registered_at desc limit 1;

  v_source_timestamp:=greatest(
    coalesce(v_summary.source_timestamp,'epoch'::timestamptz),
    coalesce((select max(coalesce(p.updated_at,p.created_at)) from portal_private.owner_payment_plan p where p.deal_key=v_deal.id),'epoch'::timestamptz),
    coalesce(v_deal.source_timestamp,'epoch'::timestamptz)
  );
  if v_source_timestamp='epoch'::timestamptz then v_source_timestamp:=now(); end if;

  select coalesce(jsonb_agg(x.obj order by x.sort_key),'[]'::jsonb) into v_source_refs
    from (
      select '01-summary' sort_key,jsonb_build_object('source_type','OWNER_DEAL_FINANCE_SUMMARY','source_id',v_summary.id::text) obj
      union all select '02-registration',jsonb_build_object('source_type','DEAL_REGISTRATION','source_id',v_registration_id::text) where v_registration_id is not null
      union all select '03-application',jsonb_build_object('source_type','APPLICATION','source_id',v_application_id) where v_application_id is not null
      union all select '04-policy',jsonb_build_object('source_type','GLOBAL_ROLE_POLICY','source_id',v_policy_id)
      union all select '10-plan-'||lpad(p.tranche_no::text,4,'0'),jsonb_build_object('source_type','OWNER_PAYMENT_PLAN','source_id',p.id::text)
        from portal_private.owner_payment_plan p where p.deal_key=v_deal.id
    ) x;

  v_authority_id:=gen_random_uuid();
  insert into portal_private.deal_finance_authority_v7(
    id,deal_key,total_to_receive,due_now,expected_not_due,future_conditional,
    obligation_currency,contractual_payment_currency,mixed_inbound_accounting_currency,
    finance_status,documentary_status,authority_state,lifecycle_state,effective_at,
    supersedes_id,supersedes_authority_refs,source_version,source_timestamp,source_refs,source_locked,
    actor_id,actor_role,correlation_id,idempotency_key,
    actual_spend,actual_spend_status,remaining_execution,remaining_execution_status,execution_currency,execution_status
  ) values(
    v_authority_id,v_deal.id,v_total,0,v_expected,v_conditional,
    v_currency::char(3),v_currency::char(3),null,
    case when v_total=0 then 'PAID' else 'NOT_DUE' end,'TO_VERIFY','AUTHORITATIVE','CURRENT',v_source_timestamp,
    null,'[]'::jsonb,v_policy_id,v_source_timestamp,v_source_refs,true,
    'AI-FINANCE','FINANCE',gen_random_uuid(),v_idempotency_key,
    0,'AUTHORITATIVE',0,'AUTHORITATIVE',v_currency::char(3),'CONFIRMED_ZERO_RECEIPT_PENDING'
  );

  return jsonb_build_object(
    'materialized',true,'authority_id',v_authority_id,'deal_id',p_deal_id,
    'total_to_receive',v_total,'due_now',0,'expected_not_due',v_expected,
    'future_conditional',v_conditional,'currency',v_currency,'source_version',v_policy_id
  );
exception when unique_violation then
  select id into v_existing_id from portal_private.deal_finance_authority_v7
   where deal_key=v_deal.id and idempotency_key=v_idempotency_key limit 1;
  return jsonb_build_object('materialized',false,'reason_code','IDEMPOTENT_REPLAY','authority_id',v_existing_id);
end
$function$;

revoke all on function portal_private.bootstrap_registered_deal_finance_authority_v7(text) from public;

create or replace function portal_private.trg_bootstrap_registered_deal_finance_v7_from_plan()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare v_deal_id text;
begin
  select d.deal_id into v_deal_id from portal_private.deals d where d.id=new.deal_key;
  if v_deal_id is not null then perform portal_private.bootstrap_registered_deal_finance_authority_v7(v_deal_id); end if;
  return new;
end
$function$;
revoke all on function portal_private.trg_bootstrap_registered_deal_finance_v7_from_plan() from public;

drop trigger if exists owner_payment_plan_bootstrap_finance_v7 on portal_private.owner_payment_plan;
create trigger owner_payment_plan_bootstrap_finance_v7
after insert or update on portal_private.owner_payment_plan
for each row execute function portal_private.trg_bootstrap_registered_deal_finance_v7_from_plan();

create or replace function portal_private.trg_bootstrap_registered_deal_finance_v7_from_summary()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog','portal_private'
as $function$
begin
  perform portal_private.bootstrap_registered_deal_finance_authority_v7(new.deal_id);
  return new;
end
$function$;
revoke all on function portal_private.trg_bootstrap_registered_deal_finance_v7_from_summary() from public;

drop trigger if exists owner_finance_summary_bootstrap_finance_v7 on portal_private.owner_deal_finance_summary;
create trigger owner_finance_summary_bootstrap_finance_v7
after insert or update on portal_private.owner_deal_finance_summary
for each row execute function portal_private.trg_bootstrap_registered_deal_finance_v7_from_summary();

-- Backfill only records that pass every fail-closed bootstrap invariant.
select portal_private.bootstrap_registered_deal_finance_authority_v7(d.deal_id)
from portal_private.deals d
join portal_private.owner_deal_finance_summary s on s.deal_id=d.deal_id
where d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  and d.authority_state='CONFIRMED'::portal_private.authority_state_enum
  and s.authority_state='CONFIRMED' and s.lifecycle_state='ACTIVE'
  and not exists(
    select 1 from portal_private.deal_finance_authority_v7 a
     where a.deal_key=d.id and a.source_locked=true
       and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
       and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
       and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true)
  );
