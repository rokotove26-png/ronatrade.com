# RONA Trade — Canonical AI Role Topology V2

Authority: OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2

## Human actors
- OWNER — Собственник
- TREASURY — Казначей

## Canonical operational AI roles
- FINANCE — Финансовый директор
- OPERATIONS_DIRECTOR — Операционный директор
- COMMERCIAL_DIRECTOR — Коммерческий директор
- LEGAL — Юрист
- RAIL_LOGISTICS — ЖД-логистика
- SYSTEM_ADMIN — Системный администратор

## Nonexistent separate roles
- ACCOUNTING — not a separate role; compatibility maps to FINANCE.
- EXECUTIVE_DIRECTOR — not a separate role; compatibility maps to OPERATIONS_DIRECTOR.

## Legacy compatibility
- MARKET_ANALYST -> COMMERCIAL_DIRECTOR.
- Historical enum values and source labels may remain for immutable history only.
- They must not create AI role gaps, handoff targets, headcount, or new agents.

## Routing correction
CLIENT_PAYMENT_PROOF_SUBMIT belongs to FINANCE.

## Deployment model
Current-state and MCP routing are projected through RONA_ROLE_ROUTING_CONTRACT_V4 / RONA_ROLE_STATE_RECOVERY_V5 without requiring destructive migration of historical records.
