const TOKEN = 'a5c7e2f1-948d-4e56-8c2a-79f6b4426f3d';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

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

function safe(value, max = 240) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function responseDiagnostic(response) {
  let code = '';
  let message = '';
  try {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        code = safe(parsed?.code, 100);
        message = safe(parsed?.message || parsed?.error || text, 240);
      } catch {
        message = safe(text, 240);
      }
    }
  } catch {
    // Status is still useful if body cannot be read.
  }
  return { ok: response.ok, status: response.status, code, message };
}

async function testBrevo(env, submissionId, now) {
  if (!env.BREVO_API_KEY) return { configured: false };
  const message = {
    sender: {
      name: env.BREVO_SENDER_NAME || 'RONA Trade Website',
      email: env.BREVO_SENDER_EMAIL || 'office_kg@ronaoil.com'
    },
    to: [{ email: 'office_kg@ronaoil.com' }],
    subject: 'RONA Trade delivery diagnostic',
    textContent: `Synthetic delivery diagnostic ${submissionId} at ${now}. Ignore.`,
    htmlContent: `<p>Synthetic delivery diagnostic <strong>${submissionId}</strong> at ${now}. Ignore.</p>`,
    headers: {
      'X-RONA-Submission-ID': submissionId,
      'X-RONA-Channel': 'trade-diagnostic'
    }
  };

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify(message)
    });
    return { configured: true, ...(await responseDiagnostic(response)) };
  } catch (error) {
    return { configured: true, ok: false, status: 0, code: safe(error?.name, 100), message: safe(error?.message, 240) };
  }
}

async function testMailer(env, submissionId, now) {
  if (!env.MAILER || typeof env.MAILER.fetch !== 'function') return { configured: false };
  const payload = {
    channel: 'trade',
    submission_id: submissionId,
    received_at: now,
    language: 'RU',
    source_url: 'https://rona-trade-public.pages.dev/api/forms/delivery-diagnostic',
    reply_to: '',
    fields: {
      contact_name: 'RONA SYSTEM TEST',
      company: 'RONA Trade delivery diagnostic',
      registration_country: 'Kyrgyzstan',
      product: 'TEST ONLY',
      destination_country: 'Kyrgyzstan',
      volume_tonnes: '1',
      email: 'office_kg@ronaoil.com',
      comment: 'Synthetic delivery diagnostic. Ignore.'
    }
  };

  try {
    const response = await env.MAILER.fetch('https://mailer.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return { configured: true, ...(await responseDiagnostic(response)) };
  } catch (error) {
    return { configured: true, ok: false, status: 0, code: safe(error?.name, 100), message: safe(error?.message, 240) };
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('token') !== TOKEN) return json({ success: false, code: 'NOT_FOUND' }, 404);

  const submissionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const [brevo, mailer] = await Promise.all([
    testBrevo(env, submissionId, now),
    testMailer(env, submissionId, now)
  ]);

  return json({ success: true, submission_id: submissionId, brevo, mailer });
}
