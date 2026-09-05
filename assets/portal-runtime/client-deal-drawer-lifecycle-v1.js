(()=>{'use strict';
const MARK='20260905-client-deal-drawer-lifecycle-v1';
if(window.__RONA_CLIENT_DEAL_DRAWER_LIFECYCLE__===MARK)return;
window.__RONA_CLIENT_DEAL_DRAWER_LIFECYCLE__=MARK;
if(location.pathname!=='/portal/client')return;

const DRAWER='.rona-deal-command-center-v3,[data-rona-deal-passport]';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/iu;
const CLOSE_TEXT=/^(?:закрыть|close)$/iu;
const CLOSE_GLYPH=/^[×✕✖✗]$/u;
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
function shown(el){if(!el||!el.isConnected||el.hidden||el.getAttribute('aria-hidden')==='true')return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
function drawers(){return [...new Set(document.querySelectorAll(DRAWER))]}
function closeDrawer(drawer,reason='user-close'){
  if(!drawer)return false;
  drawer.hidden=true;
  drawer.setAttribute('aria-hidden','true');
  drawer.dataset.ronaContextSuppressed=reason;
  drawer.dataset.ronaDrawerLifecycle='closed';
  return true;
}
function visibleDrawers(){return drawers().filter(shown)}
function closeOthers(keeper,reason='single-visible-owner'){for(const drawer of visibleDrawers())if(drawer!==keeper)closeDrawer(drawer,reason)}
function drawerIdentity(drawer){return {dealId:norm(drawer?.dataset?.ronaAuthoritativeDealId||drawer?.getAttribute?.('data-rona-authoritative-deal-id')),context:norm(drawer?.dataset?.ronaAuthoritativeContext||drawer?.getAttribute?.('data-rona-authoritative-context'))}}
function enforceSingleAuthoritative(detail={}){
  const dealId=norm(detail.dealId),context=norm(detail.context);if(!DEAL_RE.test(dealId))return;
  const candidates=drawers().filter(drawer=>{const id=drawerIdentity(drawer);return id.dealId===dealId&&(!context||!id.context||id.context===context)});
  const keeper=candidates.find(shown)||candidates[0]||null;if(!keeper)return;
  closeOthers(keeper,'duplicate-drawer');
  keeper.dataset.ronaDrawerLifecycle='authoritative-open';
}
function closeControl(target){
  const control=target?.closest?.('button,a,[role="button"],[data-close],[data-dismiss],[data-modal-close],[data-drawer-close],[aria-label],[title]');if(!control)return null;
  const text=norm(control.textContent),aria=norm(control.getAttribute('aria-label')),title=norm(control.getAttribute('title'));
  const declared=control.hasAttribute('data-close')||control.hasAttribute('data-dismiss')||control.hasAttribute('data-modal-close')||control.hasAttribute('data-drawer-close');
  return declared||CLOSE_TEXT.test(text)||CLOSE_GLYPH.test(text)||CLOSE_TEXT.test(aria)||CLOSE_TEXT.test(title)?control:null;
}
function modalBackdropFor(target){
  if(!target||target.closest?.(DRAWER))return null;
  const semantic=target.closest?.('[data-rona-modal-backdrop],[data-rona-drawer-backdrop],[data-modal-backdrop],[data-backdrop],[class*="backdrop"],[class*="modal-overlay"],[class*="drawer-overlay"]');
  if(semantic){const owned=visibleDrawers().filter(drawer=>semantic.contains(drawer));if(owned.length===1)return owned[0]}
  for(const drawer of visibleDrawers()){
    const parent=drawer.parentElement;if(!parent||target!==parent)continue;
    const style=getComputedStyle(parent),r=parent.getBoundingClientRect();
    if((style.position==='fixed'||style.position==='absolute')&&r.width>=innerWidth*.6&&r.height>=innerHeight*.6)return drawer;
  }
  return null;
}
function onClick(event){
  const drawer=event.target?.closest?.(DRAWER)||null;
  if(drawer){const control=closeControl(event.target);if(control){closeDrawer(drawer,'user-control');queueMicrotask(()=>closeOthers(null,'user-control-cleanup'))}return}
  const backdrop=modalBackdropFor(event.target);if(backdrop){closeDrawer(backdrop,'backdrop');queueMicrotask(()=>closeOthers(null,'backdrop-cleanup'))}
}
function onKey(event){if(event.key!=='Escape')return;const open=visibleDrawers();if(open.length)closeDrawer(open[open.length-1],'escape')}
function onAuthoritativeDetail(event){queueMicrotask(()=>requestAnimationFrame(()=>enforceSingleAuthoritative(event.detail||{})))}

document.addEventListener('click',onClick,true);
document.addEventListener('keydown',onKey,true);
window.addEventListener('rona:client:deal-authoritative-detail',onAuthoritativeDetail,{passive:true});
})();
