alter table portal_private.owner_claims
  add column if not exists claim_source text not null default 'ADMIN',
  add column if not exists response_sent_at timestamptz null,
  add column if not exists response_sent_by uuid null references portal_private.portal_users(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_claims_source_chk'
      and conrelid = 'portal_private.owner_claims'::regclass
  ) then
    alter table portal_private.owner_claims
      add constraint owner_claims_source_chk
      check (claim_source in ('ADMIN','CLIENT'));
  end if;
end $$;

create index if not exists owner_claims_source_status_idx
  on portal_private.owner_claims(claim_source,status,updated_at desc);

comment on column portal_private.owner_claims.claim_source
  is 'Claim originator: ADMIN = RONA Trade, CLIENT = client portal.';
