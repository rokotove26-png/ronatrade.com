// PR #528 Stage 2.1 candidate packaging entrypoint for the existing rona-portal-api slug.
// Production deploy is explicitly out of scope for this PR.
// The Stage 2.1 wrapper preserves the active production source lineage pinned inside
// stage21-bootstrap.ts and only decorates the required Client Intake contracts.
import "./stage21-bootstrap.ts";
