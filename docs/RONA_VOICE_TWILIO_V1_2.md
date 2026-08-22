# RONA Voice — Twilio self-service fast path V1.2

Status: fail-closed adapter. The code and production foundation can be deployed without a Twilio account, but live calling must remain disabled until real external credentials and a real voice number exist and pass live tests.

## Why this path exists

Twilio is the preferred no-sales-wait fallback for RONA Voice when international outbound calling is required. The public Twilio pricing model is pay-as-you-go with no committed-use requirement for normal usage, and Twilio publishes outbound Voice pricing for Kyrgyzstan. A foreign voice-enabled number is acceptable; +996 is not required.

## Architecture

Inbound:

`Twilio voice number -> signed Twilio webhook -> TwiML Dial/Sip TLS -> OpenAI Realtime SIP -> signed OpenAI webhook -> RONA Twilio Adapter -> fixed external voice role`

Outbound:

`authoritative non-QA RONA coordination record -> authenticated ADMIN voice request -> Twilio Calls API -> PSTN destination -> signed Twilio answer webhook -> OpenAI Realtime SIP -> fixed external voice role`

## Security boundary

The voice session is an external communication surface. It has no RONA MCP/current-state tools in V1.2 and is accepted with `tool_choice=none`.

Phone number, Caller ID, spoken name, spoken company, email, Twilio CallSid, SIP headers, and previous-call history do not create Portal User identity or client/agent/company/contract binding.

Protected RONA information must not be disclosed merely because the caller reaches a fixed role. The voice model cannot fabricate internal facts or claim that an internal action/handoff was created.

Internal staff communication remains in the audited network coordination contour. Internal email remains prohibited for internal handoffs.

SYSTEM_ADMIN is not a voice business target.

## Required protected runtime secrets

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_E164`
- `OPENAI_API_KEY`
- `OPENAI_WEBHOOK_SECRET`
- `OPENAI_PROJECT_ID`

Optional:

- `RONA_VOICE_REALTIME_MODEL` (default `gpt-realtime`)

Never commit these values or store them in voice/audit metadata.

## Public callback endpoints

Twilio inbound Voice webhook, POST:

`https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-voice-twilio-adapter/twilio/inbound/answer`

Twilio outbound answer and status URLs are generated server-side by the adapter.

OpenAI Realtime project webhook:

`https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-voice-twilio-adapter/openai/webhook`

## Request authenticity

Every Twilio webhook requires a valid `X-Twilio-Signature`. V1.2 validates the documented Twilio algorithm over the exact callback URL plus alphabetically sorted form parameters using HMAC-SHA1 with the protected Twilio Auth Token. Missing credentials fail closed; missing/invalid signatures are rejected.

The OpenAI webhook is verified with the protected OpenAI webhook secret before any call is accepted.

## SIP binding

Twilio TwiML `<Dial><Sip>` targets:

`sip:<OPENAI_PROJECT_ID>@sip.api.openai.com;transport=tls`

Minimal `x-` SIP headers bind the Realtime incoming call to an already persisted trusted Twilio call or an already authorized outbound request. Direct or unbound SIP calls to the OpenAI project are rejected.

## Provider prepare workflow

`POST /admin/provider/prepare` requires a real authenticated ADMIN session. It verifies that all protected runtime inputs exist, probes the Twilio Account API and configured OpenAI Realtime model, then records only `CONFIGURED` / `TESTING` states.

It deliberately leaves:

- `enabled=false`
- `inbound_enabled=false`
- `outbound_enabled=false`
- `activation_gate=FOUNDATION`

A credential probe cannot silently activate production calling.

## Outbound authority

`POST /admin/outbound/request` requires:

- authenticated ADMIN;
- real non-QA `ai_coordination_records.record_id`;
- fixed business target role present on that source record;
- E.164 destination;
- explicit call purpose;
- unique idempotency key;
- full Twilio/OpenAI production readiness gate.

If the gate is not ready, the request is persisted as `BLOCKED` and no provider call is simulated.

## Recording/transcription

Existing defaults remain authoritative:

- recording: `DISABLED`
- transcript: `METADATA_ONLY`

Twilio recording must not be enabled independently of an approved RONA legal/retention policy.

## External account setup

After creating a Twilio account:

1. Rent any suitable voice-capable number. +996 is not required.
2. Set that number's incoming Voice webhook to the RONA Twilio inbound endpoint above, method POST.
3. Keep recording disabled.
4. Enable only the outbound geographic permissions actually required by RONA.
5. Put Twilio/OpenAI credentials only into the protected Supabase Edge Function secret store.
6. Configure the OpenAI project webhook to the RONA Twilio OpenAI endpoint above.
7. Run authenticated provider prepare.
8. Complete one real inbound test and one real outbound test.
9. Only then promote provider/OpenAI/model states to READY and the activation gate to PRODUCTION_READY through the authoritative admin workflow.

Until step 8 succeeds, live telephony remains blocked by design.
