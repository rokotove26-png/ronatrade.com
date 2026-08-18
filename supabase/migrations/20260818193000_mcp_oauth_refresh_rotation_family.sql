alter table portal_private.mcp_oauth_tokens
  add column if not exists token_family_id uuid,
  add column if not exists parent_token_id uuid,
  add column if not exists rotated_to_token_id uuid,
  add column if not exists refresh_used_at timestamptz;

update portal_private.mcp_oauth_tokens
set token_family_id=gen_random_uuid()
where token_family_id is null;

alter table portal_private.mcp_oauth_tokens
  alter column token_family_id set default gen_random_uuid(),
  alter column token_family_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='mcp_oauth_tokens_parent_token_fk'
      and conrelid='portal_private.mcp_oauth_tokens'::regclass
  ) then
    alter table portal_private.mcp_oauth_tokens
      add constraint mcp_oauth_tokens_parent_token_fk
      foreign key(parent_token_id) references portal_private.mcp_oauth_tokens(token_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='mcp_oauth_tokens_rotated_to_token_fk'
      and conrelid='portal_private.mcp_oauth_tokens'::regclass
  ) then
    alter table portal_private.mcp_oauth_tokens
      add constraint mcp_oauth_tokens_rotated_to_token_fk
      foreign key(rotated_to_token_id) references portal_private.mcp_oauth_tokens(token_id);
  end if;
end $$;

create index if not exists idx_mcp_oauth_tokens_family
  on portal_private.mcp_oauth_tokens(token_family_id,created_at);
create index if not exists idx_mcp_oauth_tokens_parent
  on portal_private.mcp_oauth_tokens(parent_token_id)
  where parent_token_id is not null;
create index if not exists idx_mcp_oauth_tokens_refresh_reuse
  on portal_private.mcp_oauth_tokens(refresh_token_hash,server_slug,functional_role,client_id)
  where refresh_token_hash is not null;
