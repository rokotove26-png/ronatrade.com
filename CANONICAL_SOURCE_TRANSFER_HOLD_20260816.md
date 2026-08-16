# RONA Trade — Canonical visual source transfer control

Date: 2026-08-16
Branch: `staging/canonical-all-portals-visual-20260816`
Status: `VISUAL AUTHENTICITY = HOLD`
Owner action required: `NO`
Production promotion: `PROHIBITED UNTIL RENDERED PASS`

## Frozen visual authorities

- Admin v3.4.13 SHA-256: `9694331f724efcd811207cfa433fea554a8ba6ca30b40a8299c1ef15fe4ce4ea`
- Agent v0.4.3 SHA-256: `4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c`
- Client v1.5.14 SHA-256: `961a834f6c29c9479531b8363cb6cdb230acfd4ca1817eba17702fa1b1a21b31`
- Embedded canonical Admin background: `2,627,000 bytes`, SHA-256 `9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc`
- Embedded canonical logo SVG: `336,904 bytes`, SHA-256 `755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65`

## Completed controls

1. Direct build architecture has been changed to `FROZEN_CANONICAL_SOURCE_DIRECT_BUILD`; the old modified-G8.2/background-repair architecture is not accepted as canonical.
2. Build script refuses substitutions and verifies all three frozen source hashes plus embedded PNG/SVG hashes before emitting portal HTML.
3. A server-side runtime adapter is installed on staging. It preserves server session/role enforcement, keeps Client fail-closed before static HTML when no real Client context exists, disables the Admin standalone legacy login only after server authorization, binds the existing canonical Admin logout control to same-origin server logout, and boots Agent live data without inserting a new visible logout control.
4. Exhaustive automated recovery scanned all reachable Git blobs across refs and every retained non-expired GitHub Actions artifact. Result: `CANONICAL_SOURCE_RECOVERY=NOT_FOUND found=none`. No substitute was used.
5. No production branch merge or production portal promotion has been performed.

## Remaining controlled hold

The exact frozen source bytes are present in the controller workspace but are not reachable through the connected Git repository/history/artifacts. The available repository connector has no local-file transfer parameter for moving those existing workspace files into GitHub without serializing their bytes through the connector payload. This is a system tooling/source-transfer hold, not a missing-binary or owner-upload hold.

Do not request a replacement image, a substitute portal shell, or a manual owner binary upload. When a supported workspace-file-to-repository transfer path is available, transfer the three exact frozen sources, rerun the direct build, deploy Preview, perform controlled rendered comparison for Admin/Agent/Client, and only then evaluate the visual authenticity gate.

Cost: `0 USD`.
