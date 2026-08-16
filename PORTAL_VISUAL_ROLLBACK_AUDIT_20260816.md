# RONA Trade portal visual rollback audit — 2026-08-16

Status: HOLD — owner UAT blocked. No production promotion performed.

## Canonical baselines

- Admin: `RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html`; SHA-256 `9694331f724efcd811207cfa433fea554a8ba6ca30b40a8299c1ef15fe4ce4ea`; canonical background SHA-256 `9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc`; canonical embedded logo SVG SHA-256 `755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65`.
- Client: `RONA_Trade_Client_Portal_v1_5_14_SIGNED_CONTRACT_AUTHORITY_FINAL_FIX_CANDIDATE_20260812.html`; SHA-256 `961a834f6c29c9479531b8363cb6cdb230acfd4ca1817eba17702fa1b1a21b31`.
- Agent: `RONA_Trade_Agent_Portal_v0_4_3_EDITOR_SECURITY_STATUS_TYPOGRAPHY_FINAL_CANDIDATE_20260812.html`; SHA-256 `4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c`.
- Internal Office / Staff: HOLD. No evidence of a last owner-approved frozen visual source/commit/SHA/asset lineage was found. Historical project instructions describe Staff visual/UX owner acceptance as a later separate step.

## First unauthorized visual-change roots

- Admin: `1063e334cf2e84e466c7a2e2ca30c95e2c24cf75` — `portal-src/admin-g82b...` integrated payload lineage begins. Current reconstructed output substitutes the canonical embedded background with `/assets/geography/5c2ddfaafe439a9f.png` and uses a noncanonical logo representation.
- Client: `de8d40e1feee9f40f0d2fb236221120b1cc0ab74` — `portal-src/client.html` created as a new fail-closed UAT shell with new CSS/layout instead of the approved v1.5.14 visual source.
- Agent: `ee8445604be193382dce240f6e08b7adf956818f` — approved source was reconstructed/externalized for Preview rather than preserving the exact frozen standalone source bytes/assets.
- Staff: no unauthorized-delta comparison can be asserted because no owner-approved frozen visual baseline has been evidenced.

## Recovery evidence

Full Git-history scans across all refs found no blob whose SHA-256 equals the frozen Admin/Client/Agent standalone source SHA, canonical background SHA, or canonical logo SVG SHA. The only historical portal payload paths are the current reconstructed Admin parts, reconstructed Agent parts, `portal-src/client.html`, and related generated candidates.

Supabase Storage and portal document/storage registries contain no object matching canonical background SHA-256 `9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc`.

Exact canonical Admin/Client/Agent source bytes and exact embedded background/logo assets were verified in the owner-provided canonical source package outside Git history. Current GitHub connector write actions do not expose a local-file/binary upload parameter; therefore the exact 2,627,000-byte canonical PNG cannot be losslessly transferred into Git from the available connected write path without re-encoding its full binary payload through text arguments. Approximation/substitution is prohibited.

## Preservation gates

- Production branch unchanged by this rollback audit.
- Supabase `rona-portal-api` unchanged: v6, `verify_jwt=true`, bundle SHA-256 `c927c8f148561002d97f44f35da1f3d411436efeee229e7de2b9e9745181cde3`.
- Server-side Auth/session/RLS/IDOR/API authority and live canonical business data unchanged.
- Temporary owner UAT Agent/Client grants are not revoked because owner acceptance has not occurred.
- No visually approximate candidate promoted.
- Incremental cost: 0 USD.
