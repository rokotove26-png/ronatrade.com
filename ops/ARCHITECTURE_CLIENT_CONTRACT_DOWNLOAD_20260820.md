# RONA Trade — Admin-authoritative contract activation and client download contract

## Status
Approved architecture note, 2026-08-20.

## Lifecycle
1. Executive Director registers a new contract candidate. This makes the company / contract candidate visible in Admin Portal.
2. The candidate is not yet authoritative for Client Portal access.
3. Administrator selects the company in Admin Portal and either:
   - uploads the valid bilaterally signed PDF; or
   - explicitly selects **«Открыть без контракта»**.
4. Upload by Administrator is the authoritative confirmation action. It must create/confirm the signed-contract document chain, confirm the company/contract server authority, and activate eligible pending Client bindings.
5. «Открыть без контракта» creates the account and a PENDING company/contract binding. Client data remains fail-closed until Administrator uploads and confirms the signed PDF.
6. After Administrator upload and confirmation, the current signed PDF is the authoritative contract document for that company/contract.
7. The Client Portal must expose that exact current confirmed PDF for download on the corresponding company tile. Download is permitted only to a currently authorized Client user in the selected company/contract context.
8. Replaced contract versions remain historical/audited; only the current confirmed version is exposed as the default client download.

## Security invariants
- Administrator is the sole authority for upload/confirmation, password, user activation and access binding.
- AI roles do not mutate users, contracts, signed documents or access rights.
- Contract objects stay in private storage; Client Portal receives only short-lived authorized download URLs.
- No cross-company document access is allowed.
- A PENDING binding without a confirmed signed contract cannot expose company business data or contract download.
- Every activation, replacement and download URL issue is audited.

## UI invariant
No redesign of canonical Admin, Agent or Client portal pages. Functional wiring may use existing controls and approved nonvisual/runtime integration only.
