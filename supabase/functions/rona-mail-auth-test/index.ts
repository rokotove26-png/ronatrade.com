import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const MAILBOX = "office_kg@ronaoil.com";
const DESTINATION = "office_kg@ronaoil.com";
const BRIDGE_URL = "https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-mail-bridge";
const MAX_BODY_BYTES = 32 * 1024;
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function readJsonLimited(req: Request) {
  const advertised = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(advertised) && advertised > MAX_BODY_BYTES) {
    return { error: "REQUEST_TOO_LARGE" as const };
  }

  const reader = req.body?.getReader();
  if (!reader) return { error: "INVALID_JSON" as const };

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value?.length) continue;
    total += value.length;
    if (total > MAX_BODY_BYTES) {
      try { await reader.cancel(); } catch (_) {}
      return { error: "REQUEST_TOO_LARGE" as const };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const body = JSON.parse(text);
    if (!body || Array.isArray(body) || typeof body !== "object") return { error: "INVALID_JSON" as const };
    return { body };
  } catch {
    return { error: "INVALID_JSON" as const };
  }
}

function clean(value: unknown, max = 1000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function validEmail(value: string) {
  return !!value && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const LABELS: Record<string, string> = {
  contact_name: "Контактное лицо / Contact person",
  company: "Компания / Company",
  registration_country: "Страна регистрации / Registration country",
  product: "Нефтепродукт / Petroleum product",
  destination_country: "Страна назначения / Destination country",
  volume_tonnes: "Объём, т / Volume, t",
  phone: "Телефон / Phone",
  email: "E-mail",
  comment: "Комментарий / Comment",
  source_client: "Источник / Source",
  client_timestamp: "Дата отправки клиентом / Client timestamp",
  language: "Язык / Language",
  page_url: "Страница / Page URL",
};

function normalizePayload(input: any) {
  const language = input?.language === "EN" ? "EN" : "RU";
  const sourceUrl = clean(input?.source_url, 700);
  const fieldsIn = input?.fields && typeof input.fields === "object" ? input.fields : {};
  const fields: Record<string, string> = {
    contact_name: clean(fieldsIn.contact_name, 160),
    company: clean(fieldsIn.company, 200),
    registration_country: clean(fieldsIn.registration_country, 120),
    product: clean(fieldsIn.product, 160),
    destination_country: clean(fieldsIn.destination_country, 120),
    volume_tonnes: clean(fieldsIn.volume_tonnes, 40),
    phone: clean(fieldsIn.phone, 80),
    email: clean(fieldsIn.email, 254),
    comment: clean(fieldsIn.comment, 2000),
    source_client: clean(fieldsIn.source_client, 240),
    client_timestamp: clean(fieldsIn.client_timestamp, 100),
    language,
    page_url: clean(fieldsIn.page_url || sourceUrl, 700),
  };
  return {
    channel: clean(input?.channel, 40),
    submissionId: clean(input?.submission_id, 80),
    receivedAt: clean(input?.received_at, 100),
    replyTo: clean(input?.reply_to, 254),
    language,
    sourceUrl,
    fields,
  };
}

function renderMail(payload: ReturnType<typeof normalizePayload>) {
  const subject = payload.language === "EN"
    ? "RONA Trade — new website request"
    : "RONA Trade — новая заявка с сайта";

  const meta = [
    ["Submission ID", payload.submissionId],
    ["Received at", payload.receivedAt],
    ["Source URL", payload.sourceUrl],
  ].filter((x) => x[1]) as string[][];

  const rows = Object.entries(LABELS)
    .map(([key, label]) => [label, payload.fields[key]])
    .filter((x) => x[1]) as string[][];

  const text = [
    subject,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    ...meta.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  const htmlRows = rows.map(([label, value]) =>
    `<tr><td style="padding:6px 10px;font-weight:600;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 10px;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
  ).join("");
  const htmlMeta = meta.map(([label, value]) =>
    `<tr><td style="padding:5px 10px;font-weight:600;vertical-align:top">${escapeHtml(label)}</td><td style="padding:5px 10px">${escapeHtml(value)}</td></tr>`
  ).join("");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111"><h2>${escapeHtml(subject)}</h2><table style="border-collapse:collapse">${htmlRows}</table><hr><table style="border-collapse:collapse;font-size:12px;color:#555">${htmlMeta}</table></body></html>`;
  return { subject, text, html };
}

async function invokeMailBridge() {
  const rows = await sql<{ token: string }[]>`
    select token from private.rona_mail_bridge_runtime_secret where singleton = true limit 1
  `;
  const token = rows[0]?.token ?? "";
  if (!token) throw new Error("MAIL_BRIDGE_TOKEN_MISSING");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rona-mail-internal-key": token,
      },
      body: JSON.stringify({ action: "process-outbox" }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`MAIL_BRIDGE_HTTP_${response.status}`);
    return await response.json().catch(() => ({}));
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const parsed = await readJsonLimited(req);
    if ("error" in parsed) {
      return json(
        { success: false, code: parsed.error },
        parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400,
      );
    }

    const payload = normalizePayload(parsed.body);
    if (payload.channel !== "trade" || !validUuid(payload.submissionId)) {
      return json({ success: false, code: "INVALID_PAYLOAD" }, 400);
    }
    if (!payload.fields.contact_name || !payload.fields.company || !payload.fields.registration_country || !payload.fields.product || !payload.fields.destination_country) {
      return json({ success: false, code: "REQUIRED_FIELDS_MISSING" }, 400);
    }
    if (!payload.fields.phone && !payload.fields.email) {
      return json({ success: false, code: "CONTACT_METHOD_REQUIRED" }, 400);
    }
    if (payload.fields.email && !validEmail(payload.fields.email)) {
      return json({ success: false, code: "INVALID_EMAIL" }, 400);
    }

    const rate = await sql<{ n: number | string }[]>`
      select count(*)::int as n
      from public.rona_mail_outbox
      where requested_by = 'PUBLIC_TRADE_FORM'
        and created_at > now() - interval '10 minutes'
    `;
    if (Number(rate[0]?.n ?? 0) >= 12) {
      return json({ success: false, code: "RATE_LIMITED" }, 429);
    }

    const message = renderMail(payload);
    const replyTo = validEmail(payload.replyTo)
      ? payload.replyTo
      : (validEmail(payload.fields.email) ? payload.fields.email : null);

    const inserted = await sql<any[]>`
      insert into public.rona_mail_outbox
        (mailbox, to_addrs, cc_addrs, bcc_addrs, subject, text_body, html_body, reply_to, status, attempts, requested_by, idempotency_key, created_at, updated_at)
      values
        (${MAILBOX}, ${[DESTINATION]}::text[], ${[]}::text[], ${[]}::text[], ${message.subject}, ${message.text}, ${message.html}, ${replyTo}, 'QUEUED', 0, 'PUBLIC_TRADE_FORM', ${payload.submissionId}::uuid, now(), now())
      on conflict (idempotency_key) do nothing
      returning id, status
    `;

    if (!inserted.length) {
      const existing = await sql<any[]>`
        select status from public.rona_mail_outbox where idempotency_key = ${payload.submissionId}::uuid limit 1
      `;
      const status = existing[0]?.status ?? "UNKNOWN";
      if (status === "SENT") return json({ success: true, status: "sent", duplicate: true }, 202);
      if (status === "FAILED") {
        await sql`
          update public.rona_mail_outbox
          set status='QUEUED', attempts=0, locked_at=null, last_error=null, updated_at=now()
          where idempotency_key=${payload.submissionId}::uuid and status='FAILED'
        `;
      }
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      await invokeMailBridge();
      const state = await sql<any[]>`
        select status from public.rona_mail_outbox where idempotency_key = ${payload.submissionId}::uuid limit 1
      `;
      const status = state[0]?.status ?? "UNKNOWN";
      if (status === "SENT") return json({ success: true, status: "sent" }, 202);
      if (status === "FAILED") return json({ success: false, code: "SMTP_DELIVERY_FAILED" }, 502);
    }

    return json({ success: false, code: "DELIVERY_NOT_CONFIRMED" }, 503);
  } catch (error) {
    console.error("rona-trade-form-mailer", error instanceof Error ? error.message : String(error));
    return json({ success: false, code: "INTERNAL_ERROR" }, 502);
  }
});
