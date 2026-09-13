\set ON_ERROR_STOP on
create schema if not exists portal_private;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end$$;
\ir ../supabase/migrations/20260913040500_finance_accounting_currency_execution_links_v6.sql

do $$
declare rid uuid; denied boolean:=false;
begin
 insert into portal_private.finance_deal_execution_accounting_currency_links_v6(deal_id,execution_payment_id,accounting_currency,accounting_amount,execution_native_amount,execution_native_currency,execution_state,bank_source_reference,treasury_source_reference,source_version,source_timestamp)
 values('DEAL-QA','PAY-QA','USD',100,8700,'RUB','COMPLETED','BANK-QA','TREASURY-QA','QA-V6',now()) returning id into rid;
 begin update portal_private.finance_deal_execution_accounting_currency_links_v6 set accounting_amount=101 where id=rid; exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'IMMUTABILITY_NOT_ENFORCED'; end if;
 if has_table_privilege('authenticated','portal_private.finance_deal_execution_accounting_currency_links_v6','INSERT') then raise exception 'AUTHENTICATED_WRITE_ALLOWED'; end if;
 if has_table_privilege('service_role','portal_private.finance_deal_execution_accounting_currency_links_v6','INSERT') then raise exception 'SERVICE_ROLE_WRITE_ALLOWED'; end if;
 if not has_table_privilege('service_role','portal_private.finance_deal_execution_accounting_currency_links_v6','SELECT') then raise exception 'SERVICE_ROLE_SELECT_MISSING'; end if;
end$$;
\echo GENERIC_ACCOUNTING_CURRENCY_EVIDENCE_CONTRACT=PASS
\echo IMMUTABLE_ACCOUNTING_CURRENCY_EVIDENCE=PASS
\echo RUNTIME_READ_ONLY_EVIDENCE=PASS
