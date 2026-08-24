# Clients & Agents UI archive

This directory records superseded visual implementations of the Admin Portal section `Клиенты и агенты`.

The old visual shells are no longer production runtime owners. They remain recoverable from Git history:

- v2 overlay: merge commit `620953cd987ff141d993e816ea633188edfeed13` (PR #176)
- v3 duplicate-render correction: merge commit `146b7c0afa9965d4494c21107ef47924580e5ff5` (PR #177)

Production runtime now uses `functions/portal/clients-agents-v4-ui.js` as the single visible owner of `#page-access`.

The frozen base portal remains only as a compatibility substrate for existing access, contract and user-management handlers. It is hidden before first paint and may only surface functional controls inside the v4 `Пользователи и доступы` workspace; it must not render a second visual cabinet.
