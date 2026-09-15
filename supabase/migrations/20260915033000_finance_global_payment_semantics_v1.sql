-- RONA Trade / FINANCE global payment semantics.
-- SCOPE=GLOBAL_FINANCE_ROLE
-- NOT_TASK_SCOPED
-- BUSINESS_DATA_MUTATION=NONE
-- FINANCE_RECORD_MUTATION=NONE

create table if not exists portal_private.ai_role_global_policies_v1 (
  policy_id text primary key,
  policy_key text not null,
  policy_version integer not null check (policy_version > 0),
  functional_role portal_private.ai_business_role_enum not null,
  scope text not null,
  task_scoped boolean not null default false check (task_scoped = false),
  authority_kind text not null check (authority_kind = 'OWNER_INSTRUCTION'),
  owner_instruction_ref text not null unique,
  effective_at timestamptz not null,
  supersedes_policy_id text null references portal_private.ai_role_global_policies_v1(policy_id),
  policy jsonb not null check (jsonb_typeof(policy) = 'object'),
  created_at timestamptz not null default now(),
  unique (functional_role, policy_key, policy_version),
  check ((policy->>'policy_id') = policy_id),
  check ((policy->>'policy_key') = policy_key),
  check (((policy->>'version')::integer) = policy_version),
  check ((policy->>'scope') = scope),
  check ((policy->>'task_scoped')::boolean = false)
);

create or replace function portal_private.guard_ai_role_global_policy_v1()
returns trigger
language plpgsql
set search_path = portal_private, pg_catalog
as $$
declare
  v_prior portal_private.ai_role_global_policies_v1%rowtype;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'GLOBAL_ROLE_POLICY_IMMUTABLE_APPEND_SUPERSESSION_ONLY';
  end if;

  if new.authority_kind <> 'OWNER_INSTRUCTION'
     or new.owner_instruction_ref !~ '^OWNER_INSTRUCTION:' then
    raise exception 'GLOBAL_ROLE_POLICY_OWNER_INSTRUCTION_REQUIRED';
  end if;

  if new.policy_version = 1 then
    if new.supersedes_policy_id is not null then
      raise exception 'GLOBAL_ROLE_POLICY_V1_CANNOT_SUPERSEDE';
    end if;
  else
    if new.supersedes_policy_id is null then
      raise exception 'GLOBAL_ROLE_POLICY_VERSIONED_SUPERSESSION_REQUIRED';
    end if;

    select * into v_prior
    from portal_private.ai_role_global_policies_v1 p
    where p.policy_id = new.supersedes_policy_id;

    if not found
       or v_prior.functional_role <> new.functional_role
       or v_prior.policy_key <> new.policy_key
       or v_prior.policy_version <> new.policy_version - 1 then
      raise exception 'GLOBAL_ROLE_POLICY_INVALID_PREDECESSOR';
    end if;

    if exists (
      select 1
      from portal_private.ai_role_global_policies_v1 successor
      where successor.supersedes_policy_id = v_prior.policy_id
    ) then
      raise exception 'GLOBAL_ROLE_POLICY_PREDECESSOR_ALREADY_SUPERSEDED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_role_global_policies_v1_guard on portal_private.ai_role_global_policies_v1;
create trigger ai_role_global_policies_v1_guard
before insert or update or delete on portal_private.ai_role_global_policies_v1
for each row execute function portal_private.guard_ai_role_global_policy_v1();

insert into portal_private.ai_role_global_policies_v1 (
  policy_id,
  policy_key,
  policy_version,
  functional_role,
  scope,
  task_scoped,
  authority_kind,
  owner_instruction_ref,
  effective_at,
  supersedes_policy_id,
  policy
)
select
  'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1',
  'FINANCE_GLOBAL_PAYMENT_SEMANTICS',
  1,
  'FINANCE'::portal_private.ai_business_role_enum,
  'GLOBAL_FINANCE_ROLE',
  false,
  'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-09-15:FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1',
  timestamptz '2026-09-15 03:30:00+00',
  null,
  jsonb_build_object(
    'policy_id','FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1',
    'policy_key','FINANCE_GLOBAL_PAYMENT_SEMANTICS',
    'version',1,
    'scope','GLOBAL_FINANCE_ROLE',
    'task_scoped',false,
    'authority','OWNER_INSTRUCTION',
    'rules',jsonb_build_object(
      'FUNDING_CURRENCY_PRIMARY_SEMANTICS',jsonb_build_object(
        'primary_actual_spend_source','BANK_CONFIRMED_FUNDING_SIDE_DEBIT',
        'primary_currency','DEAL_FUNDING_CURRENCY',
        'settlement_amount_semantics','SECONDARY_ACTUAL_SETTLEMENT',
        'reverse_fx_as_primary','FORBIDDEN',
        'resource_chain_accounting_amount_as_primary','FORBIDDEN',
        'conversion_rate_role','LINK_CONFIRMATION_ONLY',
        'native_currency_residuals','PRESERVE_IN_NATIVE_CURRENCY',
        'missing_direct_funding_side','TO_VERIFY'
      ),
      'MULTI_DEAL_PROPORTIONAL_ALLOCATION',jsonb_build_object(
        'default_method','PROPORTIONAL_TO_CONFIRMED_SHARES',
        'classification','NORMAL_FINANCE_ALLOCATION',
        'separate_bank_split_required',false,
        'unconfirmed_deal_set_or_shares','TO_VERIFY',
        'authoritative_override','TAKES_PRECEDENCE',
        'synthetic_allocation',false
      )
    ),
    'applies_to',jsonb_build_array(
      'NEW_DEALS',
      'FUTURE_BANK_PAYMENTS',
      'FINANCE_CONCLUSIONS',
      'PAYMENTS_PROJECTION',
      'P_AND_L',
      'ACTUAL_SPEND',
      'REMAINING',
      'PAYMENT_PASSPORTS',
      'FUTURE_FINANCE_CHATS'
    ),
    'durability',jsonb_build_object(
      'survives_task_closure',true,
      'survives_new_finance_task',true,
      'survives_new_chat',true,
      'survives_coordination_history_compaction',true,
      'bootstrap_required',true,
      'load_before_active_task',true,
      'load_before_deal_drilldown',true
    ),
    'supersession',jsonb_build_object(
      'mode','APPEND_VERSION_ONLY',
      'required_authority','NEW_VERSIONED_OWNER_INSTRUCTION'
    )
  )
where not exists (
  select 1
  from portal_private.ai_role_global_policies_v1 p
  where p.policy_id = 'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1'
);

create or replace function portal_private.ai_role_global_policies_current_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language sql
stable security definer
set search_path = portal_private, pg_catalog
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'policy_id',p.policy_id,
        'policy_key',p.policy_key,
        'version',p.policy_version,
        'functional_role',p.functional_role::text,
        'scope',p.scope,
        'task_scoped',p.task_scoped,
        'authority_kind',p.authority_kind,
        'owner_instruction_ref',p.owner_instruction_ref,
        'effective_at',p.effective_at,
        'policy',p.policy
      )
      order by p.policy_key,p.policy_version
    ),
    '[]'::jsonb
  )
  from portal_private.ai_role_global_policies_v1 p
  where p.functional_role = p_role
    and not exists (
      select 1
      from portal_private.ai_role_global_policies_v1 successor
      where successor.supersedes_policy_id = p.policy_id
    )
$$;

create or replace function portal_private.finance_primary_spend_semantics_v1(
  p_bank_fact_status text,
  p_funding_leg_kind text,
  p_funding_amount numeric,
  p_funding_currency text,
  p_settlement_amount numeric default null,
  p_settlement_currency text default null,
  p_resource_chain_accounting_amount numeric default null,
  p_conversion_rate numeric default null
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_currency text := upper(btrim(coalesce(p_funding_currency,'')));
begin
  if upper(btrim(coalesce(p_bank_fact_status,''))) <> 'BANK_CONFIRMED' then
    return jsonb_build_object(
      'status','TO_VERIFY',
      'direct_funding_side',false,
      'reason','BANK_CONFIRMED_FUNDING_SIDE_DEBIT_REQUIRED',
      'funding_amount',null,
      'funding_currency',null
    );
  end if;

  if upper(btrim(coalesce(p_funding_leg_kind,''))) <> 'FUNDING_SIDE_DEBIT' then
    return jsonb_build_object(
      'status','TO_VERIFY',
      'direct_funding_side',false,
      'reason','NO_REVERSE_FX_AS_PRIMARY',
      'funding_amount',null,
      'funding_currency',null,
      'settlement_amount',p_settlement_amount,
      'settlement_currency',upper(btrim(coalesce(p_settlement_currency,'')))
    );
  end if;

  if p_funding_amount is null or p_funding_amount <= 0 or v_currency !~ '^[A-Z]{3}$' then
    return jsonb_build_object(
      'status','TO_VERIFY',
      'direct_funding_side',false,
      'reason','DIRECT_FUNDING_AMOUNT_OR_CURRENCY_INVALID',
      'funding_amount',null,
      'funding_currency',null
    );
  end if;

  return jsonb_build_object(
    'status','AUTHORITATIVE',
    'direct_funding_side',true,
    'funding_amount',p_funding_amount,
    'funding_currency',v_currency,
    'settlement_amount',p_settlement_amount,
    'settlement_currency',nullif(upper(btrim(coalesce(p_settlement_currency,''))),''),
    'conversion_rate',p_conversion_rate,
    'resource_chain_accounting_amount_ignored_for_primary',p_resource_chain_accounting_amount
  );
end;
$$;

create or replace function portal_private.finance_multi_deal_proportional_allocation_v1(
  p_funding_amount numeric,
  p_funding_currency text,
  p_direct_funding_side boolean,
  p_confirmed_shares jsonb,
  p_authoritative_override jsonb default null
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_basis jsonb;
  v_source text;
  v_sum numeric;
  v_count integer;
  v_distinct integer;
  v_allocations jsonb;
  v_currency text := upper(btrim(coalesce(p_funding_currency,'')));
begin
  if p_direct_funding_side is not true
     or p_funding_amount is null
     or p_funding_amount <= 0
     or v_currency !~ '^[A-Z]{3}$' then
    return jsonb_build_object(
      'status','TO_VERIFY',
      'reason','DIRECT_FUNDING_SIDE_REQUIRED',
      'allocations','[]'::jsonb
    );
  end if;

  if p_authoritative_override is not null
     and jsonb_typeof(p_authoritative_override) = 'array'
     and jsonb_array_length(p_authoritative_override) > 0 then
    v_basis := p_authoritative_override;
    v_source := 'AUTHORITATIVE_OVERRIDE';
  else
    v_basis := p_confirmed_shares;
    v_source := 'CONFIRMED_PROPORTIONAL_SHARES';
  end if;

  if v_basis is null or jsonb_typeof(v_basis) <> 'array' or jsonb_array_length(v_basis) < 2 then
    return jsonb_build_object('status','TO_VERIFY','reason','MULTI_DEAL_SHARES_REQUIRED','allocations','[]'::jsonb);
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_basis) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'deal_id','') = ''
       or coalesce((item->>'confirmed')::boolean,false) is not true
       or (item->>'share') is null
       or (item->>'share')::numeric <= 0
  ) then
    return jsonb_build_object('status','TO_VERIFY','reason','DEAL_SET_OR_SHARE_UNCONFIRMED','allocations','[]'::jsonb);
  end if;

  select count(*),count(distinct item->>'deal_id'),sum((item->>'share')::numeric)
    into v_count,v_distinct,v_sum
  from jsonb_array_elements(v_basis) item;

  if v_count <> v_distinct or v_sum <> 1 then
    return jsonb_build_object('status','TO_VERIFY','reason','CONFIRMED_SHARES_MUST_BE_UNIQUE_AND_SUM_TO_ONE','allocations','[]'::jsonb);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'deal_id',item->>'deal_id',
      'share',(item->>'share')::numeric,
      'funding_amount',p_funding_amount * (item->>'share')::numeric,
      'funding_currency',v_currency
    )
    order by item->>'deal_id'
  )
  into v_allocations
  from jsonb_array_elements(v_basis) item;

  return jsonb_build_object(
    'status','AUTHORITATIVE',
    'allocation_source',v_source,
    'synthetic_allocation',false,
    'allocations',coalesce(v_allocations,'[]'::jsonb)
  );
end;
$$;

create or replace function portal_private.ai_role_state_current_v2(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language plpgsql
stable security definer
set search_path = portal_private, pg_catalog
as $$
declare
  v_policies jsonb;
  v_cp jsonb;
  v_tasks jsonb;
  v_coord jsonb;
  v_task_limit int := greatest(1,least(coalesce(p_task_limit,10),20));
  v_coord_limit int := greatest(1,least(coalesce(p_coord_limit,20),20));
begin
  -- Global role policy is deliberately loaded before checkpoint/task state.
  v_policies := portal_private.ai_role_global_policies_current_v1(p_role);

  v_cp := coalesce(portal_private.ai_role_state_snapshot_v2(p_role),jsonb_build_object(
    'functional_role',p_role::text,'state_version',0,'last_confirmed_checkpoint','{}'::jsonb,'active_task_id',null,
    'open_delta','[]'::jsonb,'blockers','[]'::jsonb,'pending_actions','[]'::jsonb,'canonical_sources','[]'::jsonb,'metadata','{}'::jsonb,'updated_at',null
  ));

  select coalesce(jsonb_agg(x.obj order by x.updated_at desc),'[]'::jsonb) into v_tasks
  from (
    select t.updated_at,
      jsonb_build_object(
        'task_id',t.task_id,'title',left(t.title,240),'status',t.status::text,'priority',t.priority::text,
        'authority_domain',t.authority_domain,'source_type',t.source_type,'source_object_id',t.source_object_id,
        'due_at',t.due_at,'updated_at',t.updated_at
      ) obj
    from portal_private.staff_tasks t
    where t.qa_only=false
      and t.assigned_functional_role::text=p_role::text
      and t.status::text not in ('COMPLETED','REJECTED','CLOSED')
    order by t.updated_at desc
    limit v_task_limit
  ) x;

  select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb) into v_coord
  from (
    select r.created_at,
      jsonb_build_object(
        'record_id',r.record_id,'record_type',r.record_type,'from_role',r.functional_role::text,
        'target_role',r.target_role::text,'target_type',r.target_type,'target_id',r.target_id,
        'parent_record_id',r.parent_record_id,'version',r.version,'supersedes_id',r.supersedes_id,
        'status',r.status,'created_at',r.created_at
      ) obj
    from portal_private.ai_coordination_records r
    where r.qa_only=false
      and (
        r.functional_role=p_role or r.target_role=p_role or
        (p_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum and r.record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION') and r.target_type<>'SYSTEM')
      )
      and not exists(
        select 1 from portal_private.ai_coordination_records n
        where n.qa_only=false and n.supersedes_id=r.record_id
      )
    order by r.created_at desc
    limit v_coord_limit
  ) x;

  return jsonb_build_object(
    'data_contract','RONA_ROLE_STATE_RECOVERY_V2',
    'generated_at',now(),
    'functional_role',p_role::text,
    'global_role_policies',v_policies,
    'checkpoint',v_cp,
    'active_tasks',v_tasks,
    'coordination',jsonb_build_object('projection','LATEST_NON_SUPERSEDED','max_records',v_coord_limit,'records',v_coord,'heavy_fields_included',false),
    'bootstrap',jsonb_build_object(
      'precedence',jsonb_build_array('PRODUCTION_CANONICAL','GLOBAL_ROLE_POLICY','ROLE_CHECKPOINT','ACTIVE_TASK','EVENT_HISTORY','HANDOFF','CHAT_MEMORY'),
      'procedure',jsonb_build_array('READ_THIS_COMPACT_STATE','READ_GLOBAL_ROLE_POLICIES','APPLY_GLOBAL_ROLE_POLICIES_BEFORE_ACTIVE_TASK','CONTINUE_FROM_LAST_CONFIRMED_CHECKPOINT','DRILL_DOWN_ONLY_ACTIVE_OBJECTS','NEVER_RECONSTRUCT_FROM_CHAT_MEMORY_IF_CANONICAL_STATE_EXISTS'),
      'global_policy_count',jsonb_array_length(v_policies),
      'global_policy_must_apply_before_tasks',true,
      'history_included',false,
      'heavy_coordination_fields_included',false,
      'response_budget_bytes',20000
    )
  );
end
$$;

revoke all on table portal_private.ai_role_global_policies_v1 from public, anon, authenticated, service_role;
revoke execute on function portal_private.guard_ai_role_global_policy_v1() from public, anon, authenticated, service_role;
revoke execute on function portal_private.ai_role_global_policies_current_v1(portal_private.ai_business_role_enum) from public, anon, authenticated, service_role;
revoke execute on function portal_private.finance_primary_spend_semantics_v1(text,text,numeric,text,numeric,text,numeric,numeric) from public, anon, authenticated, service_role;
revoke execute on function portal_private.finance_multi_deal_proportional_allocation_v1(numeric,text,boolean,jsonb,jsonb) from public, anon, authenticated, service_role;
revoke execute on function portal_private.ai_role_state_current_v2(portal_private.ai_business_role_enum,integer,integer) from public, anon, authenticated, service_role;
