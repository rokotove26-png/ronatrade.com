# Admin current-only cutover — 2026-08-26

## Owner decision

`/portal/admin` must not use the retired Admin v3.4.13 cabinet as a visible or hidden runtime substrate.

## Production contract after this cutover

- server-side session and `ADMIN` role verification remains mandatory before the Admin shell is served;
- `portal-src/current/admin.html` is the only Admin HTML deployment source;
- the old v3.4.13 Admin source and `canonical-transfer-v1_1/admin_externalized.html` remain historical repository material only and are not build inputs;
- the approved `main-v2` and current section modules render into the small structural shell;
- canonical RONA background and logo are copied from their standalone locked assets;
- there is no legacy Admin fallback, autonomous login gate, or legacy first paint;
- Clients/Agents access is provided by a current-only module and does not harvest the retired Admin DOM.

No price, deal, contract, Finance, Claims, publication, IAM authority, or other authoritative business record is mutated by this source cutover.
