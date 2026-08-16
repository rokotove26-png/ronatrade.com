(()=>{
  'use strict';
  if (window.__RONA_G82_HOME_INLINE_AUTH_V2__) return;
  window.__RONA_G82_HOME_INLINE_AUTH_V2__ = true;

  const ENDPOINT = '/portal/auth/login';
  const PLACEHOLDER = 'серверная авторизация будет подключена после утверждения дизайна';
  const PANEL_LABELS = ['личный кабинет', 'personal account', 'client portal'];
  const boundDocs = new WeakSet();
  const busyPanels = new WeakSet();

  const norm = v => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const hasPanelLabel = text => { const t = norm(text); return PANEL_LABELS.some(x => t.includes(x)); };
  const localPortalTarget = value => {
    try {
      const u = new URL(String(value || ''), window.location.origin);
      if (u.origin !== window.location.origin) return null;
      return ['/portal/password-reset','/portal/select','/portal/admin','/portal/staff','/portal/agent','/portal/client'].includes(u.pathname) ? u.pathname : null;
    } catch (_) { return null; }
  };

  function nearestCredentialHost(seed, requireLabel) {
    let cur = seed;
    for (let i = 0; i < 12 && cur; i += 1, cur = cur.parentElement) {
      const pwd = cur.querySelector?.('input[type="password"],input[name*="pass" i]');
      const usr = cur.querySelector?.('input[name*="login" i],input[name*="user" i],input[type="email"],input[name*="email" i],input[type="text"],input:not([type])');
      const action = cur.querySelector?.('button,input[type="submit"],input[type="button"],[role="button"]');
      if (!pwd || !usr || !action) continue;
      const text = norm(cur.textContent);
      if (requireLabel && !hasPanelLabel(text)) continue;
      if (text.length > 4000 && cur.tagName !== 'FORM') continue;
      return cur;
    }
    return null;
  }

  function findPanel(doc) {
    const passwords = [...doc.querySelectorAll('input[type="password"],input[name*="pass" i]')];
    for (const pwd of passwords) { const host = nearestCredentialHost(pwd, true); if (host) return host; }
    for (const pwd of passwords) { const host = nearestCredentialHost(pwd, false); if (host) return host; }
    return null;
  }

  function fieldSet(panel) {
    const password = panel.querySelector('input[type="password"],input[name*="pass" i]');
    let identifier = panel.querySelector('input[name*="login" i],input[name*="user" i],input[type="email"],input[name*="email" i]');
    if (!identifier) { const texts = [...panel.querySelectorAll('input[type="text"],input:not([type])')]; identifier = texts.find(x => x !== password) || null; }
    const form = password?.closest('form') || identifier?.closest('form') || panel.querySelector('form') || null;
    const primaryScope = form || panel;
    let button = primaryScope.querySelector('button[type="submit"],input[type="submit"]');
    if (!button) { const candidates = [...primaryScope.querySelectorAll('button,[role="button"],input[type="button"]')]; button = candidates.find(el => /войти|login|sign in|вход/i.test(String(el.textContent || el.value || ''))) || candidates[0] || null; }
    if (!button && form) { const candidates = [...panel.querySelectorAll('button,input[type="submit"],input[type="button"],[role="button"]')]; button = candidates.find(el => /войти|login|sign in|вход/i.test(String(el.textContent || el.value || ''))) || candidates[0] || null; }
    return { identifier, password, form, button };
  }

  function cleanLegacy(doc, panel) {
    try {
      doc.querySelectorAll('#ronaPortalFallbackG82,[data-rona-portal-overlay="g82"]').forEach(el => el.remove());
      panel?.removeAttribute('inert');
      for (const el of panel?.querySelectorAll?.('p,span,small,div,label') || []) {
        if (!norm(el.textContent).includes(PLACEHOLDER)) continue;
        if (el.querySelector('input,button,form,[role="button"]')) continue;
        el.remove();
      }
    } catch (_) {}
  }

  function statusNode(doc, panel) {
    let el = panel.querySelector('[data-rona-inline-auth-status="g82-v2"]');
    if (el) return el;
    el = doc.createElement('div');
    el.dataset.ronaInlineAuthStatus = 'g82-v2'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'display:none;margin-top:8px;font:500 12px/1.35 Arial,sans-serif;color:#8b1e2d;max-width:100%';
    const { form, button } = fieldSet(panel); (form || button?.parentElement || panel).appendChild(el); return el;
  }
  function setStatus(doc, panel, message, error = true) { const el = statusNode(doc, panel); el.textContent = message || ''; el.style.display = message ? 'block' : 'none'; el.style.color = error ? '#8b1e2d' : '#425466'; }
  function setLoading(button, active) {
    if (!button) return;
    if (active) { if (!button.dataset.ronaOriginalLabel) button.dataset.ronaOriginalLabel = String(button.textContent || button.value || 'Войти'); if ('disabled' in button) button.disabled = true; if (String(button.tagName).toUpperCase() === 'INPUT') button.value = 'Вход…'; else button.textContent = 'Вход…'; button.setAttribute('aria-busy', 'true'); }
    else { if ('disabled' in button) button.disabled = false; const label = button.dataset.ronaOriginalLabel || 'Войти'; if (String(button.tagName).toUpperCase() === 'INPUT') button.value = label; else button.textContent = label; button.removeAttribute('aria-busy'); }
  }
  function enableFields(identifier, password, button) {
    for (const el of [identifier, password, button]) { if (!el) continue; el.removeAttribute('aria-hidden'); el.removeAttribute('inert'); if ('disabled' in el) el.disabled = false; if (el.tabIndex < 0) el.tabIndex = 0; }
    if (identifier) { try { identifier.type = 'text'; } catch (_) {} identifier.setAttribute('autocomplete', 'username'); identifier.setAttribute('inputmode', 'text'); identifier.setAttribute('aria-label', 'Логин'); }
    if (password) password.setAttribute('autocomplete', 'current-password');
  }
  function preparePanel(doc, panel) {
    if (!panel) return false; const { identifier, password, button } = fieldSet(panel); if (!identifier || !password || !button) return false;
    cleanLegacy(doc, panel); enableFields(identifier, password, button); panel.dataset.ronaInlineAuth = 'g82-v2'; statusNode(doc, panel); return true;
  }

  async function authenticate(doc, panel) {
    if (!preparePanel(doc, panel) || busyPanels.has(panel)) return;
    const { identifier, password, button } = fieldSet(panel); const login = String(identifier.value || '').trim(); const secret = String(password.value || '');
    if (!login || !secret) { setStatus(doc, panel, 'Введите логин и пароль.'); return; }
    busyPanels.add(panel); setStatus(doc, panel, ''); setLoading(button, true);
    try {
      const r = await fetch(ENDPOINT, { method:'POST', credentials:'same-origin', cache:'no-store', referrerPolicy:'no-referrer', headers:{'content-type':'application/json','accept':'application/json'}, body:JSON.stringify({ identifier:login, password:secret }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        password.value = ''; const code = String(data?.code || '');
        if (r.status === 401 || code === 'LOGIN_DENIED') setStatus(doc, panel, 'Неверный логин или пароль.');
        else if (r.status === 400 || code === 'LOGIN_INVALID') setStatus(doc, panel, 'Введите корректный логин и пароль.');
        else if (code === 'PASSWORD_GATE_UNAVAILABLE') setStatus(doc, panel, 'Сервис обязательной смены пароля временно недоступен. Повторите попытку.');
        else if (r.status === 403) setStatus(doc, panel, 'Доступ к личному кабинету не разрешён.');
        else setStatus(doc, panel, 'Сервис входа временно недоступен. Повторите попытку.');
        return;
      }
      const target = localPortalTarget(data.redirect);
      if (!target) { password.value = ''; setStatus(doc, panel, 'Не удалось определить разрешённый кабинет. Повторите попытку.'); return; }
      setStatus(doc, panel, data.must_change_password ? 'Вход выполнен. Требуется сменить временный пароль…' : 'Вход выполнен. Открываем кабинет…', false);
      try { window.top.location.assign(target); } catch (_) { window.location.assign(target); }
    } catch (_) { password.value = ''; setStatus(doc, panel, 'Нет связи с сервером авторизации. Проверьте соединение и повторите попытку.'); }
    finally { busyPanels.delete(panel); setLoading(button, false); }
  }

  function eventPanel(doc, target) { const panel = findPanel(doc); if (!panel || !target) return null; return panel.contains(target) ? panel : null; }
  function bindDoc(doc) {
    if (!doc || !doc.documentElement || boundDocs.has(doc)) return; boundDocs.add(doc);
    doc.addEventListener('submit', e => { const panel = eventPanel(doc, e.target); if (!panel) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); authenticate(doc, panel); }, true);
    doc.addEventListener('click', e => { const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target]; const panel = findPanel(doc); if (!panel) return; const { button } = fieldSet(panel); if (!button || !path.includes(button)) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); authenticate(doc, panel); }, true);
    const refresh = () => { const panel = findPanel(doc); if (panel) preparePanel(doc, panel); doc.querySelectorAll('iframe').forEach(bindFrame); };
    const mo = new MutationObserver(refresh); mo.observe(doc.documentElement, { childList:true, subtree:true }); refresh();
  }
  function bindFrame(frame) { if (!frame) return; const run = () => { try { bindDoc(frame.contentDocument); } catch (_) {} }; if (!frame.dataset.ronaInlineAuthFrameBound) { frame.dataset.ronaInlineAuthFrameBound='1'; frame.addEventListener('load', run, { passive:true }); } run(); }
  bindDoc(document);
})();
