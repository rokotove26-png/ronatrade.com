export const PAYMENTS_MONEY_DISPLAY_CONTRACT='RONA_PAYMENTS_MONEY_DISPLAY_V1';
export const PAYMENTS_MONEY_DISPLAY_MAX_FRACTION_DIGITS=1;

const paymentsMoneyDisplayContract=String.raw`
(()=>{'use strict';
const key='__RONA_PAYMENTS_MONEY_DISPLAY__';
const current=globalThis[key];
if(current&&current.contract==='RONA_PAYMENTS_MONEY_DISPLAY_V1'&&current.maximumFractionDigits===1&&typeof current.formatAmount==='function')return;
const formatter=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:1});
const finite=value=>{if(value===null||value===undefined||String(value).trim()==='')return null;const number=Number(value);return Number.isFinite(number)?number:null};
const contract=Object.freeze({
  contract:'RONA_PAYMENTS_MONEY_DISPLAY_V1',
  maximumFractionDigits:1,
  formatAmount(value){const number=finite(value);return number===null?null:formatter.format(number)}
});
Object.defineProperty(globalThis,key,{value:contract,writable:false,configurable:false,enumerable:false});
})();
`;

export default paymentsMoneyDisplayContract;
