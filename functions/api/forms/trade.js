import { sendFormEmail } from '../../_lib/brevo.js';

const MAX_BODY_BYTES = 32 * 1024;
const DEDUPE_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 600;
const RATE_LIMIT = 6;

const FIELD_ALIASES = {
  contact_name: ['Контактное лицо', 'Contact Person'],
  company: ['Компания', 'Company'],
  registration_country: ['Страна регистрации компании', 'Company Registration Country'],
  product: ['Нефтепродукт', 'Petroleum Product'],
  destination_country: ['Страна назначения груза', 'Cargo Destination Country'],
  volume_tonnes: ['Ориентировочный объем, тонн', 'Estimated Volume, tonnes'],
  phone: ['Телефон', 'Phone'],
  email: ['E-mail', 'Email'],
  comment: ['Комментарий', 'Comments'],
  source_client: ['Источник', 'Source'],
  client_timestamp: ['Дата отправки', 'Submitted At'],
  language: ['Language'],
  page_url: ['URL страницы / источник', 'Page URL / Source']
};

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

function first(data, aliases, max = 1000) {
  for (const key of aliases) {
    const value = clean(data[key], max);
    if (value) return value;
  }
  return '';
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
  const key = `rate:trade:${await sha256(ip)}:${bucket}`;
  const current = Number(await kv.get(key) || '0');
  if (current >= RATE_LIMIT) return false;
  await kv.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SECONDS * 2 });
  return true;
}

async function fingerprint(request, fields) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  return sha256(JSON.stringify({
    ip,
    company: fields.company,
    contact_name: fields.contact_name,
    phone: fields.phone,
    email: fields.email,
    product: fields.product,
    destination_country: fields.destination_country,
    volume_tonnes: fields.volume_tonnes
  }));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!sameOrigin(request)) {
    return json({ success: false, code: 'ORIGIN_REJECTED' }, 403);
  }

  if ((!env.BREVO_API_KEY && !env.MAILER) || !env.FORM_DEDUPE) {
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

  const fields = {
    contact_name: first(data, FIELD_ALIASES.contact_name, 160),
    company: first(data, FIELD_ALIASES.company, 200),
    registration_country: first(data, FIELD_ALIASES.registration_country, 120),
    product: first(data, FIELD_ALIASES.product, 160),
    destination_country: first(data, FIELD_ALIASES.destination_country, 120),
    volume_tonnes: first(data, FIELD_ALIASES.volume_tonnes, 40),
    phone: first(data, FIELD_ALIASES.phone, 80),
    email: first(data, FIELD_ALIASES.email, 254),
    comment: first(data, FIELD_ALIASES.comment, 2000),
    source_client: first(data, FIELD_ALIASES.source_client, 240),
    client_timestamp: first(data, FIELD_ALIASES.client_timestamp, 100),
    language: first(data, FIELD_ALIASES.language, 8).toUpperCase() || 'RU',
    page_url: first(data, FIELD_ALIASES.page_url, 500)
  };

  if (!fields.contact_name || !fields.company || !fields.registration_country || !fields.product || !fields.destination_country) {
    return json({ success: false, code: 'REQUIRED_FIELDS_MISSING' }, 400);
  }
  if (!fields.phone && !fields.email) {
    return json({ success: false, code: 'CONTACT_METHOD_REQUIRED' }, 400);
  }
  if (fields.email && !validEmail(fields.email)) {
    return json({ success: false, code: 'INVALID_EMAIL' }, 400);
  }
  if (fields.language !== 'RU' && fields.language !== 'EN') fields.language = 'RU';

  const dedupeKey = `trade:${await fingerprint(request, fields)}`;
  const existing = await env.FORM_DEDUPE.get(dedupeKey);
  if (existing) {
    return json({ success: true, status: 'accepted', duplicate: true }, 202);
  }

  await env.FORM_DEDUPE.put(dedupeKey, 'pending', { expirationTtl: DEDUPE_TTL_SECONDS });

  const submissionId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  const delivered = await sendFormEmail(env, {
    channel: 'trade',
    submission_id: submissionId,
    received_at: receivedAt,
    language: fields.language,
    source_url: fields.page_url,
    reply_to: fields.email || '',
    fields
  });

  if (!delivered) {
    await env.FORM_DEDUPE.delete(dedupeKey);
    return json({ success: false, code: 'DELIVERY_FAILED' }, 502);
  }

  await env.FORM_DEDUPE.put(dedupeKey, submissionId, { expirationTtl: DEDUPE_TTL_SECONDS });
  return json({ success: true, status: 'accepted', submission_id: submissionId }, 202);
}

export function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405);
}
