# RONA Voice Gateway — Plivo transport V1.1

Status: fail-closed provider adapter; live calling remains disabled until real external credentials/number are provisioned and verified.

## Target path

Inbound:

`Plivo PSTN number -> signed Plivo answer callback -> SIP/TLS -> OpenAI Realtime SIP -> signed OpenAI webhook -> RONA Voice Gateway -> fixed external voice role`

Outbound:

`authoritative non-QA coordination record -> authenticated Admin voice request -> Plivo Voice API -> PSTN destination -> signed Plivo answer callback -> SIP/TLS -> OpenAI Realtime SIP -> fixed external voice role`

The adapter does not expose an internal employee MCP/current-state connector to a telephone caller. V1.1 uses `FIXED_ROLE_NO_INTERNAL_TOOLS_V1`; the Realtime session has `tool_choice=none`. This prevents internal Finance/Legal/Rail/Operations data from crossing the external voice boundary merely because a call reached a fixed role.

## External runtime secrets

Secrets must be provisioned only in the protected runtime secret store. Never commit or write them to coordination/audit/call metadata.

Required:

- `PLIVO_AUTH_ID`
- `PLIVO_AUTH_TOKEN`
- `PLIVO_FROM_E164`
- `OPENAI_API_KEY`
- `OPENAI_WEBHOOK_SECRET`
- `OPENAI_PROJECT_ID`

Optional:

- `RONA_VOICE_REALTIME_MODEL` (default `gpt-realtime`)

## Public endpoints

- `GET /health` — non-secret liveness.
- `POST /plivo/inbound/answer` — Plivo answer URL; Plivo V3 signature is mandatory.
- `POST /plivo/outbound/answer?rid=<uuid>` — answer URL for an authorized outbound request; Plivo V3 signature is mandatory.
- `POST /plivo/dial-status[?rid=<uuid>]` — signed Dial/action/status callbacks.
- `POST /openai/webhook` — OpenAI webhook; OpenAI webhook signature is mandatory.

Admin-only:

- `GET /admin/health`
- `POST /admin/provider/plivo/prepare`
- `POST /admin/outbound/request`

## Provider verification and activation

`/admin/provider/plivo/prepare` only verifies that all required runtime secrets are present and that Plivo credentials plus the configured Realtime model can be reached. A successful probe sets provider/OpenAI state to `CONFIGURED`, model state to `TESTING`, keeps activation at `FOUNDATION`, and explicitly leaves inbound/outbound disabled.

Production calling requires a separate tested activation to `PRODUCTION_READY`. Database constraints continue to prevent enabling inbound or outbound unless provider, OpenAI Realtime and voice model execution are all `READY`.

## Plivo callback authenticity

All Plivo webhook endpoints implement Plivo V3 verification using:

- `X-Plivo-Signature-V3`
- `X-Plivo-Signature-V3-Nonce`
- HMAC-SHA256 with `PLIVO_AUTH_TOKEN`
- the full callback URL plus sorted form parameters plus nonce

Missing credentials fail closed. Missing/invalid signatures are rejected. The raw webhook body is not persisted.

## OpenAI SIP binding

SIP target:

`sip:<OPENAI_PROJECT_ID>@sip.api.openai.com;transport=tls`

The Plivo `<Dial><User>` bridge sends only minimal alphanumeric routing headers:

- `RonaDirection`
- `RonaProviderCall`
- `RonaRole`
- `RonaRequest` for outbound calls

OpenAI receives those as SIP headers. The gateway accepts a Realtime SIP call only if it can bind the SIP header to an already persisted Plivo call or authorized outbound request. Direct/unbound calls to the OpenAI project SIP address are rejected.

## Identity and information boundary

A phone number, caller name, email address, spoken company name, SIP header, address-book match or prior call history is not Portal User identity and does not create any client/agent/company/contract binding.

V1.1 voice sessions have no internal RONA tools. They must not invent or disclose:

- client contracts or private documents;
- payments/bank/accounting state;
- private prices or internal economics;
- internal Legal/Rail/Market/Finance conclusions;
- IAM/binding data;
- QA identities;
- diagnostics, credentials, tokens or secrets.

If exact or protected information is required, the model must state that verification is required and must not claim that an internal handoff or mutation was created.

## Outbound authority

An outbound call can only be dispatched from authenticated ADMIN workflow and requires:

- a real non-QA `ai_coordination_records.record_id`;
- an allowed fixed business target role;
- the target role to occur on that source coordination record;
- E.164 destination;
- explicit purpose;
- unique idempotency key;
- full production voice gate READY.

When the gate is not ready, the request is persisted as `BLOCKED`; no provider call is simulated.

When ready, the Admin workflow records authorization before calling Plivo. Provider failures are persisted as `FAILED`. Plivo request identifiers are stored, but provider credentials are never stored.

## Default inbound role

`voice_gateway_control.default_inbound_role` defaults to `OPERATIONS_DIRECTOR` and cannot be `SYSTEM_ADMIN`.

This is a fixed external voice role with no internal tools in V1.1. Multi-role conversational transfer is intentionally not enabled until a separately designed role-safe voice tool/projection exists.

## Recording and transcripts

V1.1 does not enable recording. Existing default remains:

- recording: `DISABLED`
- transcript: `METADATA_ONLY`

No audio or transcript retention may be enabled solely by provider configuration.

## Required Plivo console/API configuration after account provisioning

1. Obtain one voice-capable Plivo number (country code is not constrained to +996).
2. Configure the number/application Primary Answer URL to:
   `https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-voice-gateway/plivo/inbound/answer`
3. Use POST callbacks.
4. Keep recording off.
5. Do not expose Auth ID/Auth Token in URLs.
6. Configure the OpenAI project webhook to:
   `https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-voice-gateway/openai/webhook`
7. Run the authenticated provider probe.
8. Perform real inbound and outbound test calls before any `PRODUCTION_READY` activation.

## Acceptance gates

Adapter code PASS requires:

- migration applied;
- gateway v1.1 deployed;
- health 200;
- unsigned Plivo callback denied;
- OpenAI webhook without credentials denied;
- unauthenticated Admin denied;
- existing LK/MCP/owner gates remain green;
- live calling stays disabled without real provider evidence.

Full telephony PASS additionally requires real Plivo/OpenAI credentials, a real phone number, signed callback evidence, one real inbound test, one real outbound test, and explicit production activation. Until then status is `OWNER ACTION REQUIRED`, not simulated PASS.
