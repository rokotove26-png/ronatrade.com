export const LPG_GAP_RUNTIME=String.raw`
;(()=>{
 if(window.__RONA_LPG_OBSERVATION_GAPS_V13__)return;
 window.__RONA_LPG_OBSERVATION_GAPS_V13__='source-observation-gaps-v13';
 const PROJECTION='20261010-admin-lpg-single-chart-owner-v1';
 let queued=false;
 function repaint(){
  const root=document.querySelector('#rona-analytics-v2');
  if(!root||!root.isConnected)return;
  const active=root.dataset.ronaSelectedProduct||window.RONA_ANALYTICS_VIEW?.getState?.()?.product;
  if(active!=='LPG')return;
  let d;try{d=JSON.parse(root.dataset.ronaLpgHistorySegments||'null')}catch(_){return}
  const ids=d?.ids,dates=d?.dates,svg=root.querySelector('.rona-market-chart-svg,[data-chart-svg]');
  const pts=[...(svg?.querySelectorAll('circle.rmc-point')||[])];
  if(!Array.isArray(ids)||!Array.isArray(dates)||pts.length<2||
     pts.length!==ids.length||ids.length!==dates.length)return;
  const sig=dates.join(',')+'|'+ids.join(',');
  const tm=dates.map(s=>Date.parse(s+'T00:00:00Z'));
  const span=tm.at(-1)-tm[0];
  if(!Number.isFinite(span)||span<=0||tm.some(v=>!Number.isFinite(v)))return;
  const xs=tm.map(v=>62+896*(v-tm[0])/span);
  const ys=pts.map(p=>Number(p.getAttribute('cy')));
  if(ys.some(v=>!Number.isFinite(v)))return;
  let segments=0;
  for(let i=1;i<ids.length;i++)if(Number(ids[i])===Number(ids[i-1]))segments++;
  const oldLines=svg.querySelectorAll('path.rmc-line').length;
  const positioned=pts.every((p,i)=>Math.abs(Number(p.getAttribute('cx'))-xs[i])<.25);
  const straight=[...svg.querySelectorAll('path.rmc-line')].every(p=>!String(p.getAttribute('d')||'').includes(' C '));
  // The SVG element survives native chart rerenders; a date-only signature
  // would falsely accept newly generated equal-spaced points on the same dates.
  if(svg.dataset.ronaLpgHistoryV13===sig&&positioned&&oldLines===segments&&straight)return;
  pts.forEach((p,i)=>{
    p.setAttribute('cx',String(xs[i]));
    let tip=p.querySelector('title');
    if(!tip){tip=document.createElementNS('http://www.w3.org/2000/svg','title');p.append(tip)}
    tip.textContent=dates[i]+' · подтверждённое наблюдение Platts';
  });
  const labels=[...svg.querySelectorAll('text.rmc-point-label')];
  let lastLabel=-Infinity;
  labels.forEach((p,i)=>{
    p.setAttribute('x',String(xs[i]));
    const show=i===0||i===labels.length-1||(xs[i]-lastLabel>=63&&xs.at(-1)-xs[i]>=63);
    p.style.display=show?'':'none';
    if(show)lastLabel=xs[i];
    p.setAttribute('text-anchor',i===0?'start':i===labels.length-1?'end':'middle');
  });
  svg.querySelectorAll('path.rmc-area,path.rmc-line-depth,path.rmc-line-glow,path.rmc-line').forEach(n=>n.remove());
  for(let i=1;i<ids.length;i++)if(Number(ids[i])===Number(ids[i-1]))
   for(const cl of ['rmc-line-depth','rmc-line-glow','rmc-line']){
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('class',cl);
    p.setAttribute('d','M '+xs[i-1]+' '+ys[i-1]+' L '+xs[i]+' '+ys[i]);
    svg.insertBefore(p,pts[0]);
   }
  let lastTick=-Infinity;
  const ticks=[...svg.querySelectorAll('text.rmc-axis[y="372"]')];
  ticks.forEach(t=>{
    const i=dates.findIndex(s=>s.slice(8,10)+'.'+s.slice(5,7)===String(t.textContent||'').trim());
    if(i<0)return;
    t.setAttribute('x',String(xs[i]));
    const show=i===0||i===dates.length-1||(xs[i]-lastTick>=64&&xs.at(-1)-xs[i]>=64);
    t.style.display=show?'':'none';
    if(show)lastTick=xs[i];
    t.setAttribute('text-anchor',i===0?'start':i===dates.length-1?'end':'middle');
  });
  svg.dataset.ronaLpgHistoryV13=sig;
  svg.dataset.ronaGapProjection=PROJECTION;
  root.dataset.ronaGapInterpolation='OFF';
  root.dataset.ronaSourceGapSegments=String(new Set(ids.map(Number)).size);
 }
 function schedule(){
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;repaint()});
 }
 document.addEventListener('click',e=>{
  if(e.target?.closest?.('[data-product="LPG"],[data-an2-product="LPG"]'))schedule();
 },true);
 window.addEventListener('rona:analytics-live-applied',schedule);
 window.addEventListener('rona:admin-pagechange',schedule);
 const mo=new MutationObserver(schedule);
 mo.observe(document.documentElement,{subtree:true,childList:true});
 schedule();
})();
`;
