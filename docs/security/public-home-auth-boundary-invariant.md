# Public Home / Protected Portal Security Invariant

Status: NON-NEGOTIABLE PRODUCTION SECURITY BOUNDARY

## Invariant

Opening any public RONA Trade page, including https://ronaoil.com, MUST NOT by itself:

- request /portal/admin, /portal/select, /portal/staff, /portal/agent, or /portal/client;
- probe an existing protected portal session;
- resume an Admin, Agent, Client, or Staff session;
- navigate the browser into any protected portal route;
- create, rotate, refresh, or otherwise use portal authentication solely because a public page was opened.

A transition from the public site into a protected portal is allowed only after an explicit user authentication action or an explicit user navigation to a protected route. Protected routes remain responsible for server-side session and role validation.

## Threat model

A valid browser session can remain present in Path=/portal cookies. Public content must never use those cookies as a reason to enter a protected area automatically. Doing so can expose commercial information to anyone who opens the public site in a browser with a residual authenticated session.

## Permanent controls

1. Static source contract: tests/public-home-auth-boundary.test.mjs
2. Browser fixture proof: scripts/qa-public-home-auth-boundary-browser.mjs
3. Production browser proof on every push to release/public-go-live-v1.1
4. Cache-busted public auth runtime marker in functions/_middleware.js
5. Fail the Public home auth boundary QA check on any protected-route request or navigation during public-page load.

This invariant must not be weakened to improve convenience, session restoration, or automatic login behavior.
