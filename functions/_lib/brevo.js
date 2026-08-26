const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 6000;
const DEFAULT_SENDER_EMAIL = 'office_kg@ronaoil.com';
const DEFAULT_SENDER_NAME = 'RONA Trade Website';

const CHANNELS = {
  trade: {
    recipient: 'office_kg@ronaoil.com',
    subjects: {
      RU: 'RONA Trade — новая заявка с сайта',
      EN: 'RONA Trade — new website request'
    },
    labels: {
      contact_name: 'Контактное лицо / Contact person',
      company: 'Компания / Company',
      registration_country: 'Страна регистрации / Registration country',
      product: 'Нефтепродукт / Petroleum product',
      destination_country: 'Страна назначения / Destination country',
      volume_tonnes: 'Объём, т / Volume, t',
      phone: 'Телефон / Phone',
      email: 'E-mail',
      comment: 'Комментарий / Comment',
      source_client: 'Источник / Source',
      client_timestamp: 'Дата отправки клиентом / Client timestamp',
      language: 'Язык / Language',
      page_url: 'Страница / Page URL'
    }
  },
  investments: {
    recipient: 'rokotove26@gmail.com',
    subjects: {
      RU: 'RONA Investments — новая заявка на консультацию',
      EN: 'RONA Investments — new consultation request'
    },
    labels: {
      name: 'Имя / Name',
      contact: 'Контакт / Contact',
      company_role: 'Компания / роль / Company / role',
      topic: 'Тема / Topic',
      message: 'Сообщение / Message',
      language: 'Язык / Language',
      client_timestamp: 'Дата отправки клиентом / Client timestamp',
      page_url: 'Страница / Page URL'
    }
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function validEmail(value) {
  if (!value || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function renderText(config, payload) {
  const lines = [
    `Submission ID: ${payload.submission_id}`,
    `Received at: ${payload.received_at}`,
    `Source URL: ${payload.source_url || ''}`,
    ''
  ];

  for (const [key, label] of Object.entries(config.labels)) {
    const value = payload.fields?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      lines.push(`${label}: ${String(value).trim()}`);
    }
  }

  return lines.join('\n');
}

function renderHtml(config, payload) {
  const rows = [];
  for (const [key, label] of Object.entries(config.labels)) {
    const value = payload.fields?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      rows.push(`<tr><th align="left" style="padding:6px 10px;border:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 10px;border:1px solid #ddd;white-space:pre-wrap">${escapeHtml(String(value).trim())}</td></tr>`);
    }
  }

  return `<!doctype html><html><body><p><strong>Submission ID:</strong> ${escapeHtml(payload.submission_id)}</p><p><strong>Received at:</strong> ${escapeHtml(payload.received_at)}</p><p><strong>Source URL:</strong> ${escapeHtml(payload.source_url || '')}</p><table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows.join('')}</table></body></html>`;
}

function sanitizeDiagnostic(value, max = 300) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function logBrevoFailure(response) {
  let code = '';
  let message = '';

  try {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        code = sanitizeDiagnostic(parsed?.code, 80);
        message = sanitizeDiagnostic(parsed?.message, 300);
      } catch {
        message = sanitizeDiagnostic(text, 300);
      }
    }
  } catch {
    // Ignore diagnostic body parsing failures; status is still logged below.
  }

  console.error(JSON.stringify({
    event: 'BREVO_SEND_FAILED',
    status: response.status,
    status_text: sanitizeDiagnostic(response.statusText, 80),
    code,
    message
  }));
}

async function sendViaBrevo(env, message) {
  if (!env.BREVO_API_KEY) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BREVO_TIMEOUT_MS);
  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify(message),
      signal: controller.signal
    });

    if (!response.ok) {
      await logBrevoFailure(response);
      return false;
    }

    console.log(JSON.stringify({
      event: 'BREVO_SEND_OK',
      status: response.status
    }));
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'BREVO_SEND_EXCEPTION',
      name: sanitizeDiagnostic(error?.name, 80),
      message: sanitizeDiagnostic(error?.message, 300)
    }));
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaMailerBinding(env, payload) {
  if (!env.MAILER || typeof env.MAILER.fetch !== 'function') return false;
  try {
    const response = await env.MAILER.fetch('https://mailer.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendFormEmail(env, payload) {
  const config = CHANNELS[payload.channel];
  if (!config) return false;

  const language = payload.language === 'EN' ? 'EN' : 'RU';
  const normalizedPayload = { ...payload, language };
  const message = {
    sender: {
      name: env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME,
      email: env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL
    },
    to: [{ email: config.recipient }],
    subject: config.subjects[language],
    textContent: renderText(config, normalizedPayload),
    htmlContent: renderHtml(config, normalizedPayload),
    headers: {
      'X-RONA-Submission-ID': payload.submission_id,
      'X-RONA-Channel': payload.channel
    }
  };

  if (validEmail(payload.reply_to)) {
    message.replyTo = { email: payload.reply_to };
  }

  if (await sendViaBrevo(env, message)) return true;
  return sendViaMailerBinding(env, normalizedPayload);
}
