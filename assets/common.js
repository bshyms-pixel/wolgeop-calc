
const W = {
  n(id){ const el=document.getElementById(id); if(!el) return 0; const v=String(el.value).replace(/,/g,'').trim(); return Math.max(0,Number(v)||0); },
  money(man){
    if(!Number.isFinite(man)) return '-';
    const won=Math.round(man*10000);
    if(won>=100000000){
      const e=won/100000000;
      return (Number.isInteger(e)?e.toFixed(0):e.toFixed(2).replace(/0+$/,'').replace(/\.$/,''))+'억원';
    }
    return Math.round(man).toLocaleString('ko-KR')+'만원';
  },
  fv(initial,monthly,years,annualRate){
    const months=Math.max(0,Math.round(years*12)), r=annualRate/100/12;
    if(r===0) return initial+monthly*months;
    return initial*Math.pow(1+r,months)+monthly*((Math.pow(1+r,months)-1)/r);
  },
  requiredMonthly(initial,target,years,annualRate){
    const months=Math.max(1,Math.round(years*12)), r=annualRate/100/12;
    if(r===0) return Math.max(0,(target-initial)/months);
    const grown=initial*Math.pow(1+r,months);
    return Math.max(0,(target-grown)*r/(Math.pow(1+r,months)-1));
  },
  yearsToGoal(initial,monthly,target,annualRate){
    if(initial>=target) return 0;
    if(monthly<=0 && annualRate<=0) return Infinity;
    let val=initial, r=annualRate/100/12;
    for(let m=1;m<=1200;m++){ val=val*(1+r)+monthly; if(val>=target) return m/12; }
    return Infinity;
  }
};
