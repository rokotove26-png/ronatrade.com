# P1 Client Intake Stage 2 — quantity source trace

Status: candidate/rehearsal only until production recovery. Raw production source is immutable.

## Production provenance correction

Production migration authority reports `20260902234211 client_communication_admin_gate_v1`.

The matching repository migration on the current release lineage is `supabase/migrations/20260902233000_client_communication_admin_gate_v1.sql`. Git history for that path identifies introducing commit `4f0fde1c35fddabe02797f22e165c135fcfa09fb` (`feat(portal): gate client communications through Admin`). This is the proven provenance for this audit.

## Incident A quantity authority

Source event: `PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96`.

The immutable source payload contains `payload.quantity_tonnes=10000`.

Owner clarification on 2026-09-16 is authoritative for the business correction: **the client entered 10000 tonnes by mistake; the correct requested quantity is 1000 tonnes**.

This is therefore not classified as a frontend/backend numeric transformation defect. The source record remains 10000 for audit; current business projection is corrected to 1000 by the append-only Owner correction overlay.

| Stage | Value | Evidence level | Finding |
|---|---:|---|---|
| Client-entered incident value | 10000 | Owner clarification + persisted source | Client input error. |
| Current DOM control contract | pass-through number input | source | `type=number`, `min=0.001`, `step=0.001`; no unit conversion. |
| Frontend normalization | pass-through numeric | source | `Number(String(value).replace(',','.'))`; no scale change. |
| Portal API / JSON / JSONB persistence | pass-through numeric | source | No quantity scaling. |
| Immutable persisted source | 10000 | production observation | Must not be rewritten. |
| Authoritative current business quantity | 1000 | OWNER | Applied through correction overlay only. |

## Generic transform audit

Current Client form normalization is:

```js
const num=(v)=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
```

Findings:

- decimal comma: `12,5 -> 12.5`; no scale change;
- decimal dot: preserved;
- plain whitespace or NBSP thousands separator is not stripped; invalid formatted input fails numeric validation instead of being scaled;
- no tonnes/kg conversion exists in this submit path;
- no `*10`, `*1000`, `/10` or `/1000` conversion exists in the submit block;
- `JSON.stringify`, `req.json()` and JSONB serialization do not scale the number;
- `server_submit_reverse_event` persists the JSONB payload unchanged.

## Root-cause classification

`QUANTITY_ROOT_CAUSE=CLIENT_INPUT_ERROR_OWNER_CONFIRMED`

`QUANTITY_TRANSFORM_STAGE=NONE`

`IMMUTABLE_SOURCE_QUANTITY=10000`

`AUTHORITATIVE_CORRECTED_QUANTITY=1000`

`CORRECTION_AUTHORITY=OWNER`

The implementation must not divide source values heuristically and must not branch on the incident event ID. The generic append-only correction layer supplies the corrected current projection while preserving source provenance.
