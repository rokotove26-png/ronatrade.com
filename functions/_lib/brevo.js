const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
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

export async function sendFormEmail(env, payload) {
  const config = CHANNELS[payload.channel];
  if (!config || !env.BREVO_API_KEY) return false;

  const language = payload.language === 'EN' ? 'EN' : 'RU';
  const message = {
    sender: {
      name: env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME,
      email: env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL
    },
    to: [{ email: config.recipient }],
    subject: config.subjects[language],
    textContent: renderText(config, payload),
    htmlContent: renderHtml(config, payload),
    headers: {
      'X-RONA-Submission-ID': payload.submission_id,
      'X-RONA-Channel': payload.channel
    }
  };

  if (validEmail(payload.reply_to)) {
    message.replyTo = { email: payload.reply_to };
  }

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
    return response.ok;
  } catch {
    return false;
  }
}
