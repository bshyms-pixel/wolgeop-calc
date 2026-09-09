
const $=id=>document.getElementById(id);
const page=document.body.dataset.page;
const storeKey="wolgeup_calc_v04";
const krw=v=>new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW",maximumFractionDigits:0}).format(Math.round(v||0));
const num=v=>Number(String(v??"").replace(/[^\d.-]/g,""))||0;
const comma=v=>Math.round(num(v)).toLocaleString("ko-KR");
let state={
  salaryMode:"gross",
  salary:40000000,
  manualNetMonthly:3000000,
  assets:0,debt:0,targetAssets:100000000,
  targetDateMode:"relative",targetDate:"",targetYears:5,targetMonths:0,
  monthlySaving:700000,dependents:1,children:0,nonTaxMonthly:200000,withholdingRate:1,
  deductPension:true,deductHealth:true,deductLongCare:true,deductEmployment:true,
  simDateMode:"relative",simYears:5,simMonths:0,
  onboarded:false,goalName:"1억 만들기",goals:[]
};
function load(){try{const s=JSON.parse(localStorage.getItem(storeKey));if(s)state={...state,...s}}catch(e){}}
function save(){localStorage.setItem(storeKey,JSON.stringify(state))}
function bindMenu(){const b=document.querySelector(".mobile-menu-btn"),m=document.querySelector(".mobile-menu");if(b&&m)b.onclick=()=>m.classList.toggle("hidden")}
function bindCommaInputs(){
  document.querySelectorAll(".comma-input").forEach(el=>{
    el.addEventListener("focus",()=>{el.selectionStart=el.selectionEnd=el.value.length});
    el.addEventListener("input",()=>{
      const raw=el.value.replace(/[^\d]/g,"").replace(/^0+(?=\d)/,"");
      el.value=raw?Number(raw).toLocaleString("ko-KR"):"0";
    });
  });
}
function monthsTo(dateStr){
  if(!dateStr)return 0;
  const end=new Date(dateStr+"T23:59:59");
  return Math.max(0,(end-new Date())/(1000*60*60*24*30.4375));
}
function formatPeriod(months){
  if(months<1)return "1개월 미만";
  const y=Math.floor(months/12),m=Math.round(months-y*12);
  if(y===0)return `약 ${m}개월`;
  return m?`약 ${y}년 ${m}개월`:`약 ${y}년`;
}
function relativeDate(years,months){
  const d=new Date();
  const day=d.getDate();
  d.setDate(1);
  d.setFullYear(d.getFullYear()+Math.max(0,+years||0));
  d.setMonth(d.getMonth()+Math.max(0,+months||0));
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));
  return d;
}
function isoDate(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function prettyDate(d){return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;}
function resolvedGoalDate(){
  return state.targetDateMode==="relative" ? isoDate(relativeDate(state.targetYears,state.targetMonths)) : state.targetDate;
}
function resolvedSimDate(){
  return state.simDateMode==="relative" ? isoDate(relativeDate(state.simYears,state.simMonths)) : ($("simDate")?.value||state.targetDate);
}
function futureValue(p,m,r,months){
  const rm=r/100/12;
  if(months<=0)return p;
  if(!rm)return p+m*months;
  return p*Math.pow(1+rm,months)+m*((Math.pow(1+rm,months)-1)/rm);
}
function goalDateFor(p,m,r,g){
  if(p>=g)return new Date();
  const rm=r/100/12; let n;
  if(!rm)n=m>0?(g-p)/m:Infinity;
  else if(m===0)n=p>0?Math.log(g/p)/Math.log(1+rm):Infinity;
  else n=Math.log((g+m/rm)/(p+m/rm))/Math.log(1+rm);
  if(!isFinite(n)||n<0)return null;
  const d=new Date();d.setMonth(d.getMonth()+Math.ceil(n));return d;
}

/* 2026 salary estimator
   Official social insurance rates:
   NPS employee 4.75%, NHIS employee 3.595%, employment 0.9%.
   Long-term care = health premium × 0.9448 / 7.19.
   Income tax here is an annualized approximation, not the NTS monthly simplified withholding table.
*/
function earnedIncomeDeduction(grossAnnual){
  const x=grossAnnual;
  if(x<=5000000)return x*0.70;
  if(x<=15000000)return 3500000+(x-5000000)*0.40;
  if(x<=45000000)return 7500000+(x-15000000)*0.15;
  if(x<=100000000)return 12000000+(x-45000000)*0.05;
  return Math.min(14750000+(x-100000000)*0.02,20000000);
}
function progressiveTax(base){
  if(base<=14000000)return base*0.06;
  if(base<=50000000)return base*0.15-1260000;
  if(base<=88000000)return base*0.24-5760000;
  if(base<=150000000)return base*0.35-15440000;
  if(base<=300000000)return base*0.38-19940000;
  if(base<=500000000)return base*0.40-25940000;
  if(base<=1000000000)return base*0.42-35940000;
  return base*0.45-65940000;
}
function estimateSalary(){
  const annual=Math.max(0,state.salary),grossM=annual/12,nonTaxM=Math.min(Math.max(0,state.nonTaxMonthly),grossM);
  // 2026 NPS standard income monthly cap 6.59m from July; use cap for current estimate.
  const pensionBase=Math.min(Math.max(grossM-nonTaxM,0),6590000);
  const pensionRaw=pensionBase*0.0475;
  const healthBase=Math.max(grossM-nonTaxM,0);
  const healthRaw=healthBase*0.03595;
  const longCareRaw=healthRaw*(0.009448/0.0719);
  const employmentRaw=healthBase*0.009;
  const pension=state.deductPension?pensionRaw:0;
  const health=state.deductHealth?healthRaw:0;
  const longCare=state.deductLongCare?longCareRaw:0;
  const employment=state.deductEmployment?employmentRaw:0;
  const taxableAnnual=Math.max(0,annual-nonTaxM*12);
  const earnedDed=earnedIncomeDeduction(taxableAnnual);
  const personalDed=Math.max(1,state.dependents)*1500000;
  // Simplified approximation for annual taxable base and child credit.
  const taxableBase=Math.max(0,taxableAnnual-earnedDed-personalDed);
  let annualIncomeTax=progressiveTax(taxableBase);
  // approximate earned-income tax credit, capped in a simple band; child credit simplification
  let earnedCredit=Math.min(annualIncomeTax*0.55,660000);
  const childCredit=state.children===1?150000:state.children===2?350000:state.children>=3?350000+(state.children-2)*300000:0;
  annualIncomeTax=Math.max(0,annualIncomeTax-earnedCredit-childCredit)*(state.withholdingRate||1);
  const localTax=annualIncomeTax*0.10;
  const incomeTaxMonthly=(annualIncomeTax+localTax)/12;
  const takeHome=grossM-pension-health-longCare-employment-incomeTaxMonthly;
  return {grossM,pension,health,longCare,employment,incomeTaxMonthly,takeHome};
}
function syncStateFromHome(){
  state.salary=num($("annualSalary").value);
  state.manualNetMonthly=num($("manualNetMonthly").value);
  state.assets=num($("currentAssets").value);
  state.debt=num($("currentDebt").value);
  state.targetAssets=num($("targetAssets").value);
  state.targetDate=$("targetDate").value;
  state.targetYears=Math.max(0,+$("targetYears").value||0);
  state.targetMonths=Math.min(11,Math.max(0,+$("targetMonths").value||0));
  state.monthlySaving=num($("monthlySaving").value);
  state.dependents=Math.max(1,+$("dependents").value||1);
  state.children=Math.max(0,+$("children").value||0);
  state.nonTaxMonthly=num($("nonTaxMonthly").value);
  state.withholdingRate=+$("withholdingRate").value||1;
  state.deductPension=$("deductPension").checked;
  state.deductHealth=$("deductHealth").checked;
  state.deductLongCare=$("deductLongCare").checked;
  state.deductEmployment=$("deductEmployment").checked;
  save();
}
function renderHome(){
  const s=estimateSalary();
  const manual=state.salaryMode==="net";
  $("salaryPersonalize").classList.toggle("hidden",manual);
  $("salaryResultTitle").textContent=manual?"입력한 월 실수령액":"월 예상 실수령액";
  $("salaryResultBadge").textContent=manual?"DIRECT":"BETA";
  $("grossMonthly").textContent=manual?"직접 입력":krw(s.grossM);
  $("pension").textContent=manual?"-":(state.deductPension?"-"+krw(s.pension):"회사 보전");
  $("health").textContent=manual?"-":(state.deductHealth?"-"+krw(s.health):"회사 보전");
  $("longCare").textContent=manual?"-":(state.deductLongCare?"-"+krw(s.longCare):"회사 보전");
  $("employment").textContent=manual?"-":(state.deductEmployment?"-"+krw(s.employment):"회사 보전");
  $("incomeTax").textContent=manual?"-":"-"+krw(s.incomeTaxMonthly);
  const takeHome=manual?state.manualNetMonthly:s.takeHome;
  $("takeHomeMonthly").textContent=krw(takeHome);
  $("takeHomeRate").textContent=manual?"사용자가 직접 입력한 실제 수령액":`세전 월급의 ${s.grossM?((s.takeHome/s.grossM)*100).toFixed(1):0}% 예상`;
  $("salaryBetaNote").textContent=manual
    ?"급여명세서의 실제 월 입금액을 직접 입력한 값입니다. 세금·4대보험 추정은 적용하지 않습니다."
    :"4대보험은 2026 공식 요율을 반영했습니다. 회사가 근로자 부담분을 별도 복지·수당으로 보전하는 경우 해당 차감 스위치를 해제할 수 있습니다. 소득세는 베타 추정치입니다.";

  const resolved=resolvedGoalDate();
  const rd=new Date(resolved+"T12:00:00");
  $("computedTargetDate").textContent=prettyDate(rd);
  const months=monthsTo(resolved);
  const F=futureValue(state.assets,state.monthlySaving,+$("annualReturn").value||0,months),pct=state.targetAssets?F/state.targetAssets*100:0;
  $("futureAssets").textContent=krw(F);
  $("goalPct").textContent=pct.toFixed(1)+"%";
  $("goalBar").style.width=Math.min(100,Math.max(0,pct))+"%";
  $("goalPeriod").textContent=formatPeriod(months);
  $("goalShort").textContent=krw(Math.max(state.targetAssets-F,0));
  const gd=goalDateFor(state.assets,state.monthlySaving,+$("annualReturn").value||0,state.targetAssets);
  $("goalExpectedDate").textContent=gd?`${gd.getFullYear()}.${String(gd.getMonth()+1).padStart(2,"0")}`:"계산 불가";
  const need=months>0?Math.max((state.targetAssets-state.assets)/months-state.monthlySaving,0):0;
  $("goalInsight").textContent=pct>=100?"현재 조건이라면 선택한 목표 시점 안에 목표자산을 넘길 수 있습니다.":`수익률 0% 단순 기준으로 목표 시점을 맞추려면 현재보다 월 ${krw(need)}을 더 자산으로 전환해야 합니다.`;
}
function initHome(){
  $("annualSalary").value=comma(state.salary);
  $("manualNetMonthly").value=comma(state.manualNetMonthly);
  $("currentAssets").value=comma(state.assets);
  $("currentDebt").value=comma(state.debt);
  $("targetAssets").value=comma(state.targetAssets);
  $("targetDate").value=state.targetDate||$("targetDate").value;
  $("targetYears").value=state.targetYears;
  $("targetMonths").value=state.targetMonths;
  $("monthlySaving").value=comma(state.monthlySaving);
  $("dependents").value=state.dependents;
  $("children").value=state.children;
  $("nonTaxMonthly").value=comma(state.nonTaxMonthly);
  $("withholdingRate").value=state.withholdingRate;
  $("deductPension").checked=state.deductPension;
  $("deductHealth").checked=state.deductHealth;
  $("deductLongCare").checked=state.deductLongCare;
  $("deductEmployment").checked=state.deductEmployment;

  function renderSalaryMode(){
    const gross=state.salaryMode==="gross";
    $("grossSalaryArea").classList.toggle("hidden",!gross);
    $("netSalaryArea").classList.toggle("hidden",gross);
    document.querySelectorAll("#salaryModeSwitch button").forEach(b=>b.classList.toggle("active",b.dataset.mode===state.salaryMode));
  }
  function renderGoalDateMode(){
    const rel=state.targetDateMode==="relative";
    $("relativeGoalDateArea").classList.toggle("hidden",!rel);
    $("exactGoalDateArea").classList.toggle("hidden",rel);
    document.querySelectorAll("#goalDateModeSwitch button").forEach(b=>b.classList.toggle("active",b.dataset.mode===state.targetDateMode));
  }

  document.querySelectorAll("#salaryModeSwitch button").forEach(b=>b.addEventListener("click",()=>{
    state.salaryMode=b.dataset.mode;save();renderSalaryMode();renderHome();
  }));
  document.querySelectorAll("#goalDateModeSwitch button").forEach(b=>b.addEventListener("click",()=>{
    state.targetDateMode=b.dataset.mode;save();renderGoalDateMode();renderHome();
  }));

  $("toggleSalaryDetail").onclick=()=>{
    $("salaryDetail").classList.toggle("hidden");
    $("toggleSalaryDetail").textContent=$("salaryDetail").classList.contains("hidden")?"상세조건 열기 ＋":"상세조건 닫기 －";
  };

  ["annualSalary","manualNetMonthly","currentAssets","currentDebt","targetAssets","targetDate","targetYears","targetMonths","monthlySaving","dependents","children","nonTaxMonthly","withholdingRate","deductPension","deductHealth","deductLongCare","deductEmployment","annualReturn"].forEach(id=>{
    $(id).addEventListener("input",()=>{syncStateFromHome();renderHome();});
    $(id).addEventListener("change",()=>{syncStateFromHome();renderHome();});
  });
  renderSalaryMode();renderGoalDateMode();renderHome();
}
function displayManwon(v){return (v/10000).toLocaleString("ko-KR")+"만원"}
function updateBubble(input,bubble){
  const min=+input.min,max=+input.max,val=+input.value,pct=(val-min)/(max-min)*100;
  bubble.style.left=`calc(${pct}% + ${(8-pct*.16)}px)`;
  bubble.textContent=displayManwon(val);
}
function initSimulator(){
  $("simBaseAssets").textContent=krw(state.assets);
  $("simYears").value=state.simYears||5;
  $("simMonths").value=state.simMonths||0;
  if(state.targetDate)$("simDate").value=state.targetDate;

  function renderMode(){
    const rel=state.simDateMode==="relative";
    $("simRelativeArea").classList.toggle("hidden",!rel);
    $("simExactArea").classList.toggle("hidden",rel);
    document.querySelectorAll("#simDateModeSwitch button").forEach(b=>b.classList.toggle("active",b.dataset.mode===state.simDateMode));
  }
  function render(){
    state.simYears=Math.max(0,+$("simYears").value||0);
    state.simMonths=Math.min(11,Math.max(0,+$("simMonths").value||0));
    state.targetDate=$("simDate").value||state.targetDate;
    save();
    const resolved=resolvedSimDate();
    const d=new Date(resolved+"T12:00:00");
    $("simComputedDate").textContent=prettyDate(d);
    const months=monthsTo(resolved);
    if($("simPeriod"))$("simPeriod").textContent="오늘부터 "+formatPeriod(months);
    let total=0;
    [["simSave","simSaveValue","simSaveBubble","simSaveImpact"],["simIncome","simIncomeValue","simIncomeBubble","simIncomeImpact"],["simCut","simCutValue","simCutBubble","simCutImpact"]].forEach(([id,vid,bid,oid])=>{
      const v=+$(id).value||0,impact=v*months;total+=impact;$(vid).textContent=displayManwon(v);updateBubble($(id),$(bid));$(oid).textContent="+"+krw(impact);
    });
    $("simTotalImpact").textContent="+"+krw(total);
  }
  document.querySelectorAll("#simDateModeSwitch button").forEach(b=>b.addEventListener("click",()=>{
    state.simDateMode=b.dataset.mode;save();renderMode();render();
  }));
  ["simDate","simYears","simMonths","simSave","simIncome","simCut"].forEach(id=>{
    $(id).addEventListener("input",render);$(id).addEventListener("change",render);
  });
  renderMode();render();
}
function initSignup(){
  $("signupForm").addEventListener("submit",e=>{e.preventDefault();const a=$("signupPassword").value,b=$("signupPassword2").value,msg=$("signupMessage");msg.classList.remove("hidden");if(a!==b){msg.style.background="#FFF0EE";msg.style.color="#B8574F";msg.textContent="비밀번호가 일치하지 않습니다."}else{msg.style.background="#EEF7F1";msg.style.color="#26734D";msg.textContent="회원가입 UI 데모가 정상 작동합니다. 실제 계정 생성은 서버 연결 후 활성화됩니다."}});
}
function initCheckout(){
  $("checkoutForm").addEventListener("submit",e=>{e.preventDefault();const msg=$("checkoutMessage");msg.classList.remove("hidden");msg.textContent="결제 UI 데모입니다. 실제 결제는 발생하지 않았습니다."});
}
load();bindMenu();bindCommaInputs();
if(page==="home" && $("annualSalary"))initHome();
if(page==="simulator")initSimulator();
if(page==="signup")initSignup();
if(page==="checkout")initCheckout();

/* ===== V0.6 MONEY MAP ===== */
function initOnboarding(){
  let step=0,incomeMode="net",goalName="1억 만들기";
  const steps=[...document.querySelectorAll(".ob-step")], dots=[...document.querySelectorAll(".stepper i")];
  function draw(){steps.forEach((s,i)=>s.classList.toggle("hidden",i!==step));dots.forEach((d,i)=>d.classList.toggle("active",i<=step));$("obPrev").classList.toggle("hidden",step===0);$("obNext").textContent=step===steps.length-1?"MONEY MAP 만들기":"다음";}
  document.querySelectorAll("#obIncomeMode button").forEach(b=>b.onclick=()=>{incomeMode=b.dataset.mode;document.querySelectorAll("#obIncomeMode button").forEach(x=>x.classList.toggle("active",x===b));$("obNetArea").classList.toggle("hidden",incomeMode!=="net");$("obGrossArea").classList.toggle("hidden",incomeMode!=="gross")});
  const goalMeta={
    "1억 만들기":{icon:"💰",desc:"현재 자산과 월 저축액을 기준으로 1억을 만드는 데 걸리는 시간을 알려드립니다.",target:100000000},
    "내 집 마련":{icon:"🏠",desc:"목표 주택자금과 현재 자산을 기준으로 내 집 마련에 필요한 기간을 알려드립니다.",target:300000000},
    "자동차":{icon:"🚗",desc:"원하는 차량가격을 기준으로 무리 없이 구매자금을 만드는 데 필요한 시간을 알려드립니다.",target:35000000},
    "여행":{icon:"✈️",desc:"원하는 여행경비를 정하면 그 돈을 모으는 데 걸리는 시간을 알려드립니다.",target:5000000},
    "직접 입력":{icon:"＋",desc:"결혼자금·비상금·창업자금 등 원하는 목표와 금액을 직접 설정할 수 있습니다.",target:10000000}
  };
  function renderGoalChoice(){const m=goalMeta[goalName]; if($("goalChoiceSummary")) $("goalChoiceSummary").innerHTML=`<b>${m.icon} ${goalName}</b><p>${m.desc}</p>`;}
  document.querySelectorAll(".goal-choice button").forEach(b=>b.onclick=()=>{goalName=b.dataset.goal;document.querySelectorAll(".goal-choice button").forEach(x=>x.classList.toggle("active",x===b));const m=goalMeta[goalName];$("obTarget").value=comma(m.target);renderGoalChoice();});
  renderGoalChoice();
  $("obPrev").onclick=()=>{step=Math.max(0,step-1);draw()};
  $("obNext").onclick=()=>{if(step<steps.length-1){step++;draw();return}
    state.salaryMode=incomeMode; state.manualNetMonthly=num($("obNet").value); state.salary=num($("obGross").value); state.assets=num($("obAssets").value); state.debt=num($("obDebt").value); state.monthlySaving=num($("obSaving").value); state.targetAssets=num($("obTarget").value); state.targetYears=+$("obYears").value||0; state.targetMonths=+$("obMonths").value||0; state.targetDateMode="relative"; state.goalName=goalName; state.onboarded=true;
    const primary={id:"primary",name:goalName,target:state.targetAssets,current:Math.max(0,state.assets-state.debt),monthly:state.monthlySaving,primary:true};
    const rest=(state.goals||[]).filter(g=>g.id!=="primary"); state.goals=[{...primary,current:Math.max(0,state.assets-state.debt)},...rest]; save(); window.location.href="index.html#demo-map";
  };
  draw();
}
function initAssets(){
  if(!$('assetTotal'))return;
  const render=()=>{$('assetTotal').textContent=krw(state.assets);$('debtTotal').textContent=krw(state.debt);$('netWorthTotal').textContent=krw(state.assets-state.debt); if($('assetQuickTotal'))$('assetQuickTotal').value=comma(state.assets); if($('debtQuickTotal'))$('debtQuickTotal').value=comma(state.debt)};
  render();
  ['assetQuickTotal','debtQuickTotal'].forEach(id=>{if($(id))$(id).addEventListener('change',()=>{state.assets=num($('assetQuickTotal').value);state.debt=num($('debtQuickTotal').value);save();render(); if($('assetSaveState')){$('assetSaveState').textContent='저장됨 ✓';setTimeout(()=>$('assetSaveState').textContent='브라우저에 자동 저장',1200)}})});
}
function initGoals(){
  if(!$("goalPageName"))return;
  const name=state.goalName||"1억 만들기"; $("goalPageName").textContent=name; $("goalPageCurrent").textContent=krw(state.assets); $("goalPageTarget").textContent="/ "+krw(state.targetAssets);
  const pct=state.targetAssets?Math.max(0,state.assets/state.targetAssets*100):0;$("goalPagePct").textContent=pct.toFixed(1)+"% 달성";$("goalPageBar").style.width=Math.min(100,pct)+"%";
  const d=relativeDate(state.targetYears||5,state.targetMonths||0);$("goalPageDate").textContent="목표 "+d.getFullYear()+"."+String(d.getMonth()+1).padStart(2,"0");
}
if(page==="onboarding")initOnboarding();
if(page==="assets")initAssets();
if(page==="goals")initGoals();


/* ===== V0.7 CONNECTED MONEY MAP + GOALS + DEV ANALYTICS ===== */
const goalCatalog={
  "1억 만들기":{icon:"💰",desc:"현재 자산과 월 저축액을 기준으로 1억을 만드는 데 걸리는 시간을 알려드립니다.",target:100000000},
  "내 집 마련":{icon:"🏠",desc:"목표 주택자금과 현재 자산을 기준으로 내 집 마련에 필요한 기간을 알려드립니다.",target:300000000},
  "자동차":{icon:"🚗",desc:"원하는 차량가격을 기준으로 구매자금을 만드는 데 필요한 시간을 알려드립니다.",target:35000000},
  "여행":{icon:"✈️",desc:"원하는 여행경비를 정하면 그 돈을 모으는 데 걸리는 시간을 알려드립니다.",target:5000000},
  "직접 입력":{icon:"＋",desc:"결혼자금·비상금·창업자금 등 원하는 목표와 금액을 직접 설정할 수 있습니다.",target:10000000}
};
function monthsNeeded(current,target,monthly){
  const gap=Math.max(0,target-current); if(gap<=0)return 0; if(monthly<=0)return Infinity; return Math.ceil(gap/monthly);
}
function goalTimeText(current,target,monthly){
  const m=monthsNeeded(current,target,monthly); if(!isFinite(m))return "월 적립액 필요"; if(m===0)return "이미 달성"; const y=Math.floor(m/12),r=m%12; return y?(r?`${y}년 ${r}개월`:`${y}년`):`${r}개월`;
}
function monthlyNetIncome(){return state.salaryMode==="net"?state.manualNetMonthly:estimateSalary().takeHome;}
function initMoneyMapHome(){
  if(!$("homeNetWorth"))return;
  if(!state.onboarded)return;
  const netWorth=state.assets-state.debt, income=monthlyNetIncome(), saving=state.monthlySaving;
  const saveRate=income>0?saving/income*100:0;
  $("homeMapEyebrow").textContent="MY MONEY MAP";
  $("homeMapTitle").textContent="입력한 숫자로 만든 나의 MONEY MAP";
  $("homeMapDesc").textContent="내 숫자가 자산·목표·시뮬레이션에 연결되어 있습니다. 숫자를 바꾸면 같은 기준으로 다시 계산할 수 있어요.";
  $("homeNetWorth").textContent=krw(netWorth); $("homeNetWorthNote").textContent=`금융자산 ${krw(state.assets)} · 부채 ${krw(state.debt)}`; $("homeNetWorthNote").classList.remove("up");
  $("homeSaving").textContent="+"+krw(saving); $("homeSavingRate").textContent=saveRate.toFixed(1)+"%"; $("homeSavingRateNote").textContent=`월 실수령 ${krw(income)} 기준`; $("homeSavingRateNote").classList.remove("up");
  $("homeTo100m").textContent=goalTimeText(Math.max(0,netWorth),100000000,saving);
  const g=(state.goals||[])[0]||{name:state.goalName||"1억 만들기",target:state.targetAssets,current:Math.max(0,state.assets-state.debt),monthly:saving};
  const meta=goalCatalog[g.name]||goalCatalog["직접 입력"], current=g.current ?? state.assets, target=g.target||state.targetAssets, monthly=g.monthly||saving;
  const pct=target?Math.max(0,Math.min(100,current/target*100)):0, needM=monthsNeeded(current,target,monthly);
  $("homeGoalIcon").textContent=meta.icon; $("homeGoalName").textContent=g.name; $("homeGoalCurrent").textContent=krw(current); $("homeGoalTarget").textContent="/ "+krw(target); $("homeGoalBar").style.width=pct+"%"; $("homeGoalPct").textContent=pct.toFixed(1)+"% 달성";
  if(isFinite(needM)){const gd=new Date();gd.setMonth(gd.getMonth()+needM);$("homeGoalDate").textContent=`예상 ${gd.getFullYear()}.${String(gd.getMonth()+1).padStart(2,"0")}`;}
  else $("homeGoalDate").textContent="월 적립액 필요";
  $("homeGoalStatusLabel").textContent="현재 속도 기준"; $("homeGoalStatus").textContent=goalTimeText(current,target,monthly); $("homeGoalAdvice").textContent=monthly>0?`월 ${krw(monthly)}씩 유지하면 목표금액까지 위 기간이 예상됩니다.`:"월 적립액을 설정하면 목표까지 걸리는 시간을 계산해드립니다.";
  const notice=$("homeProfileNotice"); notice.classList.remove("hidden"); notice.innerHTML=`<b>✓ 내 숫자가 연결되었습니다.</b> 월 실수령 ${krw(income)} · 금융자산 ${krw(state.assets)} · 월 저축 ${krw(saving)} <a href="onboarding.html">수정하기 →</a>`;
}
function ensureGoals(){
  if(!Array.isArray(state.goals))state.goals=[];
  if(!state.goals.length && state.onboarded)state.goals=[{id:"primary",name:state.goalName||"1억 만들기",target:state.targetAssets,current:Math.max(0,state.assets-state.debt),monthly:state.monthlySaving,primary:true}];
}
function initGoalManager(){
  if(!$("goalList"))return; ensureGoals();
  const list=$("goalList"), form=$("goalFormCard"); let selected="1억 만들기";
  function draw(){
    ensureGoals();
    if(!state.goals.length){list.innerHTML=`<article class="empty-goals"><span>◎</span><h3>아직 목표가 없습니다.</h3><p>새 목표를 추가하면 필요한 기간을 바로 계산해드립니다.</p></article>`;return;}
    list.innerHTML=state.goals.map((g,i)=>{const meta=goalCatalog[g.name]||goalCatalog["직접 입력"], cur=+g.current||0,t=+g.target||0,m=+g.monthly||0,pct=t?Math.min(100,cur/t*100):0; return `<article class="goal-item dashboard-card"><div class="goal-item-top"><div><span class="goal-big-icon">${meta.icon}</span><small>${g.primary?"PRIMARY GOAL":"MY GOAL"}</small><h3>${g.name}</h3><p>${meta.desc}</p></div><button class="goal-delete ${g.primary?"hidden":""}" data-delete="${g.id}" type="button">삭제</button></div><div class="goal-money"><strong>${krw(cur)}</strong><span>/ ${krw(t)}</span></div><div class="progress light-track"><i style="width:${pct}%"></i></div><div class="goal-labels"><span>${pct.toFixed(1)}% 달성</span><span>월 ${krw(m)}</span></div><div class="goal-time-box"><small>현재 속도로 걸리는 시간</small><strong>${goalTimeText(cur,t,m)}</strong></div><a href="simulator.html" class="btn secondary full">이 목표 더 빨리 달성하기 →</a></article>`}).join("");
    list.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{state.goals=state.goals.filter(g=>g.id!==b.dataset.delete);save();draw();});
  }
  function renderNewSummary(){const m=goalCatalog[selected]||goalCatalog["직접 입력"];$("newGoalSummary").innerHTML=`<b>${m.icon} ${selected}</b><p>${m.desc}</p>`;}
  $("openGoalForm").onclick=()=>form.classList.remove("hidden"); $("closeGoalForm").onclick=()=>form.classList.add("hidden");
  document.querySelectorAll("#newGoalChoice button").forEach(b=>b.onclick=()=>{selected=b.dataset.goal;document.querySelectorAll("#newGoalChoice button").forEach(x=>x.classList.toggle("active",x===b));const m=goalCatalog[selected];$("newGoalName").value=selected;$("newGoalTarget").value=comma(m.target);renderNewSummary();});
  $("saveNewGoal").onclick=()=>{const name=$("newGoalName").value.trim()||selected,target=num($("newGoalTarget").value),current=num($("newGoalCurrent").value),monthly=num($("newGoalMonthly").value); if(target<=0){alert("목표금액을 입력해주세요.");return;} state.goals.push({id:"g"+Date.now(),name,target,current,monthly,primary:false}); save(); form.classList.add("hidden"); draw();};
  renderNewSummary(); draw();
}

const analyticsKey="wolgeup_calc_analytics_v1";
function getAnalytics(){try{return JSON.parse(localStorage.getItem(analyticsKey))||{events:[]}}catch(e){return {events:[]}}}
function trackEvent(type,label,extra={}){const a=getAnalytics();a.events.push({type,label,page:location.pathname.split("/").pop()||"index.html",ts:Date.now(),session:sessionStorage.getItem("wg_session")||"" ,...extra}); if(a.events.length>3000)a.events=a.events.slice(-3000);localStorage.setItem(analyticsKey,JSON.stringify(a)); if(typeof window.gtag==="function")window.gtag("event",type,{event_label:label,page_path:location.pathname,...extra});}
function initTracking(){
  if(!sessionStorage.getItem("wg_session"))sessionStorage.setItem("wg_session",Date.now()+"_"+Math.random().toString(36).slice(2));
  trackEvent("page_view",document.title);
  document.addEventListener("click",e=>{const el=e.target.closest("a,button");if(!el)return;const label=(el.dataset.track||el.textContent||el.getAttribute("aria-label")||"click").trim().replace(/\s+/g," ").slice(0,80);trackEvent("click",label,{href:el.getAttribute("href")||""});});
}
function initAnalyticsPage(){
  if(!$("anaViews"))return;const ev=getAnalytics().events||[],views=ev.filter(x=>x.type==="page_view"),clicks=ev.filter(x=>x.type==="click");$("anaViews").textContent=views.length.toLocaleString();$("anaClicks").textContent=clicks.length.toLocaleString();$("anaSessions").textContent=new Set(ev.map(x=>x.session).filter(Boolean)).size.toLocaleString();
  function counts(arr,key){const m={};arr.forEach(x=>m[x[key]||"-"]=(m[x[key]||"-"]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10)}
  $("anaPages").innerHTML=counts(views,"page").map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join("")||"<p>아직 기록이 없습니다.</p>";
  $("anaActions").innerHTML=counts(clicks,"label").map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join("")||"<p>아직 클릭 기록이 없습니다.</p>";
}
initTracking();
if(page==="home")initMoneyMapHome();
if(page==="goals")initGoalManager();
if(page==="analytics")initAnalyticsPage();


/* ===== V0.8 FUNCTIONAL CALCULATORS + PRODUCT UX ===== */
function monthlyIncome(){return state.salaryMode==='net'?state.manualNetMonthly:estimateSalary().takeHome;}
function payment(principal,annualRate,months){
  principal=Math.max(0,principal);months=Math.max(1,months);const r=Math.max(0,annualRate)/100/12;
  return r?principal*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1):principal/months;
}
function burdenText(ratio,kind='지출'){
  if(!isFinite(ratio))return '월급을 입력하면 부담도를 계산할 수 있습니다.';
  if(ratio<=.15)return `🟢 ${kind} 부담이 낮은 편입니다.`;
  if(ratio<=.25)return `🟡 ${kind} 부담을 관리할 수 있는 수준입니다.`;
  if(ratio<=.35)return `🟠 ${kind} 비중이 높은 편입니다. 다른 고정비도 함께 확인하세요.`;
  return `🔴 ${kind}이 월급의 상당 부분을 차지합니다. 보수적으로 검토하세요.`;
}
function initCalculatorHub(){
  if(!$('goalCurrent'))return;
  const income=Math.max(0,monthlyIncome());
  $('calcProfileIncome').textContent=`월 실수령 ${krw(income)}`;
  $('calcProfileNote').textContent=state.onboarded?'내 MONEY MAP에 저장된 숫자를 불러왔습니다.':'아직 내 숫자를 저장하지 않았습니다. 예시값으로 계산할 수 있습니다.';
  $('goalCurrent').value=comma(Math.max(0,state.assets-state.debt));$('goalMonthly').value=comma(state.monthlySaving||700000);$('goalTarget').value=comma(state.targetAssets||100000000);
  $('carIncome').value=comma(income||3000000);$('loanIncome').value=comma(income||3000000);
  function renderGoal(){
    const cur=num($('goalCurrent').value),m=num($('goalMonthly').value),target=num($('goalTarget').value);
    let months=m>0?Math.max(0,(target-cur)/m):Infinity;
    $('goalCalcTime').textContent=isFinite(months)?formatPeriod(months):'계산 불가';
    if(isFinite(months)){const d=new Date();d.setMonth(d.getMonth()+Math.ceil(months));$('goalCalcDate').textContent=`예상 ${d.getFullYear()}년 ${d.getMonth()+1}월 달성`;}
    else $('goalCalcDate').textContent='월 저축액을 입력해 주세요.';
    const pct=target?cur/target*100:0;$('goalCalcInsight').textContent=`현재 목표의 ${Math.max(0,pct).toFixed(1)}% 지점입니다. 월 저축액을 10만원 늘리면 목표일이 얼마나 당겨지는지도 시뮬레이션에서 비교할 수 있습니다.`;
  }
  function renderCar(){
    const price=num($('carPrice').value),down=Math.min(price,num($('carDown').value)),months=+$('carMonths').value||60,rate=+$('carRate').value||0,running=num($('carRunning').value),inc=num($('carIncome').value);
    const loan=Math.max(0,price-down),pay=payment(loan,rate,months),total=pay+running,ratio=inc?total/inc:Infinity;
    $('carMonthlyTotal').textContent=krw(total);$('carPayment').textContent=`할부 ${krw(pay)}`;$('carBurdenBar').style.width=Math.min(100,ratio*100)+'%';$('carVerdict').textContent=burdenText(ratio,'자동차 비용');$('carRemaining').textContent=inc?`자동차 비용 후 월 ${krw(Math.max(0,inc-total))} 남음 · 월급의 ${(ratio*100).toFixed(1)}%`:'월급을 입력해 주세요.';
  }
  function renderLoan(){
    const principal=num($('loanPrincipal').value),rate=+$('loanRate').value||0,years=+$('loanYears').value||30,months=years*12,inc=num($('loanIncome').value),pay=payment(principal,rate,months),total=pay*months,interest=Math.max(0,total-principal),ratio=inc?pay/inc:Infinity;
    $('loanMonthly').textContent=krw(pay);$('loanTotalInterest').textContent=`총 이자 약 ${krw(interest)} · 원리금균등 단순 계산`;$('loanBurdenBar').style.width=Math.min(100,ratio*100)+'%';$('loanVerdict').textContent=burdenText(ratio,'대출 상환액');$('loanRemaining').textContent=inc?`상환 후 월 ${krw(Math.max(0,inc-pay))} 남음 · 월급의 ${(ratio*100).toFixed(1)}%`:'월급을 입력해 주세요.';
  }
  ['goalCurrent','goalMonthly','goalTarget'].forEach(id=>$(id).addEventListener('input',renderGoal));
  ['carPrice','carDown','carMonths','carRate','carRunning','carIncome'].forEach(id=>$(id).addEventListener('input',renderCar));
  ['loanPrincipal','loanRate','loanYears','loanIncome'].forEach(id=>$(id).addEventListener('input',renderLoan));
  document.querySelectorAll('#calcFilters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#calcFilters button').forEach(x=>x.classList.toggle('active',x===b));const f=b.dataset.filter;document.querySelectorAll('.live-calculator').forEach(c=>c.classList.toggle('filtered-out',f!=='all'&&c.dataset.category!==f));}));
  $('saveGoalFromCalc').addEventListener('click',()=>{const g={id:'g'+Date.now(),name:'1억 만들기',target:num($('goalTarget').value),current:num($('goalCurrent').value),monthly:num($('goalMonthly').value),primary:false};state.goals=[...(state.goals||[]),g];save();$('saveGoalFromCalc').textContent='내 목표에 저장됨 ✓';trackEvent('action','calculator_goal_saved');});
  renderGoal();renderCar();renderLoan();
}
function initQuickHome(){if(!$('quickMonthlyIncome'))return;const inc=Math.max(0,monthlyIncome());$('quickMonthlyIncome').textContent=krw(inc);$('quickIncomeHint').textContent=state.onboarded?'내 MONEY MAP에 저장된 월급 기준입니다.':'아직 내 숫자를 입력하지 않아 예시 월급을 표시합니다.';}
function initSimPresets(){
  if(page!=='simulator')return;
  document.querySelectorAll('[data-sim-preset]').forEach(b=>b.addEventListener('click',()=>{const p=b.dataset.simPreset;if(p==='save30'){$('simSave').value=300000;$('simIncome').value=0;$('simCut').value=0}if(p==='income50'){$('simSave').value=0;$('simIncome').value=500000;$('simCut').value=0}if(p==='cut20'){$('simSave').value=0;$('simIncome').value=0;$('simCut').value=200000}if(p==='reset'){$('simSave').value=0;$('simIncome').value=0;$('simCut').value=0};['simSave','simIncome','simCut'].forEach(id=>$(id).dispatchEvent(new Event('input')))}));
  const update=()=>{const months=monthsTo(resolvedSimDate()),base=Math.max(0,state.assets-state.debt),saving=Math.max(0,state.monthlySaving),extra=(+$('simSave').value||0)+(+$('simIncome').value||0)+(+$('simCut').value||0),before=base+saving*months,after=base+(saving+extra)*months;$('simBaselineFuture').textContent=krw(before);$('simChangedFuture').textContent=krw(after);const goal=(state.goals||[]).find(g=>g.primary)||{target:state.targetAssets,current:base,monthly:saving,name:state.goalName||'목표'};const oldM=goal.monthly>0?Math.max(0,(goal.target-goal.current)/goal.monthly):Infinity,newM=(goal.monthly+extra)>0?Math.max(0,(goal.target-goal.current)/(goal.monthly+extra)):Infinity;const diff=isFinite(oldM)&&isFinite(newM)?Math.max(0,oldM-newM):0;$('simGoalImpact').textContent=extra?`${goal.name} 기준으로 단순 계산하면 목표가 약 ${formatPeriod(diff)} 빨라질 수 있습니다.`:'슬라이더를 움직이면 내 대표 목표가 얼마나 빨라지는지 보여드립니다.';};
  ['simDate','simYears','simMonths','simSave','simIncome','simCut'].forEach(id=>$(id)?.addEventListener('input',update));setTimeout(update,0);
}
function initAnalyticsActions(){
 if(page!=='analytics')return;
 $('resetAnalytics')?.addEventListener('click',()=>{if(confirm('이 브라우저의 테스트 분석 기록을 초기화할까요?')){localStorage.removeItem(analyticsKey);location.reload()}});
 $('exportAnalytics')?.addEventListener('click',()=>{const ev=getAnalytics().events||[];const rows=[['timestamp','type','label','page','session'],...ev.map(e=>[new Date(e.ts).toISOString(),e.type,e.label,e.page,e.session])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='wolgeup-analytics.csv';a.click();URL.revokeObjectURL(url)});
}
if(page==='calculators')initCalculatorHub();
if(page==='home')initQuickHome();
initSimPresets();initAnalyticsActions();

/* ===== V0.9 AI LIVING PLAN / BUDGET ===== */
const budgetStoreKey='wolgeup_budget_v09';
const budgetDefaults={income:2750000,payday:10,mealAllowance:200000,workdays:21,housing:150000,carPayment:600000,fuel:150000,carReserve:70000,lunchUnit:8000,dinnerUnit:10000,weekendFood:70000,mealRollover:true,date:300000,beauty:40000,supplies:40000,clothes:30000,emergency:122000,otherFixed:0,debtBalance:1500000,debtPayment:500000,goalName:'전세보증금',goalTarget:30000000,goalCurrent:0,goalSaving:1000000,futureHousing:700000,futureCarPayment:0};
function loadBudget(){try{return {...budgetDefaults,...JSON.parse(localStorage.getItem(budgetStoreKey)||'{}')}}catch(e){return {...budgetDefaults}}}
function saveBudgetData(b){localStorage.setItem(budgetStoreKey,JSON.stringify(b))}
function budgetVal(id){return num($(id)?.value)}
function budgetDataFromForm(){return {income:budgetVal('bIncome'),payday:Math.min(31,Math.max(1,+$('bPayday').value||10)),mealAllowance:budgetVal('bMealAllowance'),workdays:Math.max(0,+$('bWorkdays').value||0),housing:budgetVal('bHousing'),carPayment:budgetVal('bCarPayment'),fuel:budgetVal('bFuel'),carReserve:budgetVal('bCarReserve'),lunchUnit:budgetVal('bLunchUnit'),dinnerUnit:budgetVal('bDinnerUnit'),weekendFood:budgetVal('bWeekendFood'),mealRollover:$('bMealRollover').checked,date:budgetVal('bDate'),beauty:budgetVal('bBeauty'),supplies:budgetVal('bSupplies'),clothes:budgetVal('bClothes'),emergency:budgetVal('bEmergency'),otherFixed:budgetVal('bOtherFixed'),debtBalance:budgetVal('bDebtBalance'),debtPayment:budgetVal('bDebtPayment'),goalName:$('bGoalName').value.trim()||'목표저축',goalTarget:budgetVal('bGoalTarget'),goalCurrent:budgetVal('bGoalCurrent'),goalSaving:budgetVal('bGoalSaving'),futureHousing:budgetVal('bFutureHousing'),futureCarPayment:budgetVal('bFutureCarPayment')};}
function budgetCalc(b){const lunch=b.lunchUnit*b.workdays,mealRemain=Math.max(0,b.mealAllowance-lunch),dinnerGross=b.dinnerUnit*b.workdays,dinnerOffset=b.mealRollover?Math.min(mealRemain,dinnerGross):0,dinnerNet=Math.max(0,dinnerGross-dinnerOffset);const categories=[['주거/관리비',b.housing,'필수'],['자동차 할부',b.carPayment,'필수'],['유류비',b.fuel,'필수'],['차량 유지 적립',b.carReserve,'적립'],['평일 저녁 추가분',dinnerNet,'생활'],['주말 개인 식비',b.weekendFood,'생활'],['데이트',b.date,'생활'],['미용',b.beauty,'생활'],['생필품',b.supplies,'생활'],['의류 적립',b.clothes,'적립'],['비상금·경조사',b.emergency,'적립'],['통신·보험 등',b.otherFixed,'필수'],['소비성 부채 상환',Math.min(b.debtPayment,b.debtBalance),'부채']];const planned=categories.reduce((s,x)=>s+x[1],0);const debtPay=Math.min(b.debtPayment,b.debtBalance);const normalSaving=b.debtBalance>0?Math.max(0,Math.min(b.goalSaving,b.income-planned)):Math.max(0,Math.min(b.goalSaving,b.income-planned));const free=Math.max(0,b.income-planned-normalSaving);const deficit=Math.min(0,b.income-planned-normalSaving);return {lunch,mealRemain,dinnerGross,dinnerOffset,dinnerNet,categories,planned,debtPay,saving:normalSaving,free,deficit};}
function budgetCycle(payday){const now=new Date(),y=now.getFullYear(),m=now.getMonth(),d=now.getDate();let start,end;if(d>=payday){start=new Date(y,m,payday);end=new Date(y,m+1,payday-1)}else{start=new Date(y,m-1,payday);end=new Date(y,m,payday-1)}const fmt=x=>`${x.getMonth()+1}월 ${x.getDate()}일`;return `${fmt(start)} ~ ${fmt(end)}`}
function renderBudget(){if(page!=='budget'||!$('bIncome'))return;const b=budgetDataFromForm(),c=budgetCalc(b);$('kpiIncome').textContent=krw(b.income);$('kpiPlanned').textContent=krw(c.planned);$('kpiPlannedPct').textContent=b.income?`${(c.planned/b.income*100).toFixed(1)}% 사용 예정`:'월급 입력 필요';$('kpiSaving').textContent=krw(c.saving);$('kpiSavingPct').textContent=b.income?`저축률 ${(c.saving/b.income*100).toFixed(1)}%`:'저축률 -';$('kpiFree').textContent=krw(c.free);$('kpiFreeHint').textContent=c.deficit<0?`예산 초과 ${krw(-c.deficit)}`:'예정 지출·저축 반영';$('budgetTotalPlanned').textContent=krw(c.planned);$('budgetCycleTitle').textContent=budgetCycle(b.payday);$('budgetCycleSub').textContent=`매월 ${b.payday}일 월급 기준 · 브라우저에 저장된 계획을 사용합니다.`;$('mealCalcText').innerHTML=`점심 ${krw(b.lunchUnit)} × ${b.workdays}일 = <b>${krw(c.lunch)}</b><br>회사 식대 잔액 <b>${krw(c.mealRemain)}</b> · 평일 저녁 총 ${krw(c.dinnerGross)} → 실제 추가 부담 <b>${krw(c.dinnerNet)}</b>`;$('budgetCategoryRows').innerHTML=c.categories.map(([n,v,t])=>`<div class="budget-category-row"><span>${n}</span><small>${t}</small><strong>${krw(v)}</strong></div>`).join('');
  const debtLeft=Math.max(0,b.debtBalance-c.debtPay),essential=c.categories.filter(x=>['필수','생활'].includes(x[2])).reduce((s,x)=>s+x[1],0),priority=[['01','필수 고정비',krw(essential)+' 확보'],['02','소비성 부채',b.debtBalance?`${krw(c.debtPay)} 상환 · 잔액 ${krw(debtLeft)}`:'정리 완료'],['03','비정기 지출 적립',`차량·의류·비상금 ${krw(b.carReserve+b.clothes+b.emergency)}`],['04',b.goalName,`${krw(c.saving)} 저축 목표`]];$('budgetPriorityList').innerHTML=priority.map(x=>`<div class="priority-item"><i>${x[0]}</i><div><b>${x[1]}</b><small>${x[2]}</small></div></div>`).join('');
  let level=5,stage='안정적 저축 시작',guide='현재 예산에서는 목표저축을 유지할 수 있습니다.';if(c.deficit<0){level=1;stage='적자 상태';guide=`현재 계획은 월급보다 ${krw(-c.deficit)} 많습니다. 부채상환·생활비·저축 목표를 동시에 낮춰야 합니다.`}else if(b.debtBalance>0){level=2;stage='소비성 부채 정리 중';const months=c.debtPay?Math.ceil(b.debtBalance/c.debtPay):Infinity;guide=`현재 소비성 부채 ${krw(b.debtBalance)}가 있습니다. 이번 달 ${krw(c.debtPay)}씩 상환하면 ${isFinite(months)?`약 ${months}개월`:'상환계획 필요'} 후 정리할 수 있습니다. 초기에는 저축보다 부채 정리를 우선해도 됩니다.`}else if(b.emergency<100000){level=4;stage='비상금 확보 중';guide='부채는 정리됐지만 비상금 적립이 낮습니다. 최소한의 생활 버퍼를 만든 뒤 목표저축을 늘려보세요.'}else if(b.goalCurrent>=b.goalTarget&&b.goalTarget>0){level=7;stage='투자/자산증식 단계';guide='대표 목표를 달성했습니다. 다음 목표 또는 장기 투자 계획으로 확장할 수 있습니다.'}else if(b.goalCurrent>0){level=6;stage='목표자산 형성 중';guide=`${b.goalName} 목표를 향해 자산을 쌓는 단계입니다.`}$('budgetStageBadge').textContent=`LEVEL ${level}`;$('budgetStageText').textContent=stage;$('budgetGuidance').textContent=guide;
  const remainingGoal=Math.max(0,b.goalTarget-b.goalCurrent),goalMonths=c.saving?Math.ceil(remainingGoal/c.saving):Infinity;$('budgetRoadmap').innerHTML=[['1','카드·소비성 부채 정리',b.debtBalance?`${krw(b.debtBalance)} 남음`:'완료',b.debtBalance?'active':'done'],['2','비상금 버퍼 만들기','생활비 1~2개월치부터',''],['3',`${b.goalName} 저축`,isFinite(goalMonths)?`현재 속도 약 ${goalMonths}개월`:'월 저축액 설정',''],['4','투자·자산증식','목표자금과 분리해 장기 운용','']].map(x=>`<article class="roadmap-step ${x[3]}"><span>${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p><strong>${x[0]==='3'&&b.goalTarget?`${Math.min(100,b.goalCurrent/b.goalTarget*100).toFixed(1)}%`:''}</strong></article>`).join('');
  const hdiff=b.futureHousing-b.housing;$('futureHousingDiff').textContent=(hdiff>=0?'+':'')+krw(hdiff);$('futureHousingText').textContent=hdiff>0?`독립하면 현재보다 월 ${krw(hdiff)} 더 필요합니다. 동일한 소비를 유지하면 저축 여력도 그만큼 줄어듭니다.`:'현재보다 주거비가 줄어드는 시나리오입니다.';const cdiff=b.carPayment-b.futureCarPayment;$('futureCarDiff').textContent=(cdiff>=0?'+':'')+krw(cdiff);$('futureCarText').textContent=cdiff>0?`할부가 끝나면 월 ${krw(cdiff)}를 전세보증금이나 다른 목표로 돌릴 수 있습니다.`:'자동차 비용 변화가 없습니다.';
}
function fillBudgetForm(b){const map={bIncome:'income',bPayday:'payday',bMealAllowance:'mealAllowance',bWorkdays:'workdays',bHousing:'housing',bCarPayment:'carPayment',bFuel:'fuel',bCarReserve:'carReserve',bLunchUnit:'lunchUnit',bDinnerUnit:'dinnerUnit',bWeekendFood:'weekendFood',bDate:'date',bBeauty:'beauty',bSupplies:'supplies',bClothes:'clothes',bEmergency:'emergency',bOtherFixed:'otherFixed',bDebtBalance:'debtBalance',bDebtPayment:'debtPayment',bGoalName:'goalName',bGoalTarget:'goalTarget',bGoalCurrent:'goalCurrent',bGoalSaving:'goalSaving',bFutureHousing:'futureHousing',bFutureCarPayment:'futureCarPayment'};Object.entries(map).forEach(([id,k])=>{if(!$(id))return;$(id).value=typeof b[k]==='number'?comma(b[k]):b[k]});$('bMealRollover').checked=!!b.mealRollover}
function initBudgetPlanner(){if(page!=='budget'||!$('bIncome'))return;const saved=loadBudget();fillBudgetForm(saved);bindCommaInputs();document.querySelectorAll('#budgetSetup input,#budgetSetup select,#bFutureHousing,#bFutureCarPayment').forEach(el=>el.addEventListener('input',renderBudget));$('bMealRollover').addEventListener('change',renderBudget);$('saveBudgetPlan').addEventListener('click',()=>{const b=budgetDataFromForm();saveBudgetData(b);$('saveBudgetPlan').textContent='저장됨 ✓';setTimeout(()=>$('saveBudgetPlan').textContent='내 생활비 플랜 저장',1400);trackEvent('action','budget_plan_saved');renderBudget()});$('resetBudgetDemo').addEventListener('click',()=>{if(confirm('현재 입력값을 월급계산소 예시 플랜으로 초기화할까요?')){fillBudgetForm(budgetDefaults);saveBudgetData(budgetDefaults);renderBudget()}});renderBudget()}
initBudgetPlanner();
