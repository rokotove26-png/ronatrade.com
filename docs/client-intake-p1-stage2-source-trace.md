# P1 Client Intake Stage 2 — quantity source trace

Status: candidate/rehearsal only. Production records were read only. No recovery or correction was applied.

## Production provenance correction

Production migration authority reports `20260902234211 client_communication_admin_gate_v1`.

The matching repository migration on the current release lineage is `supabase/migrations/20260902233000_client_communication_admin_gate_v1.sql`. Git history for that path identifies introducing commit `4f0fde1c35fddabe02797f22e165c135fcfa09fb` (`feat(portal): gate client communications through Admin`). This is the proven provenance for this audit. The previously reported production version `20260902233605` and commit `f340f4ee...` are not used.

## Incident 1 trace

Source record: the immutable business payload of the incident was inspected read-only. Persisted `payload.quantity_tonnes` is `10000`.

| Stage | Value | Evidence level | Source-level finding |
|---|---:|---|---|
| Human keystrokes / historical DOM input at incident time | NOT_RETAINED | unavailable | No browser telemetry or request-body capture retains the historical DOM value. It is not safe to assert either 1000 or 10000 here. |
| Current DOM control contract | pass-through number input | source | `type=number`, `min=0.001`, `step=0.001`; no unit conversion. |
| Frontend normalization `q` | 10000 (deterministic reconstruction) | inferred from exact pass-through chain | Current source computes `Number(String(value).replace(',','.'))`. No later stage can multiply the value, while persisted payload is 10000. |
| Request payload before `fetch` | 10000 (deterministic reconstruction) | inferred | `quantity_tonnes:q`, then `JSON.stringify(payload)`; no numeric transform between `q` and body. |
| Portal API `req.json()` parser | 10000 (deterministic reconstruction) | inferred | `/v1/events` reads JSON and passes `body.payload` to SQL as JSONB without quantity normalization. |
| RPC argument `p_payload` | 10000 (deterministic reconstruction) | inferred | `sql.json(body.payload||{})::jsonb`; no conversion. |
| `server_submit_reverse_event` | 10000 | source contract + downstream observation | Function inserts `coalesce(p_payload,'{}'::jsonb)` unchanged. |
| Persisted `portal_reverse_events.payload.quantity_tonnes` | 10000 | observed production source | Read-only production query. |

The exact historical human-entered DOM value is therefore **not recoverable from retained evidence**. What is recoverable is the transform boundary: no `1000 -> 10000` conversion exists from the current Client form normalization through the production API, RPC function, and persistence layer. The value persisted as 10000 necessarily reached the event submission payload as 10000 under the audited code path.

## Generic transform audit

Current Client form normalization is:

```js
const num=(v)=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
```

Findings:

- decimal comma: `12,5 -> 12.5`; no scale change;
- decimal dot: preserved;
- plain whitespace or NBSP thousands separator is not stripped by this function; `1 000`/`1\u00a0000` fails numeric validation rather than becoming 10000;
- no tonnes/kg conversion exists in this submit path;
- no `*10`, `*1000`, `/10` or `/1000` conversion exists in the submit block;
- no repeated quantity normalization exists between modal value and request body;
- no `parseFloat`; normalization uses `Number` after comma-to-dot replacement;
- `JSON.stringify` / `req.json()` / JSONB serialization do not scale the number;
- `server_submit_reverse_event` persists the JSONB payload unchanged.

## Root-cause classification

`QUANTITY_ROOT_CAUSE=NO_SERVER_OR_SERIALIZATION_TRANSFORM_FOUND__HISTORICAL_DOM_VALUE_NOT_RETAINED`

`QUANTITY_TRANSFORM_STAGE=NONE_DETECTED_FROM_FRONTEND_NORMALIZED_VALUE_THROUGH_PERSISTENCE`

This classification deliberately does not invent a `10000/10` repair and does not branch on an incident event ID. The candidate correction layer represents an Owner-authorized append-only correction independently of root-cause speculation.
