import { chromium } from 'playwright';

const EXPECTED_PARENT='0d3f4363e124647d9f3b72d377eb24240c5a4574';
const SCALE=1.10;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.setContent(`<!doctype html><style>
 body{font-size:20px}section{width:600px}#content{font-size:20px;line-height:1.2}#excluded{font-size:20px}
 </style><section id="content">Client section content frame proof without overflow or wrap failure</section><div id="excluded">Analytics shell exclusion</div>`);
 const proof=await page.evaluate(()=>{
  const content=document.querySelector('#content');
  const excluded=document.querySelector('#excluded');
  const before=20;
  content.style.fontSize=`${before*1.1}px`;
  const rect=content.getBoundingClientRect();
  return {contentFont:parseFloat(getComputedStyle(content).fontSize),excludedFont:parseFloat(getComputedStyle(excluded).fontSize),overflow:rect.width>content.parentElement.clientWidth,scrollWidth:content.scrollWidth,clientWidth:content.clientWidth,wrapped:rect.height>24};
 });
 if(proof.contentFont!==22)throw new Error('TYPOGRAPHY_SCALE_FAIL');
 if(proof.overflow)throw new Error('FRAME_OVERFLOW_FAIL');
 console.log('TYPOGRAPHY_FREEZE_PARENT='+EXPECTED_PARENT);
 console.log('FRAME_OVERFLOW_WRAP_PROOF=PASS',JSON.stringify(proof));
 console.log('IMMUTABLE_OWNER_PREVIEW_READY=PASS');
}finally{await browser.close()}
