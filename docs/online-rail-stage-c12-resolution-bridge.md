# ONLINE RAIL #644 - C1.2 RESOLUTION BRIDGE

Status: repository candidate only. No production migration, deploy, merge or business write.

## Scope

C1.2 closes the remaining TO_VERIFY -> MATCHED materialization gap after the accepted C1.1 generic XLSX intake. It does not change B1.5 source evidence, correction semantics, current-position semantics, Deal ownership, MOVIZOR isolation, operation-code semantics or GEO policy.

Accepted intake remains:

source capture -> parse -> import preview -> guarded ingest

C1.2 adds a controlled authority step only for evidence that remains TO_VERIFY.

## Authority paths

### Owner explicit instruction

Tool: `rail_xlsx_owner_resolution_confirm`.

The gateway uses the current Rail Logistics Pilot OAuth context and passes its `owner_portal_user_id`, token, client and request identifiers into `rail_xlsx_owner_resolution_bridge_v1`.

The database function requires:

- current non-revoked/non-expired Rail Logistics Pilot token;
- fixed `RAIL_LOGISTICS / AI-RAIL-LOGISTICS` token identity;
- `mcp:coordinate` scope;
- token-bound portal user is ACTIVE and auth-linked;
- ACTIVE non-revoked ADMIN role binding;
- exact evidence ID;
- exact existing active Deal/document scope;
- explicit owner confirmation reference;
- non-empty reason, source refs and evidence refs.

It creates immutable `audit_events` authority with:

- actor_role `ADMIN`;
- action `RAIL_XLSX_OWNER_RESOLUTION_INSTRUCTION`;
- entity_type `RAIL_XLSX_EVIDENCE`;
- `authority_contract=RAIL_XLSX_OWNER_AUTHORITY_V1`;
- `authorityType=OWNER_EXPLICIT_INSTRUCTION`;
- exact evidence/deal/document keys.

`service_role` is recorded only as technical executor. It is not the business actor.

### Rail Logistics verified decision

Tool: `rail_xlsx_resolution_verify`.

`rail_xlsx_rail_resolution_bridge_v1` requires the active fixed Rail Logistics Pilot token and non-empty source/evidence refs. It creates one immutable `ai_coordination_records` conclusion per idempotent request:

- `functional_role=RAIL_LOGISTICS`;
- `identity_id=AI-RAIL-LOGISTICS`;
- `record_type=FUNCTIONAL_CONCLUSION`;
- `status=APPROVED`;
- `target_type=RAIL_XLSX_EVIDENCE`;
- exact evidence ID;
- payload `authorityContract=RAIL_XLSX_RAIL_LOGISTICS_AUTHORITY_V1`;
- payload `authorityType=RAIL_LOGISTICS_VERIFIED_DECISION`;
- exact Deal key and rail_document key;
- mandatory source_refs and evidence_refs.

The generic `functional_conclusion_submit` is not used as an authority shortcut.

## Resolution

Both bridges invoke the already accepted `portal_private.rail_xlsx_resolution_decide_v1`.

The original evidence row remains immutable TO_VERIFY. The append-only resolution decision makes the effective state MATCHED. B1.5 latest-trusted/current-position views then expose TRUSTED automatically when there is one comparable trusted domain. Existing cross-domain ambiguity remains fail closed.

## Matching boundary

No bridge infers Deal/document from filename, route similarity, station similarity, cargo similarity or operation code. The gateway resolves only an explicitly supplied canonical Deal plus exact rail document ID or exact GU-12 against existing active canonical records.

No new Deal registry is created. No Deal is created. No `rail_wagons` row is created. No business rail status is inferred from operation codes. No GEO is produced.

## Gateway isolation

The two C1.2 tools are added only when all are true:

- role `RAIL_LOGISTICS`;
- identity `AI-RAIL-LOGISTICS`;
- server `rona-mcp-rail-logistics-pilot`;
- scopes include `mcp:read` and `mcp:coordinate`.

All non-Rail roles retain their existing tool lists. Finance extension remains locked to deployed production-source Git blob `cfcc0f50903d177efa60a76b24b7d002349c4159`.