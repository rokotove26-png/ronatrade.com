// Sender compatibility probe: use the already-operational ronaoil.com mailbox identity.
const MAIL_FROM = 'office_kg@ronaoil.com';
const RECIPIENTS = Object.freeze({
  trade: 'office_kg@ronaoil.com',
  investments: 'rokotove26@gmail.com'
});

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

function clean(value, max = 2000) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return clean(value, 5000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeReplyTo(value) {
  const email = clean(value, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function subjectFor(channel, language) {
  if (channel === 'trade') {
    return language === 'EN'
      ? 'RONA Trade — new website request'
      : 'RONA Trade — новая заявка с сайта';
  }
  return language === 'EN'
    ? 'RONA Investments — new consultation request'
    : 'RONA Investments — новая заявка на консультацию';
}

function labelMap(channel, language) {
  if (channel === 'trade') {
    if (language === 'EN') {
      return {
        contact_name: 'Contact person',
        company: 'Company',
        registration_country: 'Registration country',
        product: 'Petroleum product',
        destination_country: 'Destination country',
        volume_tonnes: 'Estimated volume, tonnes',
        phone: 'Phone',
        email: 'E-mail',
        comment: 'Comment',
        source_client: 'Source'
      };
    }
    return {
      contact_name: 'Контактное лицо',
      company: 'Компания',
      registration_country: 'Страна регистрации',
      product: 'Нефтепродукт',
      destination_country: 'Страна назначения',
      volume_tonnes: 'Ориентировочный объём, тонн',
      phone: 'Телефон',
      email: 'E-mail',
      comment: 'Комментарий',
      source_client: 'Источник'
    };
  }

  if (language === 'EN') {
    return {
      name: 'Name',
      contact: 'Contact',
      company_role: 'Role / company',
      topic: 'Topic',
      message: 'Message'
    };
  }
  return {
    name: 'Имя',
    contact: 'Контакт',
    company_role: 'Роль / компания',
    topic: 'Тема',
    message: 'Сообщение'
  };
}

function renderEmail(payload) {
  const channel = payload.channel;
  const language = payload.language === 'EN' ? 'EN' : 'RU';
  const fields = payload.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const labels = labelMap(channel, language);

  const rows = [];
  for (const [key, label] of Object.entries(labels)) {
    const value = clean(fields[key], key === 'message' || key === 'comment' ? 2000 : 500);
    if (!value) continue;
    rows.push({ label, value });
  }

  const meta = [
    { label: 'Submission ID', value: clean(payload.submission_id, 100) },
    { label: language === 'EN' ? 'Received at' : 'Получено', value: clean(payload.received_at, 100) },
    { label: language === 'EN' ? 'Language' : 'Язык', value: language },
    { label: language === 'EN' ? 'Source URL' : 'URL источника', value: clean(payload.source_url, 700) }
  ].filter(item => item.value);

  const textLines = [
    subjectFor(channel, language),
    '',
    ...rows.map(row => `${row.label}: ${row.value}`),
    '',
    ...meta.map(row => `${row.label}: ${row.value}`)
  ];

  const htmlRows = rows.map(row =>
    `<tr><td style="padding:6px 10px;font-weight:600;vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:6px 10px;white-space:pre-wrap">${escapeHtml(row.value)}</td></tr>`
  ).join('');

  const htmlMeta = meta.map(row =>
    `<tr><td style="padding:5px 10px;font-weight:600;vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:5px 10px">${escapeHtml(row.value)}</td></tr>`
  ).join('');

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111"><h2>${escapeHtml(subjectFor(channel, language))}</h2><table style="border-collapse:collapse">${htmlRows}</table><hr><table style="border-collapse:collapse;font-size:12px;color:#555">${htmlMeta}</table></body></html>`;

  return {
    subject: subjectFor(channel, language),
    text: textLines.join('\n'),
    html
  };
}

async function handleSend(request, env) {
  if (request.method !== 'POST') return json({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, code: 'INVALID_JSON' }, 400);
  }

  const channel = clean(payload?.channel, 40);
  if (!Object.prototype.hasOwnProperty.call(RECIPIENTS, channel)) {
    return json({ success: false, code: 'INVALID_CHANNEL' }, 400);
  }

  if (!payload?.submission_id || !payload?.received_at || !payload?.fields || typeof payload.fields !== 'object') {
    return json({ success: false, code: 'INVALID_PAYLOAD' }, 400);
  }

  const language = payload.language === 'EN' ? 'EN' : 'RU';
  const destination = RECIPIENTS[channel];
  const rendered = renderEmail({ ...payload, channel, language });
  const replyTo = safeReplyTo(payload.reply_to);

  try {
    const message = {
      to: destination,
      from: { email: MAIL_FROM, name: channel === 'trade' ? 'RONA Trade Website' : 'RONA Investments Website' },
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      headers: {
        'X-RONA-Submission-ID': clean(payload.submission_id, 100),
        'X-RONA-Channel': channel
      }
    };
    if (replyTo) message.replyTo = replyTo;

    const result = await env.EMAIL.send(message);
    return json({ success: true, message_id: result.messageId }, 202);
  } catch (error) {
    const code = clean(error?.code || 'EMAIL_SEND_FAILED', 100);
    const status = code === 'E_RATE_LIMIT_EXCEEDED' || code === 'E_DAILY_LIMIT_EXCEEDED' ? 429 : 502;
    return json({ success: false, code }, status);
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname !== '/send') return json({ success: false, code: 'NOT_FOUND' }, 404);
    return handleSend(request, env);
  }
};
