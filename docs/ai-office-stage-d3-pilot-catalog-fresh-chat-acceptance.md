# RONA AI Office — Stage D.3 Pilot Catalog + Cold-Bootstrap Acceptance

Date: 2026-09-29  
Mode: CURRENT_STATE_FIRST -> ROLE-BY-ROLE COLD BOOTSTRAP -> TOOL CATALOG CHECK -> FAIL-CLOSED  
Production business mutation: **NONE**

## Scope

Validate all six canonical AI roles after Writes #4–#7 and identify any remaining connector/app-catalog gap before declaring fresh-chat acceptance complete.

Canonical roles:
- FINANCE
- LEGAL
- COMMERCIAL_DIRECTOR
- OPERATIONS_DIRECTOR
- RAIL_LOGISTICS
- SYSTEM_ADMIN

Compatibility aliases remain non-canonical:
- MARKET_ANALYST -> COMMERCIAL_DIRECTOR
- ACCOUNTING -> FINANCE
- EXECUTIVE_DIRECTOR -> OPERATIONS_DIRECTOR

## Cold-bootstrap current_state acceptance

| Role | Identity | State version | Conflicts | Competence gate | RONA-DOC-STANDARD | Generation preflight | Mailbox |
|---|---|---:|---:|---|---|---|---|
| FINANCE | AI-FINANCE | 19573 | 0 | RONA_AI_COMPETENCE_GATE_V1 | v2 ACTIVE | READY / [] | finance@ronaoil.com / BOUND / OK |
| LEGAL | AI-LEGAL | 17 | 0 | RONA_AI_COMPETENCE_GATE_V1 | v2 ACTIVE | READY / [] | lawyer@ronaoil.com / BOUND / OK |
| COMMERCIAL_DIRECTOR | AI-COMMERCIAL-DIRECTOR | 5 | 0 | RONA_AI_COMPETENCE_GATE_V1 | v2 ACTIVE | READY / [] | analyst@ronaoil.com / BOUND / OK |
| OPERATIONS_DIRECTOR | AI-OPERATIONS-DIRECTOR | 329 | 0 | RONA_AI_COMPETENCE_GATE_V1 | v2 ACTIVE | READY / [] | exec_director@ronaoil.com / BOUND / OK |
| RAIL_LOGISTICS | AI-RAIL-LOGISTICS | 72 | 0 | RONA_AI_COMPETENCE_GATE_V1 | v2 ACTIVE | READY / [] | rail_spec@ronaoil.com / BOUND / OK |
| SYSTEM_ADMIN | AI-SYSTEM-ADMIN | 94 | 0 | RONA_AI_COMPETENCE_GATE_V1 | v2 ACTIVE | READY / [] | NOT_CONFIGURED / TO_CONFIRM |

All six roles recover the canonical document standard and exact canonical document asset metadata from production state. No role-state conflict was observed.

## Finance canonical report acceptance

FINANCE receives:
- registry: FINANCE_CANONICAL_REPORT_REGISTRY_V1;
- reports: [];
- readiness.population_status: SOURCE_ABSENT;
- blocker: NO_OWNER_APPROVED_SOURCE_LOCKED_FINANCE_REPORT_DEFINITION;
- content_owner: FINANCE;
- system_admin_scope: TECHNICAL_MATERIALIZATION_ONLY;
- do_not_invent_report_types: true.

Other roles receive the registry only as hidden/non-role content. This is the expected role-safe projection.

## Registered ChatGPT-facing tool catalogs observed in the current conversation

| Role app namespace | Observed tools |
|---|---:|
| RONA Finance Pilot | 8 |
| RONA Legal Pilot | 8 |
| RONA Commercial Director Pilot (legacy namespace Market Analyst Pilot) | 8 |
| RONA Operations Director Pilot | 9 |
| RONA Rail Logistics Pilot | 15 |
| RONA System Admin Pilot namespace | 3 |

The deployed production gateway is `rona-mcp-gateway` v46 and its runtime code augments Pilot tool lists with:
- coordination_detail;
- exception_cockpit;
- task_complete when authenticated with mcp:coordinate on a *-pilot server;
- task_close for OPERATIONS_DIRECTOR and SYSTEM_ADMIN when authenticated with mcp:coordinate on a *-pilot server.

Finance is intentionally normalized back to its canonical legacy eight-tool surface by the Finance Payments V7 compatibility extension.

## Connector binding acceptance

Five business-role Pilots have active ChatGPT OAuth tokens on their *-pilot server slugs with:
`mcp:read mcp:coordinate offline_access`.

SYSTEM_ADMIN is the exception.

Production has an enabled gateway config:
- server_slug: `rona-mcp-system-admin-pilot`
- app_name: `RONA System Admin Pilot`
- role: SYSTEM_ADMIN
- identity: AI-SYSTEM-ADMIN

But no current OAuth client/token is bound to that *-pilot slug.

The currently connected System Admin ChatGPT tool surface is authenticated against:
- server_slug: `rona-mcp-system-admin`
- scope: `mcp:read`

Recent production request events confirm SYSTEM_ADMIN current_state calls are served by `rona-mcp-system-admin`, not `rona-mcp-system-admin-pilot`.

Therefore its current 3-tool surface is not a backend runtime failure. It is an app/connector binding + catalog-refresh gap.

## Acceptance result

Backend cold-bootstrap acceptance:
- identity: PASS 6/6
- competence contract: PASS 6/6
- role-state conflicts: PASS 6/6
- RONA-DOC-STANDARD v2 recovery: PASS 6/6
- document generation preflight: PASS 6/6
- Finance report role-safe projection: PASS
- business-role mailbox binding: PASS 5/5
- SYSTEM_ADMIN mailbox: OPEN / TO_CONFIRM

Literal six-role fresh-chat app acceptance is **HOLD** only for SYSTEM_ADMIN connector binding/tool catalog.

Required remaining action before final acceptance:
1. bind/reconnect the ChatGPT System Admin app to `rona-mcp-system-admin-pilot`;
2. obtain `mcp:read mcp:coordinate offline_access` for that Pilot connection;
3. re-scan/refresh its MCP tools;
4. confirm the fresh-chat System Admin catalog exposes the intended Pilot tools;
5. keep `rona-mcp-system-admin` read-only connection as historical/legacy only or retire it under a separate explicit Owner gate;
6. separately confirm whether SYSTEM_ADMIN requires a corporate role mailbox; do not invent one.

No automatic OAuth connection, plugin installation, mailbox creation, credential mutation or legacy-connection revocation is performed by this acceptance step.


## ChatGPT OAuth builder reproduction — 2026-09-29

ChatGPT custom-app creation against `https://ronaoil.com/system-admin-pilot/mcp` reproduced:
`MCP server ... does not implement OAuth`.

Callback shown by ChatGPT:
`https://chatgpt.com/connector/oauth/LIEOsYVTtSvE`.

The callback itself is valid and already appears on the legacy System Admin OAuth client lineage. The failure occurs earlier, during OAuth discovery.

Current gateway runtime implements authorization code + PKCE, DCR, refresh tokens and the required Pilot scopes internally, but the ChatGPT builder cannot discover them reliably from the current public MCP challenge/metadata surface.

Repository Stage D.3 fix now:
- returns an OAuth `401 WWW-Authenticate` challenge for unauthenticated MCP GET instead of presenting only a non-auth 405 surface;
- advertises a reachable role-relative protected-resource metadata URL;
- supports role-relative and RFC-style well-known resource/authorization metadata routes;
- advertises DCR `registration_endpoint`, PKCE `S256`, refresh-token grant and Pilot scopes;
- adds per-tool OAuth `securitySchemes` to the final tool catalog.

Production deployment remains separately Owner-gated.
