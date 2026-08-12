(()=>{
  'use strict';

  const MOBILE_MAX = 767;
  if (!window.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches) return;
  if (window.__RONA_MOBILE_REMEDIATION_V2__) return;
  window.__RONA_MOBILE_REMEDIATION_V2__ = true;

  const path = location.pathname;
  const language = path.startsWith('/en/') ? 'en' : 'ru';
  const page = (() => {
    const p = path.toLowerCase();
    if (p.includes('about')) return 'about';
    if (p.includes('products')) return 'products';
    if (p.includes('logistics')) return 'logistics';
    if (p.includes('geography')) return 'geography';
    if (p.includes('contacts')) return 'contacts';
    return 'home';
  })();

  const LABELS = language === 'en' ? {
    home:'Home', about:'About', products:'Products', logistics:'Logistics', geography:'Geography', contacts:'Contacts', portal:'Client Portal', menu:'Menu'
  } : {
    home:'Главная', about:'О компании', products:'Продукты', logistics:'Логистика', geography:'География', contacts:'Контакты', portal:'Личный кабинет', menu:'Меню'
  };

  const LINKS = language === 'en' ? {
    home:'/en/', about:'/en/pages/about.html', products:'/en/pages/products.html', logistics:'/en/pages/logistics.html', geography:'/en/pages/geography.html', contacts:'/en/pages/contacts.html'
  } : {
    home:'/', about:'/pages/about.html', products:'/pages/products.html', logistics:'/pages/logistics.html', geography:'/pages/geography.html', contacts:'/pages/contacts.html'
  };

  const languageHref = (() => {
    if (language === 'en') {
      if (page === 'home') return '/';
      return `/pages/${page}.html`;
    }
    if (page === 'home') return '/en/';
    return `/en/pages/${page}.html`;
  })();

  const outerStyle = document.createElement('style');
  outerStyle.id = 'rona-mobile-outer-v2';
  outerStyle.textContent = `
    html.rona-mobile-v2,html.rona-mobile-v2 body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#05070a!important}
    html.rona-mobile-v2 #viewportAsset{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;object-fit:cover!important;object-position:center center!important}
    html.rona-mobile-v2 #stage{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;overflow:hidden!important}
    html.rona-mobile-v2 #scene{position:absolute!important;left:0!important;top:0!important;width:100vw!important;height:100dvh!important;transform:none!important;transform-origin:0 0!important}
    html.rona-mobile-v2 #frame,html.rona-mobile-v2 .rona-mobile-frame{display:block!important;border:0!important;width:100vw!important;height:100dvh!important;background:transparent!important}
    html.rona-mobile-v2 .rona-lang-switch{display:none!important}
    #rona-mobile-topbar{position:fixed;left:0;right:0;top:0;height:calc(58px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 12px 0 16px;z-index:2147483600;display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,rgba(4,7,11,.97),rgba(4,7,11,.88));border-bottom:1px solid rgba(255,255,255,.10);backdrop-filter:blur(16px) saturate(115%);-webkit-backdrop-filter:blur(16px) saturate(115%);font-family:"Segoe UI",Arial,sans-serif;color:#fff;box-sizing:border-box}
    #rona-mobile-topbar *{box-sizing:border-box}
    #rona-mobile-brand{display:inline-flex;align-items:center;gap:9px;color:#fff;text-decoration:none;font-weight:800;font-size:17px;letter-spacing:.03em;white-space:nowrap}
    #rona-mobile-brand:before{content:"";width:8px;height:8px;border-radius:50%;background:#ef1713;box-shadow:0 0 14px rgba(239,23,19,.65)}
    #rona-mobile-spacer{flex:1}
    #rona-mobile-language{display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:42px;padding:0 8px;color:rgba(255,255,255,.82);text-decoration:none;font-size:12px;font-weight:800;letter-spacing:.08em;border-radius:10px}
    #rona-mobile-menu-button{width:44px;height:44px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:rgba(255,255,255,.06);display:grid;place-items:center;padding:0;cursor:pointer;gap:4px}
    #rona-mobile-menu-button span,#rona-mobile-menu-button:before,#rona-mobile-menu-button:after{content:"";display:block;width:20px;height:2px;border-radius:2px;background:#fff;transition:transform .2s ease,opacity .2s ease}
    #rona-mobile-menu-button.open span{opacity:0}
    #rona-mobile-menu-button.open:before{transform:translateY(6px) rotate(45deg)}
    #rona-mobile-menu-button.open:after{transform:translateY(-6px) rotate(-45deg)}
    #rona-mobile-drawer{position:fixed;inset:calc(58px + env(safe-area-inset-top)) 0 0 0;z-index:2147483500;background:rgba(5,8,12,.98);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);padding:18px 18px calc(24px + env(safe-area-inset-bottom));display:none;overflow:auto;font-family:"Segoe UI",Arial,sans-serif}
    #rona-mobile-drawer.open{display:block}
    #rona-mobile-drawer nav{display:grid;gap:7px}
    #rona-mobile-drawer a,#rona-mobile-drawer button{width:100%;min-height:52px;display:flex;align-items:center;padding:0 14px;border-radius:12px;border:1px solid transparent;background:transparent;color:rgba(255,255,255,.86);text-decoration:none;text-align:left;font:650 17px/1.25 "Segoe UI",Arial,sans-serif;cursor:pointer}
    #rona-mobile-drawer a.active{color:#fff;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.10)}
    #rona-mobile-drawer a.active:before{content:"";width:4px;height:22px;border-radius:4px;background:#ef1713;margin-right:11px}
    #rona-mobile-drawer .portal{margin-top:12px;border-color:rgba(239,23,19,.46);background:rgba(239,23,19,.10);color:#fff}
    #rona-mobile-drawer .portal:before{content:"↗";margin-right:10px;color:#ff5a55}
    @media(max-width:360px){#rona-mobile-brand{font-size:15px}#rona-mobile-language{min-width:38px;padding:0 5px}}
  `;
  document.head.appendChild(outerStyle);
  document.documentElement.classList.add('rona-mobile-v2');

  function buildTopbar(){
    if (document.getElementById('rona-mobile-topbar')) return;
    const top = document.createElement('div');
    top.id = 'rona-mobile-topbar';
    top.innerHTML = `<a id="rona-mobile-brand" href="${LINKS.home}" aria-label="RONA Trade">RONA Trade</a><span id="rona-mobile-spacer"></span><a id="rona-mobile-language" href="${languageHref}" hreflang="${language === 'en' ? 'ru' : 'en'}">${language === 'en' ? 'RU' : 'EN'}</a><button id="rona-mobile-menu-button" type="button" aria-label="${LABELS.menu}" aria-expanded="false"><span></span></button>`;
    const drawer = document.createElement('div');
    drawer.id = 'rona-mobile-drawer';
    drawer.innerHTML = `<nav>${['home','about','products','logistics','geography','contacts'].map(k => `<a href="${LINKS[k]}" class="${page===k?'active':''}">${LABELS[k]}</a>`).join('')}<button class="portal" type="button">${LABELS.portal}</button></nav>`;
    document.body.append(top, drawer);
    const button = top.querySelector('#rona-mobile-menu-button');
    const setOpen = open => {
      button.classList.toggle('open', open);
      drawer.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => setOpen(!drawer.classList.contains('open')));
    drawer.addEventListener('click', e => { if (e.target.matches('a')) setOpen(false); });
    drawer.querySelector('.portal').addEventListener('click', () => {
      setOpen(false);
      openPortalDeep(document);
    });
  }

  function innerCss(){
    return `
      :root{--rona-mobile-top:calc(58px + env(safe-area-inset-top));--rona-mobile-pad:clamp(16px,5vw,22px)}
      *{box-sizing:border-box}
      html[data-rona-mobile-v2],html[data-rona-mobile-v2] body{margin:0!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;background:transparent!important;-webkit-text-size-adjust:100%!important}
      html[data-rona-mobile-v2] body{padding:var(--rona-mobile-top) 0 calc(24px + env(safe-area-inset-bottom))!important;color:#fff!important;font-family:"Segoe UI",Arial,Helvetica,sans-serif!important}
      html[data-rona-mobile-v2] body>header,html[data-rona-mobile-v2] header,html[data-rona-mobile-v2] .header-shade{display:none!important}
      html[data-rona-mobile-v2] .page{position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:calc(100dvh - var(--rona-mobile-top))!important;overflow:visible!important;background:transparent!important}
      html[data-rona-mobile-v2] .bg{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;object-fit:cover!important;object-position:center center!important;z-index:-20!important}
      html[data-rona-mobile-v2] .overlay,html[data-rona-mobile-v2] .scene-overlay{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:-19!important;background:linear-gradient(180deg,rgba(3,6,10,.52),rgba(4,8,13,.72) 44%,rgba(4,8,13,.88) 100%)!important}
      html[data-rona-mobile-v2] main{position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;padding:0!important;overflow:visible!important}
      html[data-rona-mobile-v2] .workspace,html[data-rona-mobile-v2] .glass-sheet{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important;border-radius:0!important}
      html[data-rona-mobile-v2] .glass-sheet:before{position:fixed!important;inset:var(--rona-mobile-top) 0 0!important;-webkit-mask-image:none!important;mask-image:none!important;background:linear-gradient(180deg,rgba(8,14,22,.48),rgba(7,13,20,.84))!important;backdrop-filter:blur(3px)!important;-webkit-backdrop-filter:blur(3px)!important}
      html[data-rona-mobile-v2] .glass-sheet:after{display:none!important}
      html[data-rona-mobile-v2] .sheet-edge,html[data-rona-mobile-v2] .sheet-accent{display:none!important}
      html[data-rona-mobile-v2] .sheet-content{position:relative!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;display:block!important;padding:26px var(--rona-mobile-pad) 32px!important;overflow:visible!important}
      html[data-rona-mobile-v2] .hero,html[data-rona-mobile-v2] .hero-line,html[data-rona-mobile-v2] .hero-copy{position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;display:block!important;padding:0!important;margin:0 0 22px!important;opacity:1!important;transform:none!important;filter:none!important;animation:none!important}
      html[data-rona-mobile-v2] h1,html[data-rona-mobile-v2] .hero h1,html[data-rona-mobile-v2] .hero-line h1{margin:0!important;max-width:100%!important;font-size:clamp(38px,11vw,52px)!important;line-height:.96!important;letter-spacing:-.045em!important;text-wrap:balance!important;overflow-wrap:break-word!important}
      html[data-rona-mobile-v2] h2{max-width:100%!important;font-size:clamp(22px,6.2vw,30px)!important;line-height:1.08!important;overflow-wrap:break-word!important}
      html[data-rona-mobile-v2] .lead{margin:12px 0 0!important;max-width:100%!important;font-size:16px!important;line-height:1.48!important;color:rgba(255,255,255,.83)!important;text-align:left!important}
      html[data-rona-mobile-v2] p,html[data-rona-mobile-v2] li{max-width:100%!important;font-size:15px!important;line-height:1.52!important;text-align:left!important;hyphens:auto!important;overflow-wrap:break-word!important}
      html[data-rona-mobile-v2] img,html[data-rona-mobile-v2] video,html[data-rona-mobile-v2] canvas,html[data-rona-mobile-v2] svg{max-width:100%}
      html[data-rona-mobile-v2] input,html[data-rona-mobile-v2] select,html[data-rona-mobile-v2] textarea,html[data-rona-mobile-v2] button{font-size:16px!important}
      html[data-rona-mobile-v2] input,html[data-rona-mobile-v2] select,html[data-rona-mobile-v2] button{min-height:46px}
      html[data-rona-mobile-v2] textarea{min-height:110px}
      html[data-rona-mobile-v2] .rona-portal-host{position:fixed!important;inset:var(--rona-mobile-top) 0 0!important;z-index:99999!important;overflow:auto!important}
      html[data-rona-mobile-v2] .rona-portal-host .portal-card{position:relative!important;inset:auto!important;right:auto!important;top:auto!important;width:calc(100% - 28px)!important;max-width:430px!important;margin:18px auto!important;padding:22px 18px!important;border-radius:16px!important}

      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .flow{display:block!important;min-height:0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .story-block{display:grid!important;grid-template-columns:48px minmax(0,1fr)!important;gap:10px 12px!important;align-items:start!important;padding:18px 0!important;min-height:0!important;opacity:1!important;transform:none!important;filter:none!important;animation:none!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .story-block+.story-block:before{right:0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .icon{width:44px!important;height:44px!important;margin:0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .icon svg{width:38px!important;height:38px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .block-copy{min-width:0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .side-note{grid-column:1/-1!important;margin:2px 0 0 60px!important;padding:10px 0 0!important;border-left:0!important;border-top:1px solid rgba(255,255,255,.10)!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="about"] .side-note .big{font-size:30px!important;line-height:1!important}

      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .catalog{display:block!important;margin-top:12px!important;max-width:100%!important;border-top:1px solid rgba(255,255,255,.14)!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .product-row{display:grid!important;grid-template-columns:28px 46px minmax(0,1fr)!important;gap:8px 10px!important;align-items:start!important;min-height:0!important;padding:16px 0!important;opacity:1!important;transform:none!important;filter:none!important;animation:none!important;overflow:visible!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .num{padding-top:10px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .picon{width:42px!important;height:42px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .picon svg{width:36px!important;height:36px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .pname h2{font-size:22px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .pdesc{grid-column:2/-1!important;margin:3px 0 0!important;padding:0!important;border-left:0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="products"] .footnote{padding:14px 0 0!important;font-size:12px!important;opacity:1!important;animation:none!important}

      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .shell{width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;margin:0!important;padding:18px var(--rona-mobile-pad) 28px!important;border-radius:0!important;overflow:visible!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .claims{gap:7px!important;margin-top:14px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .claim{height:auto!important;min-height:32px!important;padding:7px 10px!important;line-height:1.2!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .network{margin-top:14px!important;padding:16px!important;border-radius:16px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .network-top{display:block!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .network-note{max-width:100%!important;margin-top:8px!important;text-align:left!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .modes,html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .cards,html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .mode-grid{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;width:100%!important;max-width:100%!important;height:auto!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .mode,html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .mode-card,html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .card{position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;padding:14px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .network,html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .route,html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .route-line{position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;transform:none!important;overflow:visible!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .flow{margin-top:18px!important;padding:16px 0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .bottomline{display:block!important;margin-top:12px!important;padding:0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .bottomline .status{margin-top:9px!important;display:flex!important;flex-wrap:wrap!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;width:100%!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .logo-strip,html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .partners{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;width:100%!important;max-width:100%!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .partner-card{height:auto!important;min-height:68px!important;grid-template-columns:58px minmax(0,1fr)!important}

      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .shell{position:relative!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;margin:0!important;padding:22px var(--rona-mobile-pad) 30px!important;display:flex!important;flex-direction:column!important;gap:14px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .hero-main{display:block!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .hero-divider,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .route-legend{display:none!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .mode-row,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .rail-card,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .sea-card,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .thesis,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .map,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .routes{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;transform:none!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .mode-row,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .routes{display:flex!important;flex-wrap:wrap!important;gap:7px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .mode{height:auto!important;min-height:34px!important;flex:1 1 132px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .rail-card,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .sea-card,html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .thesis{padding:17px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .card-head{display:block!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .card-note{max-width:100%!important;margin-top:8px!important;text-align:left!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .country-groups{grid-template-columns:1fr!important;gap:12px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .seas{grid-template-columns:repeat(3,minmax(0,1fr))!important}

      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .board,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .info,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .routes,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .bank-base,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .contact-grid{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;display:grid!important;grid-template-columns:1fr!important;gap:12px!important;transform:none!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .board{padding:22px var(--rona-mobile-pad) 28px!important;margin:0!important;overflow:visible!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .hero-note{max-width:100%!important;margin:8px 0 0!important;text-align:left!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .registry{grid-template-columns:1fr!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .reg-item.wide{grid-column:auto!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .bank-head{display:block!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .bank-head p,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .bank-meta{max-width:100%!important;margin-top:7px!important;text-align:left!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .route{min-height:0!important;padding:13px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .board>* ,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .info>* ,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .routes>* ,html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] .bank-base>*{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="contacts"] a{overflow-wrap:anywhere!important}

      html[data-rona-mobile-v2][data-rona-mobile-page="home"] body{padding-bottom:calc(26px + env(safe-area-inset-bottom))!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="home"] .scene-canvas,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .ui-scene,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .scene,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .canvas,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .layout,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .stage{position:relative!important;inset:auto!important;left:auto!important;top:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:calc(100dvh - var(--rona-mobile-top))!important;transform:none!important;transform-origin:0 0!important;overflow:visible!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="home"] .copy,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .hero-copy,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .hero{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:auto!important;max-width:none!important;height:auto!important;transform:none!important;margin:0!important;padding:28px var(--rona-mobile-pad) 18px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="home"] .bottom-cards,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .cards,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .card-row{position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;height:auto!important;display:grid!important;grid-template-columns:1fr!important;gap:12px!important;padding:0 var(--rona-mobile-pad) 26px!important;transform:none!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="home"] .partners-card,html[data-rona-mobile-v2][data-rona-mobile-page="home"] .portal-card{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;transform:none!important;margin:0!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="home"] iframe{max-width:100vw!important}

      @media(max-width:360px){
        html[data-rona-mobile-v2] .sheet-content{padding-left:15px!important;padding-right:15px!important}
        html[data-rona-mobile-v2] h1,html[data-rona-mobile-v2] .hero h1,html[data-rona-mobile-v2] .hero-line h1{font-size:36px!important}
        html[data-rona-mobile-v2] .lead{font-size:15px!important}
        html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .stats{grid-template-columns:1fr!important}
        html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .seas{grid-template-columns:1fr!important}
      }
      @media(prefers-reduced-motion:reduce){html[data-rona-mobile-v2] *,html[data-rona-mobile-v2] *:before,html[data-rona-mobile-v2] *:after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
    `;
  }

  const boundFrames = new WeakSet();

  function patchDocument(doc){
    if (!doc || !doc.documentElement) return;
    const root = doc.documentElement;
    root.dataset.ronaMobileV2 = '1';
    root.dataset.ronaMobilePage = page;
    if (!doc.getElementById('rona-mobile-remediation-v2')) {
      const style = doc.createElement('style');
      style.id = 'rona-mobile-remediation-v2';
      style.textContent = innerCss();
      (doc.head || root).appendChild(style);
    }
    doc.querySelectorAll('iframe').forEach(bindFrame);
  }

  function bindFrame(frame){
    if (!frame) return;
    const apply = () => { try { patchDocument(frame.contentDocument); } catch (_) {} };
    if (!boundFrames.has(frame)) {
      boundFrames.add(frame);
      frame.addEventListener('load', apply, {passive:true});
    }
    apply();
  }

  function patchOuterFrames(){
    document.querySelectorAll('iframe').forEach(bindFrame);
  }

  function findClickablePortal(doc){
    if (!doc) return null;
    const direct = doc.querySelector('.portal-top,[data-open-portal],[data-portal-open],#portalButton,#portalBtn');
    if (direct && !direct.closest('#rona-mobile-topbar,#rona-mobile-drawer')) return direct;
    const nodes = [...doc.querySelectorAll('button,a,[role="button"]')]
      .filter(el => !el.closest('#rona-mobile-topbar,#rona-mobile-drawer'));
    return nodes.find(el => /личн(ый|ого) кабинет|client portal|log\s*in|вход/i.test((el.textContent || '').trim())) || null;
  }

  function openPortalDeep(doc){
    try {
      const button = findClickablePortal(doc);
      if (button) { button.click(); return true; }
      for (const frame of doc.querySelectorAll('iframe')) {
        try { if (openPortalDeep(frame.contentDocument)) return true; } catch (_) {}
      }
    } catch (_) {}
    return false;
  }

  buildTopbar();
  if (/\/pages\/home_compact\.html$/i.test(path)) patchDocument(document);
  patchOuterFrames();
  const observer = new MutationObserver(patchOuterFrames);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  window.addEventListener('load', patchOuterFrames, {once:true});
  window.__RONA_MOBILE_REMEDIATION_V2_STATE__ = {page,language,maxWidth:MOBILE_MAX};
})();
