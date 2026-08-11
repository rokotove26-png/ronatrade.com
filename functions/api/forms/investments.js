const MAX_BODY_BYTES = 24 * 1024;
const DEDUPE_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 600;
const RATE_LIMIT = 6;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function clean(value, max = 1000) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function validEmail(value) {
  if (!value || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');

  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (type.includes('application/json')) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    return text ? JSON.parse(text) : {};
  }

  if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    const data = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') data[key] = value;
    }
    return data;
  }

  throw new Error('UNSUPPORTED_MEDIA_TYPE');
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function applyRateLimit(request, kv) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / RATE_WINDOW_SECONDS);
  const key = `rate:investments:${await sha256(ip)}:${bucket}`;
  const current = Number(await kv.get(key) || '0');
  if (current >= RATE_LIMIT) return false;
  await kv.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SECONDS * 2 });
  return true;
}

async function fingerprint(request, fields) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  return sha256(JSON.stringify({
    ip,
    name: fields.name,
    contact: fields.contact,
    company_role: fields.company_role,
    topic: fields.topic,
    message: fields.message
  }));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!sameOrigin(request)) {
    return json({ success: false, code: 'ORIGIN_REJECTED' }, 403);
  }

  if (!env.MAILER || !env.FORM_DEDUPE) {
    return json({ success: false, code: 'SERVICE_NOT_CONFIGURED' }, 503);
  }

  if (!(await applyRateLimit(request, env.FORM_DEDUPE))) {
    return json({ success: false, code: 'RATE_LIMITED' }, 429);
  }

  let data;
  try {
    data = await parseBody(request);
  } catch (error) {
    if (error?.message === 'BODY_TOO_LARGE') return json({ success: false, code: 'BODY_TOO_LARGE' }, 413);
    if (error?.message === 'UNSUPPORTED_MEDIA_TYPE') return json({ success: false, code: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
    return json({ success: false, code: 'INVALID_BODY' }, 400);
  }

  const honey = clean(data._honey || data._gotcha || data.website || data.company_website, 200);
  if (honey) {
    return json({ success: true, status: 'accepted' }, 202);
  }

  const language = clean(data.Language || data.language, 8).toUpperCase() === 'EN' ? 'EN' : 'RU';
  const fields = {
    name: clean(data.name, 160),
    contact: clean(data.contact, 200),
    company_role: clean(data.company_role, 240),
    topic: clean(data.topic, 240),
    message: clean(data.message, 700),
    language,
    client_timestamp: clean(data['Дата / время отправки'] || data['Submission date / time'], 100),
    page_url: clean(data['URL страницы / источник'] || data['Page URL / Source'], 500)
  };

  if (!fields.name || !fields.contact || !fields.topic) {
    return json({ success: false, code: 'REQUIRED_FIELDS_MISSING' }, 400);
  }

  // The current UI accepts phone / WhatsApp / Telegram in the contact field.
  // If a user enters an email address there, validate it before using it as Reply-To.
  const replyTo = fields.contact.includes('@') && validEmail(fields.contact) ? fields.contact : '';

  const dedupeKey = `investments:${await fingerprint(request, fields)}`;
  const existing = await env.FORM_DEDUPE.get(dedupeKey);
  if (existing) {
    return json({ success: true, status: 'accepted', duplicate: true }, 202);
  }

  await env.FORM_DEDUPE.put(dedupeKey, 'pending', { expirationTtl: DEDUPE_TTL_SECONDS });

  const submissionId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  try {
    const mailResponse = await env.MAILER.fetch('https://mailer.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        channel: 'investments',
        submission_id: submissionId,
        received_at: receivedAt,
        language: fields.language,
        source_url: fields.page_url,
        reply_to: replyTo,
        fields
      })
    });

    if (!mailResponse.ok) {
      await env.FORM_DEDUPE.delete(dedupeKey);
      return json({ success: false, code: 'DELIVERY_FAILED' }, 502);
    }

    await env.FORM_DEDUPE.put(dedupeKey, submissionId, { expirationTtl: DEDUPE_TTL_SECONDS });
    return json({ success: true, status: 'accepted', submission_id: submissionId }, 202);
  } catch {
    await env.FORM_DEDUPE.delete(dedupeKey);
    return json({ success: false, code: 'DELIVERY_FAILED' }, 502);
  }
}

export function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405);
}
