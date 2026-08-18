create or replace function portal_private.enforce_mcp_refresh_sliding_expiry()
returns trigger
language plpgsql
security definer
set search_path = portal_private, pg_temp
as $$
begin
  if new.refresh_token_hash is not null and new.refresh_expires_at is not null then
    new.refresh_expires_at := greatest(new.refresh_expires_at, clock_timestamp() + interval '180 days');
  end if;
  return new;
end;
$$;

revoke all on function portal_private.enforce_mcp_refresh_sliding_expiry() from public;

drop trigger if exists trg_mcp_oauth_refresh_sliding_expiry on portal_private.mcp_oauth_tokens;
create trigger trg_mcp_oauth_refresh_sliding_expiry
before insert on portal_private.mcp_oauth_tokens
for each row
execute function portal_private.enforce_mcp_refresh_sliding_expiry();

update portal_private.mcp_oauth_tokens
set refresh_expires_at = greatest(refresh_expires_at, now() + interval '180 days')
where refresh_token_hash is not null
  and refresh_expires_at is not null
  and refresh_expires_at > now()
  and revoked_at is null;

comment on function portal_private.enforce_mcp_refresh_sliding_expiry() is
  'Extends each newly issued/rotated MCP OAuth refresh token to a 180-day sliding inactivity window. Access-token TTL, rotation, reuse detection, revocation and fixed role binding remain unchanged.';
