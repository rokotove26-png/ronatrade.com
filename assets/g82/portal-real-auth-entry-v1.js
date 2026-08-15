(()=>{
  'use strict';
  if (window.__RONA_G82_REAL_AUTH_ENTRY_V1__) return;
  window.__RONA_G82_REAL_AUTH_ENTRY_V1__ = true;

  const DEST = '/portal/login';
  const PLACEHOLDER = 'серверная авторизация будет подключена после утверждения дизайна';
  const LABELS = ['личный кабинет', 'personal account', 'client portal'];
  const DIRECT = '.portal-top,[data-open-portal],[data-portal-open],#portalButton,#portalBtn,[data-rona-portal-overlay]';
  const bound = new WeakSet();

  const norm = v => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const isElement = node => !!node && node.nodeType === 1 && typeof node.closest === 'function';
  const isPortalText = v => {
    const t = norm(v);
    return !!t && t.length < 120 && LABELS.some(x => t === x || t.includes(x));
  };
  function portalControl(node) {
    if (!isElement(node)) return null;
    const direct = node.closest(DIRECT);
    if (direct) return direct;
    const control = node.closest('button,a,[role="button"],input[type="button"],input[type="submit"]');
    if (!control) return null;
    const text = String(control.tagName || '').toUpperCase() === 'INPUT' ? control.value : control.textContent;
    return isPortalText(text) ? control : null;
  }
  function go() {
    try { window.top.location.assign(DEST); }
    catch (_) { window.location.assign(DEST); }
  }
  function findLegacyHost(el) {
    let cur = el;
    for (let i = 0; i < 9 && cur; i += 1, cur = cur.parentElement) {
      if (cur.querySelector?.('input[type="password"],input[name*="pass" i]')) return cur;
    }
    return null;
  }
  function purgeLegacy(doc) {
    try {
      const nodes = doc.querySelectorAll('p,span,small,div,label');
      for (const el of nodes) {
        const t = norm(el.textContent);
        if (!t.includes(PLACEHOLDER)) continue;
        const host = findLegacyHost(el);
        if (host) {
          host.querySelectorAll('form,input,button').forEach(x => {
            x.setAttribute('aria-hidden', 'true');
            if ('disabled' in x) x.disabled = true;
          });
          host.setAttribute('inert', '');
          host.style.setProperty('display', 'none', 'important');
        } else {
          el.remove();
        }
      }
    } catch (_) {}
  }
  function bindDoc(doc) {
    if (!doc || bound.has(doc)) return;
    bound.add(doc);
    const click = e => {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
      let ctl = null;
      for (const node of path) {
        ctl = portalControl(node);
        if (ctl) break;
      }
      if (!ctl) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      go();
    };
    const submit = e => {
      const form = e.target;
      if (!form || String(form.tagName || '').toUpperCase() !== 'FORM') return;
      const text = norm(form.textContent);
      const password = !!form.querySelector?.('input[type="password"],input[name*="pass" i]');
      if (!password || !LABELS.some(x => text.includes(x))) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      go();
    };
    doc.addEventListener('click', click, true);
    doc.addEventListener('submit', submit, true);
    purgeLegacy(doc);
    for (const frame of doc.querySelectorAll('iframe')) bindFrame(frame);
    const mo = new MutationObserver(() => {
      purgeLegacy(doc);
      doc.querySelectorAll('iframe').forEach(bindFrame);
    });
    mo.observe(doc.documentElement, { childList: true, subtree: true });
  }
  function bindFrame(frame) {
    if (!frame) return;
    const run = () => { try { bindDoc(frame.contentDocument); } catch (_) {} };
    frame.addEventListener('load', run, { passive: true });
    run();
  }
  bindDoc(document);
})();
