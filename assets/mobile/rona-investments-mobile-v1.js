(()=>{
  'use strict';
  if (!matchMedia('(max-width:767px)').matches) return;
  if (window.__RONA_INVESTMENTS_MOBILE_V1__) return;
  window.__RONA_INVESTMENTS_MOBILE_V1__ = true;

  const path = location.pathname;
  const en = path.startsWith('/en/');
  const base = en ? '/en/investments/' : '/investments/';
  const slug = (path.split('/').pop() || 'home.html').toLowerCase();
  const labels = en ? {
    home:'Home', about:'About', how:'How we work', products:'Products', strategy:'Strategy & investments', projects:'Business projects, data & risks', industries:'Industries', value:'Client value', trade:'RONA Trade', menu:'Menu'
  } : {
    home:'Главная', about:'О нас', how:'Как мы работаем', products:'Продукты', strategy:'Стратегия и инвестиции', projects:'Бизнес-проекты, данные и риски', industries:'Отрасли', value:'Ценность для клиента', trade:'RONA Trade', menu:'Меню'
  };
  const items = [
    ['home.html',labels.home],
    ['about.html',labels.about],
    ['how-we-work.html',labels.how],
    ['products.html',labels.products],
    ['products-strategy-investments.html',labels.strategy],
    ['products-business-projects-data-risks.html',labels.projects],
    ['industries.html',labels.industries],
    ['client-value.html',labels.value]
  ];
  const langHref = en ? path.replace(/^\/en/, '') : `/en${path}`;

  const chrome = document.createElement('style');
  chrome.id = 'rona-investments-mobile-chrome-v1';
  chrome.textContent = `
    #rona-investments-mobile-bar{position:fixed;z-index:2147483600;left:0;right:0;top:0;height:calc(58px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 12px 0 15px;display:flex;align-items:center;gap:9px;background:linear-gradient(180deg,rgba(3,8,18,.98),rgba(4,12,25,.91));border-bottom:1px solid rgba(133,176,224,.20);backdrop-filter:blur(16px) saturate(120%);-webkit-backdrop-filter:blur(16px) saturate(120%);font-family:"Segoe UI",Arial,sans-serif;color:#fff;box-sizing:border-box}
    #rona-investments-mobile-bar *{box-sizing:border-box}
    #rona-investments-mobile-brand{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-size:15px;font-weight:800;letter-spacing:.025em;white-space:nowrap}
    #rona-investments-mobile-brand:before{content:"";width:9px;height:9px;border-radius:2px;transform:rotate(45deg);background:linear-gradient(135deg,#83b9ff,#2d6caf);box-shadow:0 0 14px rgba(86,153,231,.55)}
    #rona-investments-mobile-bar .spacer{flex:1}
    #rona-investments-mobile-lang{min-width:40px;height:42px;display:grid;place-items:center;border-radius:10px;color:rgba(255,255,255,.82);text-decoration:none;font:800 12px/1 "Segoe UI",Arial,sans-serif;letter-spacing:.08em}
    #rona-investments-mobile-menu{width:44px;height:44px;border:1px solid rgba(255,255,255,.17);border-radius:11px;background:rgba(255,255,255,.06);display:grid;place-items:center;gap:4px;padding:10px;cursor:pointer}
    #rona-investments-mobile-menu span,#rona-investments-mobile-menu:before,#rona-investments-mobile-menu:after{content:"";display:block;width:20px;height:2px;background:#fff;border-radius:2px;transition:.2s ease}
    #rona-investments-mobile-menu.open span{opacity:0}#rona-investments-mobile-menu.open:before{transform:translateY(6px) rotate(45deg)}#rona-investments-mobile-menu.open:after{transform:translateY(-6px) rotate(-45deg)}
    #rona-investments-mobile-drawer{position:fixed;z-index:2147483500;inset:calc(58px + env(safe-area-inset-top)) 0 0;background:rgba(3,8,18,.985);padding:16px 17px calc(24px + env(safe-area-inset-bottom));overflow:auto;display:none;font-family:"Segoe UI",Arial,sans-serif}
    #rona-investments-mobile-drawer.open{display:block}
    #rona-investments-mobile-drawer nav{display:grid;gap:6px}
    #rona-investments-mobile-drawer a{min-height:50px;display:flex;align-items:center;padding:0 13px;border-radius:11px;color:rgba(255,255,255,.84);text-decoration:none;font-size:15px;font-weight:650;line-height:1.25;border:1px solid transparent}
    #rona-investments-mobile-drawer a.active{color:#fff;background:rgba(103,164,232,.10);border-color:rgba(118,176,238,.18)}
    #rona-investments-mobile-drawer a.active:before{content:"";width:4px;height:20px;margin-right:10px;border-radius:3px;background:#65a9f3}
    #rona-investments-mobile-drawer .trade{margin-top:10px;border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
    @media(max-width:360px){#rona-investments-mobile-brand{font-size:13px}}
  `;
  document.head.appendChild(chrome);

  const styleText = `
    :root{--rona-inv-mobile-top:calc(58px + env(safe-area-inset-top));--rona-inv-pad:clamp(16px,5vw,22px)}
    *{box-sizing:border-box}
    html[data-rona-investments-mobile],html[data-rona-investments-mobile] body{margin:0!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-text-size-adjust:100%!important}
    html[data-rona-investments-mobile] body{padding-top:var(--rona-inv-mobile-top)!important;padding-bottom:calc(24px + env(safe-area-inset-bottom))!important;background:#06101d!important;color:#fff!important}
    html[data-rona-investments-mobile] body>header,html[data-rona-investments-mobile] .site-header,html[data-rona-investments-mobile] .desktop-header,html[data-rona-investments-mobile] .header-shade{display:none!important}
    html[data-rona-investments-mobile] .page,html[data-rona-investments-mobile] .screen,html[data-rona-investments-mobile] .viewport,html[data-rona-investments-mobile] .scene-canvas,html[data-rona-investments-mobile] .ui-scene,html[data-rona-investments-mobile] .scene,html[data-rona-investments-mobile] .stage,html[data-rona-investments-mobile] .layout,html[data-rona-investments-mobile] .app-shell{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:calc(100dvh - var(--rona-inv-mobile-top))!important;transform:none!important;transform-origin:0 0!important;overflow:visible!important}
    html[data-rona-investments-mobile] main,html[data-rona-investments-mobile] .main,html[data-rona-investments-mobile] .content,html[data-rona-investments-mobile] .workspace,html[data-rona-investments-mobile] .container,html[data-rona-investments-mobile] .shell{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;margin:0!important;transform:none!important;overflow:visible!important}
    html[data-rona-investments-mobile] main,html[data-rona-investments-mobile] .main,html[data-rona-investments-mobile] .content{padding-left:var(--rona-inv-pad)!important;padding-right:var(--rona-inv-pad)!important}
    html[data-rona-investments-mobile] .hero,html[data-rona-investments-mobile] .hero-copy,html[data-rona-investments-mobile] .copy,html[data-rona-investments-mobile] .intro,html[data-rona-investments-mobile] .intro-copy{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;margin:0 0 20px!important;padding:26px 0 8px!important;transform:none!important}
    html[data-rona-investments-mobile] h1{margin:0!important;max-width:100%!important;font-size:clamp(36px,10.5vw,50px)!important;line-height:.98!important;letter-spacing:-.045em!important;text-wrap:balance!important;overflow-wrap:break-word!important}
    html[data-rona-investments-mobile] h2{max-width:100%!important;font-size:clamp(23px,6.5vw,31px)!important;line-height:1.08!important;overflow-wrap:break-word!important}
    html[data-rona-investments-mobile] h3{max-width:100%!important;font-size:clamp(18px,5vw,24px)!important;line-height:1.16!important;overflow-wrap:break-word!important}
    html[data-rona-investments-mobile] p,html[data-rona-investments-mobile] li{max-width:100%!important;font-size:15.5px!important;line-height:1.52!important;text-align:left!important;overflow-wrap:break-word!important}
    html[data-rona-investments-mobile] .lead,html[data-rona-investments-mobile] .subtitle{max-width:100%!important;font-size:16px!important;line-height:1.48!important;text-align:left!important}
    html[data-rona-investments-mobile] .grid,html[data-rona-investments-mobile] .cards,html[data-rona-investments-mobile] .card-grid,html[data-rona-investments-mobile] .tiles,html[data-rona-investments-mobile] .columns,html[data-rona-investments-mobile] .steps,html[data-rona-investments-mobile] .industries,html[data-rona-investments-mobile] .products,html[data-rona-investments-mobile] .values,html[data-rona-investments-mobile] .features{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important}
    html[data-rona-investments-mobile] .card,html[data-rona-investments-mobile] .tile,html[data-rona-investments-mobile] .panel,html[data-rona-investments-mobile] .section-card,html[data-rona-investments-mobile] .product-card,html[data-rona-investments-mobile] .industry-card,html[data-rona-investments-mobile] .value-card{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;margin:0!important;transform:none!important}
    html[data-rona-investments-mobile] .rona-mobile-flow-block{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;margin:0 0 14px!important;transform:none!important;overflow:visible!important}
    html[data-rona-investments-mobile] .bg,html[data-rona-investments-mobile] .background,html[data-rona-investments-mobile] .site-bg,html[data-rona-investments-mobile] .fixed-bg{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;object-fit:cover!important;object-position:center center!important;z-index:-20!important;transform:none!important}
    html[data-rona-investments-mobile] img,html[data-rona-investments-mobile] video,html[data-rona-investments-mobile] canvas,html[data-rona-investments-mobile] svg{max-width:100%}
    html[data-rona-investments-mobile] form{width:100%!important;max-width:100%!important}
    html[data-rona-investments-mobile] input,html[data-rona-investments-mobile] select,html[data-rona-investments-mobile] textarea,html[data-rona-investments-mobile] button{max-width:100%!important;font-size:16px!important}
    html[data-rona-investments-mobile] input,html[data-rona-investments-mobile] select,html[data-rona-investments-mobile] button{min-height:46px}
    html[data-rona-investments-mobile] textarea{min-height:110px}
    html[data-rona-investments-mobile] iframe{display:block!important;width:100%!important;max-width:100vw!important;min-width:0!important;border:0!important}
    html[data-rona-investments-mobile] [style*="width: 2560px"],html[data-rona-investments-mobile] [style*="width:2560px"],html[data-rona-investments-mobile] [style*="width: 1920px"],html[data-rona-investments-mobile] [style*="width:1920px"],html[data-rona-investments-mobile] [style*="width: 1600px"],html[data-rona-investments-mobile] [style*="width:1600px"]{width:100%!important;max-width:100%!important}
    @media(max-width:360px){html[data-rona-investments-mobile] h1{font-size:34px!important}html[data-rona-investments-mobile] p,html[data-rona-investments-mobile] li{font-size:15px!important}}
  `;

  const bound = new WeakSet();
  function isDecorative(el, cs){
    const name = `${el.id || ''} ${el.className || ''}`.toLowerCase();
    return /(^|\s)(bg|background|overlay|shade|glow|grain|noise|decor|decoration|line|orb|beam|flare|watermark)(\s|$|-|_)/.test(name) || cs.pointerEvents === 'none' && !(el.textContent || '').trim();
  }
  function normalizeFlow(doc){
    const w = doc.defaultView;
    if (!w) return;
    const nodes = doc.body ? [...doc.body.querySelectorAll('main *, .page *, .screen *, .scene-canvas *, .ui-scene *')] : [];
    for (const el of nodes) {
      if (!(el instanceof w.HTMLElement)) continue;
      if (el.closest('#rona-investments-mobile-bar,#rona-investments-mobile-drawer')) continue;
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (text.length < 18) continue;
      const cs = w.getComputedStyle(el);
      if (isDecorative(el, cs)) continue;
      if (cs.position === 'absolute' || cs.position === 'fixed') {
        const r = el.getBoundingClientRect();
        if (r.width >= Math.min(260, w.innerWidth * .62) || r.height >= 80) el.classList.add('rona-mobile-flow-block');
      }
    }
  }
  function patch(doc){
    if (!doc || !doc.documentElement) return;
    doc.documentElement.dataset.ronaInvestmentsMobile = '1';
    if (!doc.getElementById('rona-investments-mobile-style-v1')) {
      const s = doc.createElement('style');
      s.id = 'rona-investments-mobile-style-v1';
      s.textContent = styleText;
      (doc.head || doc.documentElement).appendChild(s);
    }
    requestAnimationFrame(() => normalizeFlow(doc));
    doc.querySelectorAll('iframe').forEach(frame => {
      const apply = () => { try { patch(frame.contentDocument); } catch (_) {} };
      if (!bound.has(frame)) { bound.add(frame); frame.addEventListener('load', apply, {passive:true}); }
      apply();
    });
  }

  function buildChrome(){
    const bar = document.createElement('div');
    bar.id = 'rona-investments-mobile-bar';
    bar.innerHTML = `<a id="rona-investments-mobile-brand" href="${base}home.html">RONA Investments</a><span class="spacer"></span><a id="rona-investments-mobile-lang" href="${langHref}">${en?'RU':'EN'}</a><button id="rona-investments-mobile-menu" type="button" aria-label="${labels.menu}" aria-expanded="false"><span></span></button>`;
    const drawer = document.createElement('div');
    drawer.id = 'rona-investments-mobile-drawer';
    drawer.innerHTML = `<nav>${items.map(([href,label]) => `<a href="${base}${href}" class="${slug===href?'active':''}">${label}</a>`).join('')}<a class="trade" href="${en?'/en/':'/'}">${labels.trade}</a></nav>`;
    document.body.append(bar,drawer);
    const btn = bar.querySelector('#rona-investments-mobile-menu');
    const setOpen = v => { btn.classList.toggle('open',v); drawer.classList.toggle('open',v); btn.setAttribute('aria-expanded',String(v)); };
    btn.addEventListener('click',()=>setOpen(!drawer.classList.contains('open')));
    drawer.addEventListener('click',e=>{ if(e.target.closest('a')) setOpen(false); });
  }

  buildChrome();
  patch(document);
  const mo = new MutationObserver(()=>patch(document));
  mo.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('load',()=>patch(document),{once:true});
})();
