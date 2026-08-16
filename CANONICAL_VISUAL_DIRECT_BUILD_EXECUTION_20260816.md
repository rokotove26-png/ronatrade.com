# RONA Trade — canonical visual direct-build execution

Date: 2026-08-16
Branch: `staging/canonical-all-portals-visual-20260816`
Status: `LOCAL RENDERED EQUIVALENCE PASS / CLOUD PREVIEW HOLD`
Production promotion: **NOT PERFORMED**
Cost: **0 USD**

## Controller delta applied

The visual staging architecture no longer treats a permanent repository PNG as a prerequisite and no longer accepts `modified G8.2 Admin -> background replacement` as a canonical build.

The active branch build entry is now `scripts/build-pages-direct-canonical.mjs` via `package.json` and accepts only the exact frozen standalone sources. There is no fallback to the reconstructed G8.2 Admin, the Client UAT shell, the current geography image, or any substitute branding asset.

## Frozen source provenance verified before technical integration

- Admin v3.4.13 SHA-256: `9694331f724efcd811207cfa433fea554a8ba6ca30b40a8299c1ef15fe4ce4ea`; bytes: `4,559,763`.
- Agent v0.4.3 SHA-256: `4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c`; bytes: `4,022,017`.
- Client v1.5.14 SHA-256: `961a834f6c29c9479531b8363cb6cdb230acfd4ca1817eba17702fa1b1a21b31`; bytes: `4,239,768`.

Each frozen source contains one exact embedded canonical background PNG and one exact embedded canonical logo SVG.

- embedded background PNG decoded bytes: `2,627,000`;
- embedded background PNG SHA-256: `9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc`;
- embedded logo SVG decoded bytes: `336,904`;
- embedded logo SVG SHA-256: `755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65`.

The direct build keeps the embedded canonical assets in the frozen sources. A permanent repository binary PNG is therefore not a build requirement.

## Local technical integration / rendered comparison

Controlled viewport: `1920 x 1080`, Chromium 144, same execution environment for reference and integrated render.

Technical adapter scope used for comparison:
- Admin: standalone local PBKDF2/sessionStorage gate neutralized for an already server-authorized response; deferred canonical app modules activated; existing canonical logout control preserved; no CSS/branding/layout replacement.
- Agent: exact frozen source; nonvisual server-session marker only.
- Client: exact frozen source; nonvisual server-session marker only. Production Client access remains server fail-closed when authorized Client binding is absent.

All canonical `<style>` blocks and both embedded visual assets were verified unchanged after the technical transform.

Rendered result:

| Portal | Reference screenshot SHA-256 | Integrated screenshot SHA-256 | Non-zero pixel diff | Result |
|---|---|---|---:|---|
| Admin | `a62cc70e5e929d5be38cb54e8d240e147528681ed91498439fb9fa29d4993f3e` | `a62cc70e5e929d5be38cb54e8d240e147528681ed91498439fb9fa29d4993f3e` | `0 / 2,073,600` | PASS |
| Agent | `447c00890835e1d268c1352f817ee6dfc9e4bc2859bb07ca1459856327d13e51` | `447c00890835e1d268c1352f817ee6dfc9e4bc2859bb07ca1459856327d13e51` | `0 / 2,073,600` | PASS |
| Client | `08f47b911da502d526f9ec83c54c62654bb54b669057cd91993be0a4793bf565` | `08f47b911da502d526f9ec83c54c62654bb54b669057cd91993be0a4793bf565` | `0 / 2,073,600` | PASS |

This proves the tested technical adapter can be visually neutral against the frozen sources. It does not by itself satisfy the required public Preview deployment gate.

## Cloud Preview gate

The connected Git repository still does not contain the three exact frozen standalone source files. The new build deliberately fails closed with `CANONICAL_SOURCE_MISSING` rather than falling back to a noncanonical shell or substitute asset.

The connected GitHub write interface available in this execution context accepts UTF-8/base64 content strings but does not expose a local-file upload parameter for the already verified frozen source bytes. No owner binary upload is requested, and the embedded PNG is not treated as the blocker. The remaining hold is exact frozen-source transport into the cloud build input using the currently available connector path.

Until an actual Cloudflare Preview is built from the exact frozen sources and rendered there, the final visual authenticity gate remains HOLD.

## Preserved state

No production branch promotion was performed. `rona-portal-api` v7, current business controls/tasks, Agent authority scope, Client fail-closed semantics, mail gate, Edge Function semantic hygiene, and DEAL-2026-004 HOLD/control semantics were not changed by this visual correction.
