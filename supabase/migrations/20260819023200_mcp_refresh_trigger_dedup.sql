drop trigger if exists trg_extend_mcp_refresh_session_v1 on portal_private.mcp_oauth_tokens;
drop function if exists portal_private.extend_mcp_refresh_session_v1();

comment on trigger trg_mcp_oauth_refresh_sliding_expiry on portal_private.mcp_oauth_tokens is
  'Single canonical MCP refresh-session trigger. Extends each newly issued or rotated refresh token to a 180-day sliding inactivity window.';
