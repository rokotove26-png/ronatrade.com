# MCP Cross-Role Coordination V1

Status: PRODUCTION ACTIVE.

Contract: a business-role `HANDOFF_REQUEST` is an audited notification and does not grant authority over the referenced business entity. The sender must be authorized for the entity type and the entity must exist. The recipient must be a valid addressed business role. Existing recipient mutation/read authority remains unchanged.

Production proof for RONA-PRICE-LIST-2026-09-R12:
- Finance handoff: d1785a9c-0cbd-4033-af31-1602f080ab5c
- Rail Logistics handoff: 52482a38-3f92-472f-a950-ce985e2a1f9b
- Commercial regression handoff: 48e7abf6-c6b2-4217-ae98-05feeec69517

Fail-closed proof: nonexistent publication handoffs are rejected with TARGET_NOT_FOUND_OR_OUT_OF_SCOPE. Idempotent replay returns the original coordination record. Finance and Rail Logistics have zero PUBLICATION `FUNCTIONAL_CONCLUSION` / `BUSINESS_CHANGE_PROPOSAL` authority records after the change.

The compact `RONA_ROLE_STATE_RECOVERY_V2` projection remains unchanged. `coordination_detail(record_id)` is exposed by the gateway for sender/recipient/supervisory drill-down without broadening business authority.
