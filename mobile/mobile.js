(()=>{
  'use strict';

  document.addEventListener('click', event => {
    const drawer = document.querySelector('.nav-drawer[open]');
    if (!drawer) return;
    if (!drawer.contains(event.target)) drawer.removeAttribute('open');
  });

  document.querySelectorAll('.nav-panel a').forEach(link => {
    link.addEventListener('click', () => {
      const drawer = link.closest('.nav-drawer');
      if (drawer) drawer.removeAttribute('open');
    });
  });

  const form = document.querySelector('[data-trade-form]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('button[type="submit"]');

  function setStatus(message, kind=''){
    if (!status) return;
    status.textContent = message;
    status.className = `form-status${kind ? ` ${kind}` : ''}`;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit?.disabled) return;

    const data = new FormData(form);
    const payload = {
      'Контактное лицо': String(data.get('contact') || '').trim(),
      'Компания': String(data.get('company') || '').trim(),
      'Страна регистрации компании': String(data.get('registration_country') || '').trim(),
      'Нефтепродукт': String(data.get('product') || '').trim(),
      'Страна назначения груза': String(data.get('destination_country') || '').trim(),
      'Ориентировочный объем, тонн': String(data.get('volume') || '').trim(),
      'Телефон': String(data.get('phone') || '').trim(),
      'E-mail': String(data.get('email') || '').trim(),
      'Комментарий': String(data.get('comment') || '').trim(),
      'Источник': 'RONA Trade mobile public site',
      'Дата отправки': new Date().toISOString(),
      'Language': 'RU',
      'URL страницы / источник': location.href,
      '_honey': String(data.get('website') || '').trim()
    };

    if (!payload['Контактное лицо'] || !payload['Компания'] || !payload['Страна регистрации компании'] || !payload['Нефтепродукт'] || !payload['Страна назначения груза']) {
      setStatus('Заполните обязательные поля.', 'error');
      return;
    }
    if (!payload['Телефон'] && !payload['E-mail']) {
      setStatus('Укажите телефон или e-mail.', 'error');
      return;
    }

    try {
      if (submit) submit.disabled = true;
      setStatus('Отправляем запрос…');
      const response = await fetch('/api/forms/trade', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.code || `HTTP_${response.status}`);
      form.reset();
      setStatus('Запрос принят. Мы свяжемся с вами по указанным контактам.', 'ok');
    } catch (error) {
      console.error('RONA mobile trade form:', error);
      setStatus('Не удалось отправить запрос. Используйте корпоративный e-mail или телефон.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
