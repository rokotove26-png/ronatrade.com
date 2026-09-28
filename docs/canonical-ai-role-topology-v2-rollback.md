# Canonical AI role topology V2 — rollback point

Owner instruction remains canonical: ACCOUNTING and EXECUTIVE_DIRECTOR are not separate RONA Trade roles.

Runtime rollback, if required, is limited to:
- redeploy the previously active rona-mcp-gateway v43 source;
- fall back from RONA_ROLE_STATE_RECOVERY_V5 to V4;
- fall back from RONA_ROLE_ROUTING_CONTRACT_V4 to V3.

The canonical OWNER correction is not rolled back:
- CLIENT_PAYMENT_PROOF_SUBMIT remains FINANCE;
- ACCOUNTING is not restored as a role;
- EXECUTIVE_DIRECTOR is not restored as a role;
- historical enum labels may remain only for backward-compatible storage/history.

No business facts, prices, payments, deals, clients, shipments or historical audit records are reverted by this rollback point.
