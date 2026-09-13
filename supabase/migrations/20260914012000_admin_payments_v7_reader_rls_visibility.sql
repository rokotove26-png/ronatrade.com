-- Admin Payments V7 reader visibility correction.
-- Repository candidate only. Production deploy remains HOLD.
-- Scope: read-only SELECT/RLS for the dedicated NOLOGIN reader.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rona_payments_v7_reader') then
    create role rona_payments_v7_reader nologin noinherit;
  end if;
end $$;

grant usage on schema portal_private to rona_payments_v7_reader;
grant select on table
  portal_private.payments,
  portal_private.payment_allocations,
  portal_private.payment_allocation_authority_history_v1
  to rona_payments_v7_reader;

-- These relations already have RLS enabled in production. The prior SELECT grant alone was
-- insufficient: without an applicable SELECT policy PostgreSQL returns an empty visible set.
-- The source reader itself applies the current/verified filters; this policy only restores
-- row visibility to the dedicated read-only role.
drop policy if exists admin_payments_v7_reader_payments_select
  on portal_private.payments;
create policy admin_payments_v7_reader_payments_select
  on portal_private.payments
  for select
  to rona_payments_v7_reader
  using (true);

drop policy if exists admin_payments_v7_reader_payment_allocations_select
  on portal_private.payment_allocations;
create policy admin_payments_v7_reader_payment_allocations_select
  on portal_private.payment_allocations
  for select
  to rona_payments_v7_reader
  using (true);

drop policy if exists admin_payments_v7_reader_allocation_history_select
  on portal_private.payment_allocation_authority_history_v1;
create policy admin_payments_v7_reader_allocation_history_select
  on portal_private.payment_allocation_authority_history_v1
  for select
  to rona_payments_v7_reader
  using (true);

revoke insert, update, delete, truncate, references, trigger
  on table portal_private.payments,
           portal_private.payment_allocations,
           portal_private.payment_allocation_authority_history_v1
  from rona_payments_v7_reader;
