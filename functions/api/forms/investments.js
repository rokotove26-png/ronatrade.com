import { sendFormEmail } from '../../_lib/brevo.js';

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
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function validEmail(value) {
  if (!value || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (type.includes('application/json')) return JSON.parse(await request.text() || '{}');
  if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string'));
  }
  throw new Error('UNSUPPORTED_MEDIA_TYPE');
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function applyRateLimit(request, kv) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const bucket = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS);
  const key = `rate:investments:${await sha256(ip)}:${bucket}`;
  const current = Number(await kv.get(key) || '0');
  if (current >= RATE_LIMIT) return false;
  await kv.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SECONDS * 2 });
  return true;
}

async function fingerprint(request, fields) {
  return sha256(JSON.stringify({
    ip: request.headers.get('cf-connecting-ip') || '',
    name: fields.name,
    contact: fields.contact,
    company_role: fields.company_role,
    topic: fields.topic,
    message: fields.message
  }));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!sameOrigin(request)) return json({ success: false, code: 'ORIGIN_REJECTED' }, 403);
  if ((!env.BREVO_API_KEY && !env.MAILER) || !env.FORM_DEDUPE) return json({ success: false, code: 'SERVICE_NOT_CONFIGURED' }, 503);
  if (!(await applyRateLimit(request, env.FORM_DEDUPE))) return json({ success: false, code: 'RATE_LIMITED' }, 429);

  let data;
  try { data = await parseBody(request); } catch { return json({ success: false, code: 'INVALID_BODY' }, 400); }

  if (clean(data._honey || data._gotcha || data.website || data.company_website, 200)) return json({ success: true, status: 'accepted' }, 202);

  const fields = {
    name: clean(data.name, 160),
    contact: clean(data.contact, 200),
    company_role: clean(data.company_role, 240),
    topic: clean(data.topic, 240),
    message: clean(data.message, 700),
    language: clean(data.Language || data.language, 8).toUpperCase() === 'EN' ? 'EN' : 'RU',
    client_timestamp: clean(data['Дата / время отправки'] || data['Submission date / time'], 100),
    page_url: clean(data['URL страницы / источник'] || data['Page URL / Source'], 500)
  };

  if (!fields.name || !fields.contact || !fields.topic) return json({ success: false, code: 'REQUIRED_FIELDS_MISSING' }, 400);

  const dedupeKey = `investments:${await fingerprint(request, fields)}`;
  if (await env.FORM_DEDUPE.get(dedupeKey)) return json({ success: true, status: 'accepted', duplicate: true }, 202);
  await env.FORM_DEDUPE.put(dedupeKey, 'pending', { expirationTtl: DEDUPE_TTL_SECONDS });

  const submissionId = crypto.randomUUID();
  const delivered = await sendFormEmail(env, {
    channel: 'investments',
    submission_id: submissionId,
    received_at: new Date().toISOString(),
    language: fields.language,
    source_url: fields.page_url,
    reply_to: fields.contact.includes('@') && validEmail(fields.contact) ? fields.contact : '',
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
