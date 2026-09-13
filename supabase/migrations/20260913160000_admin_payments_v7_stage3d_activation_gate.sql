-- Admin Payments V7 Stage 3D pre-production activation gate.
-- Branch migration only. PRODUCTION_DDL / DML / DEPLOY remain HOLD.
-- This patch runs after 20260913143000_admin_payments_v7_stage3a_authority.sql.

-- SCOPE_ONLY is a non-exact authority. It may carry a known Deal scope, a source-locked
-- non-Deal business scope, or an associated principal payment. It never carries exact lines.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'portal_private.payment_business_attributions_v7'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%attribution_mode%EXACT%SCOPE_ONLY%NO_DEAL_BINDING%'
  loop
    execute format('alter table portal_private.payment_business_attributions_v7 drop constraint %I', r.conname);
  end loop;
end $$;

alter table portal_private.payment_business_attributions_v7
  add constraint payment_business_attributions_v7_shape_ck check (
    (attribution_mode = 'EXACT'
      and jsonb_array_length(lines_snapshot) > 0
      and cardinality(scope_deal_keys) > 0)
    or (attribution_mode = 'SCOPE_ONLY'
      and jsonb_array_length(lines_snapshot) = 0
      and (
        cardinality(scope_deal_keys) > 0
        or cardinality(business_scope_refs) > 0
        or principal_payment_key is not null
      ))
    or (attribution_mode = 'NO_DEAL_BINDING'
      and jsonb_array_length(lines_snapshot) = 0
      and cardinality(scope_deal_keys) = 0)
  ),
  add constraint payment_business_attributions_v7_principal_not_self_ck
    check (principal_payment_key is null or principal_payment_key <> payment_key);

create or replace function portal_private.validate_payment_business_attribution_v7()
returns trigger
language plpgsql
as $$
declare
  payment_amount numeric;
  payment_currency text;
  scope_count integer;
  scope_distinct integer;
  existing_scope_count integer;
  line_count integer;
  line_distinct integer;
  existing_line_count integer;
  line_sum numeric;
begin
  select p.amount::numeric, upper(btrim(p.currency::text))
    into payment_amount, payment_currency
  from portal_private.payments p
  where p.id = new.payment_key;

  if not found then raise exception 'PAYMENT_AUTHORITY_PAYMENT_NOT_FOUND'; end if;
  if payment_amount is null or payment_amount <= 0 then raise exception 'PAYMENT_AUTHORITY_PAYMENT_AMOUNT_INVALID'; end if;
  if not portal_private.admin_payments_v7_valid_currency(payment_currency) then
    raise exception 'PAYMENT_AUTHORITY_PAYMENT_CURRENCY_INVALID';
  end if;

  select count(*), count(distinct scope.deal_key)
    into scope_count, scope_distinct
  from unnest(new.scope_deal_keys) as scope(deal_key);
  if scope_count <> scope_distinct then raise exception 'PAYMENT_AUTHORITY_DUPLICATE_SCOPE_DEAL'; end if;

  select count(*) into existing_scope_count
  from portal_private.deals d
  where d.id = any(new.scope_deal_keys);
  if existing_scope_count <> scope_count then raise exception 'PAYMENT_AUTHORITY_SCOPE_DEAL_INVALID'; end if;

  if new.attribution_mode = 'EXACT' then
    if exists (
      select 1
      from jsonb_array_elements(new.lines_snapshot) item
      where jsonb_typeof(item) <> 'object'
         or item->>'deal_key' is null
         or item->>'amount' is null
         or item->>'currency' is null
         or coalesce(item->>'amount_status','EXACT') <> 'EXACT'
         or (item->>'amount')::numeric <= 0
         or not portal_private.admin_payments_v7_valid_currency(upper(btrim(item->>'currency')))
         or upper(btrim(item->>'currency')) <> payment_currency
    ) then raise exception 'PAYMENT_AUTHORITY_EXACT_LINE_INVALID'; end if;

    select count(*), count(distinct (item->>'deal_key')::uuid), coalesce(sum((item->>'amount')::numeric),0)
      into line_count, line_distinct, line_sum
    from jsonb_array_elements(new.lines_snapshot) item;

    if line_count = 0 or line_count <> line_distinct then raise exception 'PAYMENT_AUTHORITY_DUPLICATE_EXACT_DEAL'; end if;

    select count(*) into existing_line_count
    from portal_private.deals d
    where d.id in (
      select distinct (item->>'deal_key')::uuid
      from jsonb_array_elements(new.lines_snapshot) item
    );
    if existing_line_count <> line_distinct then raise exception 'PAYMENT_AUTHORITY_EXACT_DEAL_INVALID'; end if;
    if line_sum <> payment_amount then raise exception 'PAYMENT_AUTHORITY_EXACT_COVERAGE_MISMATCH'; end if;

    if scope_count <> line_distinct
       or exists (
         select 1 from unnest(new.scope_deal_keys) as scope(deal_key)
         where not exists (
           select 1 from jsonb_array_elements(new.lines_snapshot) item
           where (item->>'deal_key')::uuid = scope.deal_key
         )
       )
       or exists (
         select 1 from jsonb_array_elements(new.lines_snapshot) item
         where not ((item->>'deal_key')::uuid = any(new.scope_deal_keys))
       ) then
      raise exception 'PAYMENT_AUTHORITY_SCOPE_LINES_MISMATCH';
    end if;

  elsif new.attribution_mode = 'SCOPE_ONLY' then
    if jsonb_array_length(new.lines_snapshot) <> 0
       or (
         scope_count = 0
         and cardinality(new.business_scope_refs) = 0
         and new.principal_payment_key is null
       ) then
      raise exception 'PAYMENT_AUTHORITY_SCOPE_ONLY_INVALID';
    end if;

  elsif new.attribution_mode = 'NO_DEAL_BINDING' then
    if jsonb_array_length(new.lines_snapshot) <> 0 or scope_count <> 0 then
      raise exception 'PAYMENT_AUTHORITY_NO_DEAL_BINDING_INVALID';
    end if;
  else
    raise exception 'PAYMENT_AUTHORITY_MODE_INVALID';
  end if;

  return new;
end;
$$;

-- Least-privilege read role for the direct postgres.js V7 snapshot transaction.
-- Production currently connects SUPABASE_DB_URL as postgres; the reader switches each
-- transaction to this NOLOGIN role so the V7 read path is constrained after DDL activation.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rona_payments_v7_reader') then
    create role rona_payments_v7_reader nologin noinherit;
  end if;
end $$;

grant rona_payments_v7_reader to postgres;
grant usage on schema portal_private to rona_payments_v7_reader;

grant select on table
  portal_private.deals,
  portal_private.owner_deal_workflow,
  portal_private.clients,
  portal_private.contracts,
  portal_private.payments,
  portal_private.payment_allocations,
  portal_private.payment_allocation_authority_history_v1,
  portal_private.owner_outgoing_payment_facts,
  portal_private.payment_business_attributions_v7,
  portal_private.payment_business_attribution_lines_v7,
  portal_private.deal_finance_authority_v7
  to rona_payments_v7_reader;

do $$
begin
  if to_regclass('portal_private.payment_resource_chains_v7') is not null then
    grant select on table portal_private.payment_resource_chains_v7 to rona_payments_v7_reader;
  end if;
end $$;

-- Application-facing roles receive no direct authority/audit reads or writes from this migration.
revoke all on table portal_private.payment_business_attributions_v7 from public, anon, authenticated, service_role;
revoke all on table portal_private.payment_business_attribution_lines_v7 from public, anon, authenticated, service_role;
revoke all on table portal_private.deal_finance_authority_v7 from public, anon, authenticated, service_role;
revoke all on table portal_private.owner_payment_decision_audit_v7 from public, anon, authenticated, service_role, rona_payments_v7_reader;

-- Validation helpers and the dormant Owner mutation primitive are not callable by app clients.
revoke execute on function portal_private.admin_payments_v7_valid_currency(text) from public, anon, authenticated, service_role, rona_payments_v7_reader;
revoke execute on function portal_private.validate_payment_business_attribution_v7() from public, anon, authenticated, service_role, rona_payments_v7_reader;
revoke execute on function portal_private.reject_v7_authority_mutation() from public, anon, authenticated, service_role, rona_payments_v7_reader;
revoke execute on function portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb) from public, anon, authenticated, service_role, rona_payments_v7_reader;

-- Explicitly constrain the reader to SELECT only on the new V7 relations.
revoke insert, update, delete, truncate, references, trigger
  on table portal_private.payment_business_attributions_v7,
           portal_private.deal_finance_authority_v7
  from rona_payments_v7_reader;
revoke all on table portal_private.owner_payment_decision_audit_v7 from rona_payments_v7_reader;
