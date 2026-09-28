# LEGAL AI Office Governance V1 — rollback point

`LEGAL_AI_OFFICE_GOVERNANCE_V1` is an immutable Owner policy record and is not deleted on rollback.

If the gateway/tool-schema change must be rolled back:
- redeploy the previous rona-mcp-gateway v44 source;
- keep the Legal policy record;
- any future policy correction must use append-only supersession by a new Owner instruction.

Rollback must not:
- restore MARKET_ANALYST as a canonical handoff target;
- add ACCOUNTING or EXECUTIVE_DIRECTOR;
- expand LEGAL authority;
- mutate business data.
