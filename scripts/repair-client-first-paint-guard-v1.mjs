import { readFile, writeFile } from 'node:fs/promises';

const htmlPath='dist/portal/client.html';
const guardId='rona-client-home-first-paint-guard';
const guardRe=new RegExp(`<style\\b[^>]*\\bid=["']${guardId}["'][^>]*>[\\s\\S]*?<\\/style>`,'giu');

let html=await readFile(htmlPath,'utf8');
const before=[...html.matchAll(guardRe)].length;
if(before<1)throw new Error(`CLIENT_FIRST_PAINT_GUARD_MISSING: ${guardId}`);

if(before>1){
  let kept=false;
  html=html.replace(guardRe,(block)=>{
    if(!kept){kept=true;return block}
    return '';
  });
  await writeFile(htmlPath,html,'utf8');
}

const after=[...html.matchAll(guardRe)].length;
if(after!==1)throw new Error(`CLIENT_FIRST_PAINT_GUARD_DEDUPE_FAILED: before=${before} after=${after}`);
console.log(`CLIENT_FIRST_PAINT_GUARD_DEDUPE=PASS before=${before} after=${after} kept=first-current-lifecycle-guard`);
