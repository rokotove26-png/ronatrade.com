# RONA Trade canonical portal source round-trip audit — 2026-08-16

Status: PREPARATION PASS / VISUAL GATE HOLD

Branch: `staging/canonical-all-portals-visual-20260816`
Base/backup commit: `9f27c32597cb8cb0e3ac7acd38b4ac95b988b060`
Backup branch: `backup/staging-canonical-all-portals-base-20260816`

## Frozen owner-provided sources verified locally

- Admin v3.4.13 standalone SHA-256: `9694331f724efcd811207cfa433fea554a8ba6ca30b40a8299c1ef15fe4ce4ea`
- Agent v0.4.3 standalone SHA-256: `4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c`
- Client v1.5.14 standalone SHA-256: `961a834f6c29c9479531b8363cb6cdb230acfd4ca1817eba17702fa1b1a21b31`

All three frozen sources embed the same exact visual assets:

- canonical background PNG: 2,627,000 bytes, 1672x941 RGBA, SHA-256 `9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc`
- canonical logo SVG: 336,904 bytes, SHA-256 `755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65`

## Deterministic source transformation check

A local technical-only externalization test replaced only the exact embedded PNG/SVG data URIs with hash-addressed relative asset paths. For Admin, Agent and Client, reversing that transformation reproduced the original owner-provided standalone source byte-for-byte and reproduced the three frozen SHA-256 values above.

This proves that the planned adapter can preserve all HTML/CSS/DOM/typography/layout/branding source bytes except the transport form of the exact same visual assets. It does not by itself constitute rendered-browser visual regression PASS.

## Repository state / hold

The exact canonical background is still absent from the connected Git repository at required path:
`portal-src/admin-canonical-v3_4_13-background.png`.

Approximation or substitution is prohibited. The current geography asset is not an acceptable replacement.

The existing `portal-src/client.html` is a noncanonical UAT shell and must not be treated as the v1.5.14 visual baseline. Agent/Admin reconstructed runtime sources also require replacement/verification against frozen owner sources before promotion.

## Gate

- CANONICAL SOURCE HASH VERIFICATION: PASS
- ASSET IDENTITY VERIFICATION: PASS
- REVERSIBLE TECHNICAL EXTERNALIZATION: PASS
- EXACT REPOSITORY ASSET TRANSFER: HOLD
- RENDERED VISUAL REGRESSION: NOT YET PASS
- PRODUCTION PROMOTION: NOT AUTHORIZED / NOT PERFORMED

Cost: 0 USD.
