# RONA Trade — Cloudflare Staging Deployment Manifest v1.1

Status: STAGING ONLY / NO PRODUCTION DNS CHANGES
Date: 2026-08-11
Repository: rokotove26-png/ronatrade.com
Branch: staging/public-go-live-v1.1

## 1. Deployment model

Public website is deployed to Cloudflare Pages. Form delivery is handled by Pages Functions and a separate internal Worker service binding.

Public runtime remains visually frozen. The build step copies runtime files byte-for-byte into `dist`; no HTML, CSS, image, SVG, or text transformation is allowed.

## 2. Cloudflare Pages project

Recommended project name: `rona-trade-public`

Initial staging deployment settings:
- Git provider: GitHub
- Repository: `rokotove26-png/ronatrade.com`
- Production branch during staging phase: `staging/public-go-live-v1.1`
- Root directory: repository root
- Build command: `npm run build`
- Build output directory: `dist`
- Framework preset: None
- Custom production domain: DO NOT ADD during staging
- `ronatrade.com`: DO NOT CHANGE during staging

The `*.pages.dev` deployment is the initial staging endpoint. After all technical, security, routing, responsive, language, and real-email delivery gates pass, the validated source is promoted to the production branch under the release procedure.

## 3. Pages Functions

Functions source directory: `/functions`

Published routes are controlled by `/_routes.json` and are intentionally limited to:
- `/api/forms/*`
- `/pages/home_large.html`
- `/pages/home_compact.html`
- `/en/pages/home_large.html`
- `/en/pages/home_compact.html`
- `/investments/home.html`
- `/en/investments/home.html`

All other public routes should remain static.

## 4. KV binding

Create a Workers KV namespace for staging:
- Recommended resource name: `rona-public-form-dedupe-staging`
- Pages binding variable: `FORM_DEDUPE`

Purpose:
- duplicate-submission suppression;
- basic per-IP rate-limit buckets;
- short-lived form-control state only.

Do not store full form payloads, client documents, business files, passwords, authentication data, or sensitive PII in this KV namespace.

## 5. Mailer Worker

Worker name: `rona-public-mailer`

Source:
- `/workers/mailer/src/index.js`
- `/workers/mailer/wrangler.jsonc`

Email binding:
- variable: `EMAIL`
- allowed sender: `forms@ronatrade.com`
- allowed destinations:
  - `office_kg@ronaoil.com`
  - `rokotove26@gmail.com`

Before deployment:
1. `ronatrade.com` must be onboarded to Cloudflare Email Service for sending.
2. `forms@ronatrade.com` must be valid for the onboarded sending domain.
3. Both destination addresses must be permitted/verified as required by the active Email Service account configuration.

No external SMTP/API secret is required by the current Cloudflare Email Service binding architecture.

## 6. Service binding

Add a Pages service binding:
- Variable name: `MAILER`
- Service: `rona-public-mailer`

The browser never calls the mailer Worker directly. Pages Functions invoke the Worker over the Cloudflare service binding.

## 7. Form routing

Required staging flow:

`Public form -> same-origin /api/forms/{channel} -> validation -> honeypot -> rate limit/dedupe -> MAILER service binding -> Cloudflare Email Service -> fixed recipient`

Channels:
- RONA Trade: `/api/forms/trade` -> `office_kg@ronaoil.com`
- RONA Investments: `/api/forms/investments` -> `rokotove26@gmail.com`

## 8. Security controls

Required before staging acceptance:
- no API keys, passwords, tokens, SMTP credentials, service-role keys, or private credentials in GitHub;
- no arbitrary recipient address supplied by browser;
- sender and recipient restrictions enforced by Email Service binding;
- same-origin POST enforcement;
- request-size limits;
- Content-Type validation;
- input length limits and control-character stripping;
- HTML escaping in generated email;
- honeypot handling;
- duplicate suppression;
- basic rate limiting;
- no sensitive form payload logging in public logs.

## 9. Staging acceptance tests

Minimum tests after first Pages deployment:
- `/` loads and redirects/selects the correct desktop layout;
- `/en/` loads EN layout;
- `/investments/` loads RU Investments;
- `/en/investments/` loads EN Investments;
- all six form-bearing HTML routes return HTTP 200;
- form pages return `x-rona-form-transport: controlled-v1.1`;
- POST `/api/forms/trade` with invalid origin returns 403;
- unsupported content type returns 415;
- malformed payload returns 400;
- rate limit eventually returns 429;
- duplicate request is accepted without a second email;
- valid Trade form returns 202 and email is actually received at `office_kg@ronaoil.com`;
- valid Investments form returns 202 and email is actually received at `rokotove26@gmail.com`;
- RU and EN subjects/content are correct;
- no request is sent to FormSubmit in browser network logs;
- no visible layout or typography regression.

HTTP 200/202 alone is not proof of successful email delivery. Inbox receipt or equivalent provider delivery confirmation is required.

## 10. Production gate

Do not attach `ronatrade.com`, modify production DNS, merge to the production branch, or treat staging as production until all publication-command gates pass.

Production authorization exists, but production deployment remains blocked until required gates pass.

## 11. Rollback

Staging rollback point is the last known-good Git commit before the failing infrastructure change. Public visual baseline remains preserved separately on `release/public-bilingual-v1.0.1` at commit `e52ec3b26ccdef383a3936e9b06e05eabe49d46e`.
