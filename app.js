/* BICSI Technical Workstation
   Main application script
   Controls state, quiz logic, flashcards, settings, storage, and UI rendering
*/

/* =========================
   Error Banner
   ========================= */
function showErr(msg){
  const box = document.getElementById("err");
  box.style.display = "block";
  box.textContent = msg;
}
window.addEventListener("error", (e)=>showErr("JS Error: " + (e.message||e.error||e)));
window.addEventListener("unhandledrejection", (e)=>showErr("Promise Error: " + (e.reason?.message||e.reason||e)));

/* =========================
   Flashcards + Wording
   ========================= */
const FLASHCARDS = [
  { front:"UTP pair untwist at termination", back:"13 mm (0.5 in) maximum" },
  { front:"Conduit fill (typical max w/o derating)", back:"40%" },
  { front:"UTP max pull tension", back:"25 lbf (typical best-practice limit)" },
  { front:"Fiber mating sequence", back:"Inspect → Clean → Inspect → Mate" },
  { front:"Why keep bonding conductors short/straight?", back:"Minimize impedance; maintain effective fault/surge performance" },
  { front:"Tray overfill primary concern", back:"Limits future expansion; reduces accessibility; increases mechanical stress" },
  { front:"Redundant pathways separation", back:"Maintain resiliency; avoid single point of failure" },
  { front:"Firestopping purpose", back:"Maintain rated fire-resistance by restoring compartmentalization (listed assembly)" },
  { front:"Multi-mode operating frequencies", back:"850 nm and 1300 nm"},
  { front:"Single-mode operating frequencies", back:" 1310 nm and 1550 nm"},
  { front:"Minimum inside bend radius for 4-strand optical cable at rest", back:"25mm (1 in)"},
  { front:"Connection process that uses a pre-polished fiber stub with index-matching gel", back:"Cleave and Secure connectors"},
  { front:"Fusion splice loss will be", back:"0.1dB or less"},
  { front:"Maximum length of a permanent link", back:"295 feet, 90 meters"},
  { front:"Maximum length of a channel", back:"328 feet, 100 meters"},
  { front:"Typical spacing of J-hooks for a pull", back:"Approximately 4-5 ft apart"}
];

const WORDING_PROMPTS = [
  { field:"The rack isn't grounded.", target:"Reword this to closely match BICSI technician language" },
  { field:"There's too much bend in that fiber.", target:"Reword this to closely match BICSI technician language" },
  { field:"The tray's too full.", target:"Reword this to closely match BICSI technician language" },
  { field:"They added cable without fixing the firestop.", target:"Reword this to closely match BICSI technician language" },
  { field:"The bonding wire's too long.", target:"Reword this to closely match BICSI technician language" }
];

/* =========================
   State
   ========================= */
const state = loadState() ?? {
  theme:"light", font:16, mode:"daily", selection:"adaptive",
  week:1, session:"A",
  scores:{ concept:0, hierarchy:0, wording:0 },
  lastResult:null
};

function rankFromTotal(t){
  if (t>=28) return "EXAM DOMINANT";
  if (t>=26) return "TECHNICIAN READY";
  if (t>=23) return "JUNIOR TECH";
  if (t>=18) return "SENIOR INSTALLER";
  return "INSTALLER";
}

/* =========================
   Utilities
   ========================= */
function shuffleArray(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function shuffleQuestionChoices(q){
  const choices=[...q.choices];
  const correct=choices[q.answer];
  shuffleArray(choices);
  return {...q, choices, answer:choices.indexOf(correct)};
}
function readPackJson(id){
  const el=document.getElementById(id);
  if(!el) return [];
  try{ const a=JSON.parse(el.textContent); return Array.isArray(a)?a:[]; }catch{ return []; }
}

    function normalizeQuestion(q){
  if(!q || typeof q !== "object") return null;
  if(!q.id || !q.domain || !q.q) return null;

  const qType = q.type || "multiple_choice";

  const base = {
    id: String(q.id),
    domain: String(q.domain),
    difficulty: Number(q.difficulty ?? 2),
    style: String(q.style ?? "MOST"),
    q: String(q.q),
    ref: String(q.ref ?? ""),
    hint: String(q.hint ?? ""),
    rubric: q.rubric ?? {concept:1, hierarchy:1, wording:1}
  };

  if(qType === "true_false"){
    if(typeof q.answer !== "boolean") return null;

    return {
      ...base,
      type: "true_false",
      choices: ["True", "False"],
      answer: q.answer ? 0 : 1
    };
  }

  if(!Array.isArray(q.choices) || q.choices.length !== 4) return null;
  if(typeof q.answer !== "number" || q.answer < 0 || q.answer > 3) return null;

  return {
    ...base,
    type: "multiple_choice",
    choices: q.choices.map(String),
    answer: q.answer
  };
}


/* =========================
   Shared Question Bank
   ========================= */
let sharedBankCache = [];

async function loadSharedBank(){
  try{
    const res = await fetch("question-bank.json", { cache:"no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.json();
    if(!Array.isArray(arr)) throw new Error("question-bank.json must be an array.");
    sharedBankCache = arr.map(normalizeQuestion).filter(Boolean);
  }catch(err){
    sharedBankCache = [];
    showErr(`Question bank load failed: ${err.message || err}`);
  }
  resetRotation();
  updateBankSizeUI();
}

function getBank(){
  return [...sharedBankCache];
}
function setBank(arr){
  sharedBankCache = (Array.isArray(arr) ? arr : []).map(normalizeQuestion).filter(Boolean);
  resetRotation();
  updateBankSizeUI();
}
function mergeIntoBank(){
  return { added:0, replaced:0, rejected:0, total:getBank().length };
}
function resetRotation(){ localStorage.removeItem(QB_ROT_KEY); }


/* =========================
   Rotation
   ========================= */
function getNextRotatingSet(count=10){
  const bank=getBank();
  let rot=loadRot();
  if(!rot||!Array.isArray(rot.order)||rot.order.length!==bank.length||typeof rot.idx!=="number"){
    rot={order:[...Array(bank.length).keys()],idx:0};
    shuffleArray(rot.order);
  }
  const set=[];
  for(let i=0;i<count;i++){ set.push(bank[rot.order[rot.idx%rot.order.length]]); rot.idx++; }
  saveRot(rot);
  return set;
}

/* =========================
   Domain Stats
   ========================= */
function domainAccuracy(domain,stats){ const s=stats[domain]; if(!s||!s.seen) return 0.65; return Math.max(0,Math.min(1,s.correct/s.seen)); }
function weightedPick(items,weightFn){
  const weights=items.map(x=>Math.max(0.01,weightFn(x)));
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<items.length;i++){ r-=weights[i]; if(r<=0) return items[i]; }
  return items[items.length-1];
}
function getAdaptiveSet(count=10){
  const bank=getBank(),stats=loadStats(),misses=loadMisses(),picked=new Set(),set=[];
  const weightFn=(q)=>{
    const acc=domainAccuracy(q.domain,stats);
    const weakness=(1.05-acc);
    const missBoost=misses[q.id]?.misses?(1+Math.min(3,misses[q.id].misses*0.5)):1;
    return weakness*missBoost;
  };
  let tries=0;
  while(set.length<count&&tries<1000){ const q=weightedPick(bank,weightFn); if(!picked.has(q.id)){picked.add(q.id);set.push(q);} tries++; }
  for(const q of bank){ if(set.length>=count) break; if(!picked.has(q.id)){picked.add(q.id);set.push(q);} }
  shuffleArray(set);
  return set.slice(0,count);
}

/* =========================
   Review Misses Set
   ========================= */
function weightedPickIds(ids,missesMap){
  const weights=ids.map(id=>(missesMap[id]?.misses??0)+1);
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<ids.length;i++){r-=weights[i];if(r<=0) return ids[i];}
  return ids[ids.length-1];
}
function buildReviewSet(totalCount=10,missRatio=0.7){
  const bank=getBank(),bankById=new Map(bank.map(q=>[q.id,q]));
  const missesMap=loadMisses(),missIds=Object.keys(missesMap).filter(id=>bankById.has(id));
  if(missIds.length===0) return state.selection==="adaptive"?getAdaptiveSet(totalCount):getNextRotatingSet(totalCount);
  const missCountTarget=Math.min(totalCount,Math.max(1,Math.round(totalCount*missRatio)));
  const set=[],picked=new Set();
  let tries=0;
  while(set.length<missCountTarget&&tries<400){ const id=weightedPickIds(missIds,missesMap); if(!picked.has(id)){picked.add(id);set.push(bankById.get(id));} tries++; }
  const fresh=state.selection==="adaptive"?getAdaptiveSet(totalCount*2):getNextRotatingSet(totalCount*2);
  for(const q of fresh){ if(set.length>=totalCount) break; if(!picked.has(q.id)){picked.add(q.id);set.push(q);} }
  for(const q of bank){ if(set.length>=totalCount) break; if(!picked.has(q.id)){picked.add(q.id);set.push(q);} }
  shuffleArray(set);
  return set.slice(0,totalCount);
}

/* =========================
   Grading
   ========================= */
function applyMisses(round,pickedAnswers){
  const m=loadMisses();
  round.forEach((q,idx)=>{ if(pickedAnswers[idx]!==q.answer){ if(!m[q.id]) m[q.id]={misses:0,lastTs:0}; m[q.id].misses+=1; m[q.id].lastTs=Date.now(); } });
  saveMisses(m); updateMissCountUI();
}
function applyDomainStats(round,pickedAnswers){
  const s=loadStats();
  round.forEach((q,idx)=>{ if(!s[q.domain]) s[q.domain]={seen:0,correct:0}; s[q.domain].seen+=1; if(pickedAnswers[idx]===q.answer) s[q.domain].correct+=1; });
  saveStats(s); updateStatsUI();
}

/* =========================
   Daily Tracking
   ========================= */
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dailyState(){
  const d=loadDaily(),k=todayKey();
  if(!d[k]) d[k]={warmup:false,pressure:false,review:false,wording:false};
  saveDaily(d); return d[k];
}
function setDailyStep(step,val=true){
  const all=loadDaily(),k=todayKey();
  if(!all[k]) all[k]={warmup:false,pressure:false,review:false,wording:false};
  all[k][step]=val; saveDaily(all); updateStreakUI();
}
function computeStreak(){
  const all=loadDaily(),today=new Date();
  let streak=0;
  for(let i=0;i<3650;i++){
    const d=new Date(today); d.setDate(today.getDate()-i);
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const s=all[k];
    if(s&&s.warmup&&s.pressure&&s.review&&s.wording) streak++; else break;
  }
  return streak;
}

/* =========================
   UI Helpers
   ========================= */
function updateBankSizeUI(){
  const n=String(getBank().length);
  const e1=document.getElementById("bankSize"); if(e1) e1.textContent=n;
  const e2=document.getElementById("bankSizeTag"); if(e2) e2.textContent=n;
  const e3=document.getElementById("statusBankSize"); if(e3) e3.textContent=n;
}
function updateMissCountUI(){
  const n=String(missesCount());
  const e1=document.getElementById("missCount"); if(e1) e1.textContent=n;
  const e2=document.getElementById("missCountTag"); if(e2) e2.textContent=n;
}
function updateStreakUI(){
  const n=String(computeStreak());
  const e1=document.getElementById("streak"); if(e1) e1.textContent=n;
  const e2=document.getElementById("streakTag"); if(e2) e2.textContent=n;
}
function updateStatsUI(){
  const box=document.getElementById("domainStatsBox");
  if(!box) return;
  const stats=loadStats(),domains=Object.keys(stats).sort();
  if(domains.length===0){ box.innerHTML=`<div class="small">No stats yet.</div>`; return; }
  box.innerHTML=domains.map(d=>{
    const seen=stats[d].seen||0,correct=stats[d].correct||0,acc=seen?Math.round((correct/seen)*100):0;
    return `<div style="display:flex;justify-content:space-between;gap:4px;margin:3px 0;font-family:var(--mono);font-size:10px">
      <span>${d}</span><span class="pill">${correct}/${seen} ${acc}%</span>
    </div>`;
  }).join("");
}
function setScoreUI(){
  const c=state.scores.concept,h=state.scores.hierarchy,w=state.scores.wording;
  document.getElementById("scoreConcept").textContent=c;
  document.getElementById("scoreHierarchy").textContent=h;
  document.getElementById("scoreWording").textContent=w;
  const total=c+h+w;
  document.getElementById("scoreTotal").textContent=`${total}/30`;
  document.getElementById("rank").textContent=rankFromTotal(total);
  const colorize=(el,v)=>{ el.classList.remove("good","warn","bad"); el.classList.add(v>=9?"good":v>=7?"warn":"bad"); };
  colorize(document.getElementById("scoreConcept"),c);
  colorize(document.getElementById("scoreHierarchy"),h);
  colorize(document.getElementById("scoreWording"),w);
}
function titleFromMode(m){
  return {daily:"Daily Training",pressure:"Pressure Round",review:"Review Misses",flashcards:"Flashcards",wording:"Wording Lab",bank:"Question Bank"}[m]||"Daily Training";
}
function setThemeFont(){
  if(!["light","dark","win95","ibm"].includes(state.theme)) state.theme="light";
  document.body.dataset.theme=state.theme;
  document.documentElement.style.setProperty("--base",state.font+"px");
  const themeSelect=document.getElementById("themeSelect");
  const fontSelect=document.getElementById("fontSelect");
  const selectionSelect=document.getElementById("selectionSelect");
  if(themeSelect) themeSelect.value=state.theme;
  if(fontSelect) fontSelect.value=String(state.font);
  if(selectionSelect) selectionSelect.value=state.selection;
}

/* =========================
   Timer
   ========================= */
let timerInterval=null;
function startTimer(seconds){
  stopTimer();
  let remaining=seconds;
  const el=document.getElementById("timer");
  const tick=()=>{
    const m=String(Math.floor(remaining/60)).padStart(2,"0");
    const s=String(remaining%60).padStart(2,"0");
    el.textContent=`${m}:${s}`;
    if(remaining<=0){stopTimer();el.textContent="00:00";}
    remaining--;
  };
  tick(); timerInterval=setInterval(tick,1000);
}
function stopTimer(){ if(timerInterval){clearInterval(timerInterval);timerInterval=null;} }

/* =========================
   Render
   ========================= */
function getFreshSet(count=10){ return state.selection==="adaptive"?getAdaptiveSet(count):getNextRotatingSet(count); }

function render(){
  setThemeFont();
  setScoreUI();
  updateBankSizeUI();
  updateMissCountUI();
  updateStreakUI();
  updateStatsUI();
  updateWorkbenchStatus();

  const main=document.getElementById("main");
  const mainTitle=document.getElementById("mainTitle");
  main.innerHTML="";
  mainTitle.textContent=titleFromMode(state.mode);
  stopTimer();
  document.getElementById("timer").textContent="—";

  if(state.mode==="daily")      renderDaily(main);
  if(state.mode==="pressure")   renderQuiz(main,{mode:"pressure"});
  if(state.mode==="review")     renderQuiz(main,{mode:"review"});
  if(state.mode==="flashcards") renderFlashcards(main);
  if(state.mode==="wording")    renderWording(main);
  if(state.mode==="bank")       renderBankManager(main);
}

/* ===== Daily ===== */
function renderDaily(root){
  const d=dailyState();
  const box=document.createElement("div");
  box.className="q";
  box.innerHTML=`<strong>Daily Run (10–15 min)</strong><div class="small" style="margin-top:6px">Finish all 4 steps to keep your streak alive.</div>`;
  const steps=document.createElement("div");
  steps.style.marginTop="10px";
  function stepRow(label,key,actionText){
    const done=d[key];
    const row=document.createElement("div");
    row.className="mini"; row.style.marginBottom="10px";
    row.innerHTML=`<div class="row" style="justify-content:space-between;gap:10px"><div><div class="mono"><b>${done?"✅":"⬜"} ${label}</b></div><div class="small">${actionText}</div></div><button class="primary" id="go_${key}">${done?"Redo":"Start"}</button></div>`;
    return row;
  }
  const warm=stepRow("Warmup","warmup","3 quick flashcards (tap to reveal)");
  const press=stepRow("Pressure Round","pressure","10 questions (Adaptive/Rotating + shuffled answers)");
  const rev=stepRow("Review Misses","review","10 questions (~70% misses if available)");
  const word=stepRow("Wording Lab","wording","Rewrite 2 prompts using power phrases");
  steps.append(warm,press,rev,word);
  box.appendChild(steps);
  root.appendChild(box);
  warm.querySelector("#go_warmup").onclick=()=>{setDailyStep("warmup",true);renderDailyWarmup(root);};
  press.querySelector("#go_pressure").onclick=()=>{state.mode="pressure";saveState();render();};
  rev.querySelector("#go_review").onclick=()=>{state.mode="review";saveState();render();};
  word.querySelector("#go_wording").onclick=()=>{state.mode="wording";saveState();render();};
}

function renderDailyWarmup(root){
  root.innerHTML="";
  const top=document.createElement("div");
  top.className="row";
  top.innerHTML=`<span class="pill">Warmup • 3 cards</span><span class="pill">Tap to flip</span>`;
  let cards=[...FLASHCARDS]; shuffleArray(cards); cards=cards.slice(0,3);
  let index=0;
  const card=document.createElement("div");
  card.className="flash"; card.dataset.flipped="0";
  function draw(){
    const item=cards[index],flipped=card.dataset.flipped==="1";
    card.innerHTML=flipped?`<div class="front">Answer</div><div class="back">${item.back}</div>`:`<div class="front">${item.front}</div><div class="back">Tap to reveal</div>`;
  }
  card.onclick=()=>{card.dataset.flipped=(card.dataset.flipped==="1")?"0":"1";draw();};
  const nav=document.createElement("div"); nav.className="footerRow";
  const next=document.createElement("button"); next.className="primary"; next.textContent="Next Card";
  const done=document.createElement("button"); done.textContent="Done → Back to Daily";
  next.onclick=()=>{ index++; if(index>=cards.length){setDailyStep("warmup",true);okBeep();state.mode="daily";saveState();render();return;} card.dataset.flipped="0";draw(); };
  done.onclick=()=>{state.mode="daily";saveState();render();};
  nav.append(next,done);
  root.append(top,card,nav);
  draw();
}

/* ===== Quiz ===== */
function renderQuiz(root,opts){
  const isReview=opts.mode==="review";
  let round=isReview?buildReviewSet(10,0.7):getFreshSet(10);
  round=round.map(shuffleQuestionChoices);
shuffleArray(round);

const quizShell = document.createElement("div");
quizShell.className = "quiz-shell";

const quizControls = document.createElement("div");
quizControls.className = "quiz-controls";

const quizScroll = document.createElement("div");
quizScroll.className = "quiz-scroll";

const top=document.createElement("div"); 
top.className="row";
  top.innerHTML=isReview
    ?`<span class="pill">10 questions • Weak deck</span><span class="pill">answers randomized</span>`
    :`<span class="pill">10 questions • ${state.selection==="adaptive"?"Adaptive":"Rotating"}</span><span class="pill">answers randomized</span>`;
  const btnRow=document.createElement("div"); btnRow.className="footerRow";
  const startBtn=document.createElement("button"); startBtn.className="primary";
  startBtn.textContent=isReview?"Start Timed Review (6:00)":"Start Timed Round (6:00)";
  const newSetBtn=document.createElement("button"); newSetBtn.textContent="New Set";
  const gradeBtn=document.createElement("button"); gradeBtn.textContent="Grade Round";
  btnRow.append(startBtn,newSetBtn,gradeBtn);
    quizControls.append(top, btnRow);
  const form=document.createElement("div"); form.id="quiz";
  round.forEach((item,idx)=>{
    const q=document.createElement("div"); q.className="q";
      quizScroll.appendChild(form);
    q.innerHTML=`<strong>${idx+1}. <span class="mono">[${item.domain}]</span> ${item.q}</strong>`;
    const choices=document.createElement("div"); choices.className="choices";
    item.choices.forEach((c,cidx)=>{
      const line=document.createElement("label"); line.className="choice"; line.id=`q${idx}_c${cidx}`;
      line.innerHTML=`<input type="radio" name="q${idx}" value="${cidx}"><span>${c}</span>`;
      choices.appendChild(line);
    });
    q.appendChild(choices); form.appendChild(q);
  });
  const result=document.createElement("div"); result.className="small";
  const missPanel=document.createElement("div"); missPanel.style.marginTop="14px";
    quizScroll.append(result, missPanel);
  startBtn.onclick=()=>startTimer(6*60);
  newSetBtn.onclick=()=>{stopTimer();render();};
  gradeBtn.onclick=()=>{
    const picked=round.map((_,idx)=>{ const sel=root.querySelector(`input[name="q${idx}"]:checked`); return sel?Number(sel.value):null; });
    round.forEach((q,qIdx)=>{ q.choices.forEach((_,cIdx)=>{ const el=document.getElementById(`q${qIdx}_c${cIdx}`); if(el) el.classList.remove("correct","wrong"); }); });
    let correct=0,concept=0,hierarchy=0,wording=0;
    const missesOnly=[];
    round.forEach((q,idx)=>{
      const chosen=picked[idx],isCorrect=chosen===q.answer;
      if(isCorrect){correct++;concept+=q.rubric?.concept??0;hierarchy+=q.rubric?.hierarchy??0;wording+=q.rubric?.wording??0;}
      else missesOnly.push({idx:idx+1,q});
    });
    round.forEach((q,qIdx)=>{
      const chosen=picked[qIdx],correctChoice=q.answer;
      const correctEl=document.getElementById(`q${qIdx}_c${correctChoice}`); if(correctEl) correctEl.classList.add("correct");
      if(chosen!==null&&chosen!==undefined&&chosen!==correctChoice){ const chosenEl=document.getElementById(`q${qIdx}_c${chosen}`); if(chosenEl) chosenEl.classList.add("wrong"); }
    });
    applyMisses(round,picked);
    applyDomainStats(round,picked);
    const maxC=round.reduce((a,q)=>a+(q.rubric?.concept||0),0);
    const maxH=round.reduce((a,q)=>a+(q.rubric?.hierarchy||0),0);
    const maxW=round.reduce((a,q)=>a+(q.rubric?.wording||0),0);
    const c10=maxC?Math.round((concept/maxC)*10):0;
    const h10=maxH?Math.round((hierarchy/maxH)*10):0;
    const w10=maxW?Math.round((wording/maxW)*10):0;
    state.scores={concept:c10,hierarchy:h10,wording:w10};
    state.lastResult={correct,total:round.length,c10,h10,w10,ts:Date.now(),mode:opts.mode};
    saveState(); setScoreUI();
    if(opts.mode==="pressure") setDailyStep("pressure",true);
    if(opts.mode==="review") setDailyStep("review",true);
    if(missesOnly.length===0) okBeep(); else warnBeep();
    result.innerHTML=`<div style="margin-top:10px" class="mono">Result: ${correct}/${round.length} correct • Concept ${c10}/10 • Hierarchy ${h10}/10 • Wording ${w10}/10</div><div class="small" style="margin-top:6px">Green = correct answer • Red = your chosen wrong answer</div>`;
    missPanel.innerHTML="";
    const panel=document.createElement("div"); panel.className="q";
    panel.innerHTML=`<strong>Miss Breadcrumbs</strong><div class="small">No explanations—use these to find it in ITSIMM.</div>`;
    const list=document.createElement("div"); list.style.marginTop="10px";
    if(missesOnly.length===0){ const ok=document.createElement("div"); ok.className="mini"; ok.innerHTML=`<div class="mono">No misses. Clean round.</div>`; list.appendChild(ok); }
    else{
      missesOnly.forEach(m=>{
        const letter=String.fromCharCode(65+m.q.answer);
        const item=document.createElement("div"); item.className="mini"; item.style.marginBottom="10px";
        item.innerHTML=`<div class="mono"><b>${m.idx}. [${m.q.domain}]</b> Correct: <b>${letter}</b></div><div class="small" style="margin-top:6px"><b>Ref:</b> ${m.q.ref||"—"}</div><div class="small"><b>Hint:</b> ${m.q.hint||"—"}</div>`;
        list.appendChild(item);
      });
    }
    const copyBtn=document.createElement("button"); copyBtn.className="primary"; copyBtn.textContent="Copy Miss Breadcrumbs"; copyBtn.style.marginTop="10px";
    copyBtn.onclick=async()=>{
      const text=missesOnly.length===0?"Miss Breadcrumbs: none":"Miss Breadcrumbs:\n"+missesOnly.map(m=>`- ${m.idx}. [${m.q.domain}] Correct: ${String.fromCharCode(65+m.q.answer)}\n  Ref: ${m.q.ref||"—"}\n  Hint: ${m.q.hint||"—"}`).join("\n");
      try{await navigator.clipboard.writeText(text);alert("Copied.");}catch{alert("Clipboard blocked. Copy manually.");}
    };
    panel.append(list,copyBtn);
    missPanel.appendChild(panel);
    stopTimer();
  };
  quizShell.append(quizControls, quizScroll);
root.appendChild(quizShell);
}

/* ===== Flashcards ===== */
function renderFlashcards(root){
  const top=document.createElement("div"); top.className="row";
  top.innerHTML=`<span class="pill">Tap card to flip</span><span class="pill">Quick memory reps</span>`;
  root.appendChild(top);
  let index=0;
  const card=document.createElement("div"); card.className="flash";
  function draw(){
    const item=FLASHCARDS[index],flipped=card.dataset.flipped==="1";
    card.innerHTML=flipped?`<div class="front">Answer</div><div class="back">${item.back}</div>`:`<div class="front">${item.front}</div><div class="back">Tap to reveal</div>`;
  }
  card.onclick=()=>{card.dataset.flipped=(card.dataset.flipped==="1")?"0":"1";draw();};
  const nav=document.createElement("div"); nav.className="footerRow";
  const prev=document.createElement("button"); prev.textContent="◀ Prev";
  const next=document.createElement("button"); next.textContent="Next ▶";
  const shuffle=document.createElement("button"); shuffle.className="primary"; shuffle.textContent="Shuffle";
  prev.onclick=()=>{index=(index-1+FLASHCARDS.length)%FLASHCARDS.length;card.dataset.flipped="0";draw();};
  next.onclick=()=>{index=(index+1)%FLASHCARDS.length;card.dataset.flipped="0";draw();};
  shuffle.onclick=()=>{shuffleArray(FLASHCARDS);index=0;card.dataset.flipped="0";draw();};
  nav.append(prev,shuffle,next);
  root.append(card,nav);
  card.dataset.flipped="0"; draw();
}

/* ===== Wording ===== */
function renderWording(root){
  const top=document.createElement("div"); top.className="row";
  top.innerHTML=`<span class="pill">Field talk → Technician wording</span><span class="pill">Write clean inspection sentences</span>`;
  root.appendChild(top);
  WORDING_PROMPTS.forEach((p,idx)=>{
    const block=document.createElement("div"); block.className="q";
    block.innerHTML=`<strong>${idx+1}. Field version:</strong><div class="mono" style="margin:6px 0 10px;opacity:.9">${p.field}</div><div class="split"><div><div class="small">Your Technician rewrite:</div><textarea id="w_${idx}" placeholder="One inspection-style sentence..."></textarea></div><div><div class="small">Target phrasing (reference):</div><div class="mini" style="height:100%;display:flex;align-items:flex-start"><div class="mono" style="white-space:pre-wrap">${p.target}</div></div></div></div>`;
    root.appendChild(block);
  });
  const doneBtn=document.createElement("button"); doneBtn.className="primary"; doneBtn.textContent="Mark Wording Done (Daily)";
  doneBtn.onclick=()=>{setDailyStep("wording",true);okBeep();alert("Marked.");};
  const tip=document.createElement("div"); tip.className="small"; tip.style.marginTop="10px";
  tip.textContent="Power phrases: listed assembly • manufacturer minimum bend radius • minimize impedance • limit future expansion • shock hazard • resiliency";
  root.append(doneBtn,tip);
}

/* ===== Bank Manager ===== */

function renderBankManager(root){
  const bank = getBank();
  const head = document.createElement("div");
  head.className = "q";
  head.innerHTML = `
    <strong>Shared Question Bank</strong>
    <div class="small" style="margin-top:6px">
      This bank is read-only on the hosted site.
    </div>
    <div class="row" style="margin-top:10px">
      <span class="pill">Current bank size: <span class="mono">${bank.length}</span></span>
      <span class="pill">Selection: <span class="mono">${state.selection}</span></span>
    </div>
  `;

  const box = document.createElement("div");
  box.className = "q";
  box.innerHTML = `<strong>Bank Actions</strong><div class="small">Use export to review the currently hosted bank file.</div>`;

  const btnRow = document.createElement("div");
  btnRow.className = "footerRow";

  const exportBankBtn = document.createElement("button");
  exportBankBtn.textContent = "Export Shared Bank";

  const reloadBankBtn = document.createElement("button");
  reloadBankBtn.className = "primary";
  reloadBankBtn.textContent = "Reload Shared Bank";

  const status = document.createElement("div");
  status.className = "small";
  status.style.marginTop = "10px";

  exportBankBtn.onclick = ()=>{
    const data = getBank();
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `question-bank-${data.length}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  reloadBankBtn.onclick = async ()=>{
    status.textContent = "Reloading shared bank...";
    await loadSharedBank();
    status.textContent = `Reloaded shared bank. Total questions: ${getBank().length}.`;
    render();
  };

  btnRow.append(reloadBankBtn, exportBankBtn);
  box.append(btnRow, status);
  root.append(head, box);
}


/* =========================
   Export / Import (progress)
   ========================= */

function exportAll(){
  const obj = {state,misses:loadMisses(),stats:loadStats(),daily:loadDaily(),rotation:loadRot()};
  const blob = new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bicsi_trainer_progress_${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importAll(obj){
  if(obj.state){ Object.assign(state,obj.state); saveState(); }
  if(obj.misses) saveMisses(obj.misses);
  if(obj.stats) saveStats(obj.stats);
  if(obj.daily) saveDaily(obj.daily);
  if(obj.rotation) saveRot(obj.rotation);
}


/* =========================
   Menu Bar Logic
   ========================= */
function wireMenuBar(){
  const menuBar=document.getElementById("menuBar");

  // Toggle open/close on click
  menuBar.addEventListener("click",(e)=>{
    const item=e.target.closest(".menuItem");
    if(!item) { closeAllMenus(); return; }
    const isOpen=item.classList.contains("open");
    closeAllMenus();
    if(!isOpen) item.classList.add("open");
  });

  // Close menus when clicking outside
  document.addEventListener("click",(e)=>{
    if(!e.target.closest(".menuBar")) closeAllMenus();
  });

  // Hover to switch between open menus
  menuBar.querySelectorAll(".menuItem").forEach(item=>{
    item.addEventListener("mouseenter",()=>{
      const anyOpen=[...menuBar.querySelectorAll(".menuItem")].some(i=>i.classList.contains("open"));
      if(anyOpen){ closeAllMenus(); item.classList.add("open"); }
    });
  });

  function closeAllMenus(){ menuBar.querySelectorAll(".menuItem.open").forEach(i=>i.classList.remove("open")); }

  // File menu
  document.getElementById("menuQuestionBank").addEventListener("click",()=>{ state.mode="bank"; saveState(); render(); closeAllMenus(); });
  document.getElementById("menuImport").addEventListener("click",()=>{ document.getElementById("importFile").click(); closeAllMenus(); });
  document.getElementById("menuExport").addEventListener("click",()=>{ exportAll(); closeAllMenus(); });
  document.getElementById("menuReset").addEventListener("click",()=>{
    if(!confirm("Reset all local progress, misses, stats, and daily history?")) return;
    [KEY,QB_ROT_KEY,MISSES_KEY,STATS_KEY,DAILY_KEY].forEach(k=>localStorage.removeItem(k));
    location.reload();
  });

  // Session menu
  document.getElementById("menuHome").addEventListener("click",()=>{ state.mode="daily"; saveState(); render(); closeAllMenus(); });
  document.getElementById("menuDaily").addEventListener("click",()=>{ state.mode="daily"; saveState(); render(); closeAllMenus(); });
  document.getElementById("menuPressure").addEventListener("click",()=>{ state.mode="pressure"; saveState(); render(); closeAllMenus(); });
  document.getElementById("menuFlashcards").addEventListener("click",()=>{ state.mode="flashcards"; saveState(); render(); closeAllMenus(); });
  document.getElementById("menuWording").addEventListener("click",()=>{ state.mode="wording"; saveState(); render(); closeAllMenus(); });

  // Trainer menu
  document.getElementById("menuReview").addEventListener("click",()=>{ state.mode="review"; saveState(); render(); closeAllMenus(); });
  document.getElementById("menuClearMisses").addEventListener("click",()=>{
    if(!confirm("Clear your misses deck?")) return;
    clearMisses(); render(); closeAllMenus();
  });

  // Diagnostics menu
  document.getElementById("menuSettings").addEventListener("click",()=>{ document.getElementById("settingsModal").classList.remove("hidden"); closeAllMenus(); });

  // Help menu
  document.getElementById("menuManual").addEventListener("click",()=>{ window.open("BICSI_Technician_Training_Manual.pdf","_blank"); closeAllMenus(); });
  document.getElementById("menuPractice").addEventListener("click",()=>{ window.open("BICSI_Technician_Practice_Test.pdf","_blank"); closeAllMenus(); });
  document.getElementById("menuFlashPDF").addEventListener("click",()=>{ window.open("BICSI_Technician_Flashcards.pdf","_blank"); closeAllMenus(); });
  document.getElementById("menuImages").addEventListener("click",()=>{ window.open("BICSI_Technician_Images.pdf","_blank"); closeAllMenus(); });

  
// Import file handler
  document.getElementById("importFile").addEventListener("change",async(e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const fileText = await file.text();
    try{
      const obj = JSON.parse(fileText);
      importAll(obj);
      render();
      alert("Progress imported.");
    }catch{
      alert("Invalid progress file.");
    }finally{
      e.target.value = "";
    }
  });

  // Settings modal controls

  document.getElementById("closeSettingsBtn").addEventListener("click",()=>{ document.getElementById("settingsModal").classList.add("hidden"); });
  document.getElementById("settingsModal").addEventListener("click",(e)=>{ if(e.target.id==="settingsModal") document.getElementById("settingsModal").classList.add("hidden"); });
  document.getElementById("themeSelect").addEventListener("change",(e)=>{ state.theme=e.target.value; saveState(); render(); });
  document.getElementById("fontSelect").addEventListener("change",(e)=>{ state.font=Number(e.target.value); saveState(); render(); });
  document.getElementById("selectionSelect").addEventListener("change",(e)=>{ state.selection=e.target.value; saveState(); render(); });
}

/* =========================
   Workbench Status
   ========================= */
const modePrompts={
  daily:["Loading daily circuit...","Balancing weak domains...","Preparing warmup sequence...","Awaiting operator input..."],
  pressure:["Pressure simulation armed...","Randomizing answer vectors...","Chronometer standing by...","Maintain signal discipline..."],
  review:["Scanning misses deck...","Prioritizing weak targets...","Routing review packets...","Recovery mode active..."],
  flashcards:["Indexing recall modules...","Card stack online...","Memory drills available...","Tap card to reveal..."],
  wording:["Loading technician phrasing lab...","Power phrases synchronized...","Field language translator ready...","Draft concise inspection notes..."],
  bank:["Question bank maintenance active...","Import channel open...","Rotation order standing by...","Archive and merge routines ready..."]
};

function updateWorkbenchStatus(){
  const modeText=(state.mode||"daily").toUpperCase();
  const selectionText=(state.selection||"adaptive").toUpperCase();
  const themeText=state.theme==="ibm"?"IBM WORKSTATION":"WINDOWS 95";

  const el=id=>document.getElementById(id);
  if(el("statusMode")) el("statusMode").textContent=modeText;
  if(el("statusTheme")) el("statusTheme").textContent=themeText;
  if(el("statusHeadline")) el("statusHeadline").textContent=`${modeText} • NOMINAL`;
  if(el("lampMode")) el("lampMode").className="diagLamp active";

  // Trainer dropdown status tags
  if(el("trainerStatusMode")) el("trainerStatusMode").textContent=`MODE // ${modeText}`;
  if(el("trainerStatusSelect")) el("trainerStatusSelect").textContent=`SELECT // ${selectionText}`;
  if(el("trainerStatusTheme")) el("trainerStatusTheme").textContent=`THEME // ${themeText}`;

  const prompt=el("bootPrompt");
  if(prompt){
    const msgs=modePrompts[state.mode]||modePrompts.daily;
    let i=0;
    prompt.innerHTML=`${msgs[0]}<span class="cursor">█</span>`;
    if(prompt._rotator) clearInterval(prompt._rotator);
    prompt._rotator=setInterval(()=>{ i=(i+1)%msgs.length; prompt.innerHTML=`${msgs[i]}<span class="cursor">█</span>`; },2200);
  }
}

/* =========================
   Audio FX
   ========================= */
function beep(freq=880,duration=0.06,type="sine",gain=0.018){
  try{
    const ctx=beep.ctx||(beep.ctx=new(window.AudioContext||window.webkitAudioContext)());
    const osc=ctx.createOscillator(),g=ctx.createGain();
    osc.type=type; osc.frequency.value=freq; g.gain.value=gain;
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+duration); osc.stop(ctx.currentTime+duration);
  }catch(e){}
}
function clickBeep(){ beep(640,0.035,"square",0.012); }
function okBeep(){ beep(880,0.05,"triangle",0.018); setTimeout(()=>beep(1175,0.06,"triangle",0.014),70); }
function warnBeep(){ beep(320,0.08,"sawtooth",0.018); }

function wireFx(){
  document.addEventListener("click",(e)=>{ if(e.target.closest("button, .pill, .flash, select, .dropdown-item")) clickBeep(); });
}

/* =========================
   Boot Sequence
   ========================= */
function startBootSequence(){
  console.log("boot sequence is running.")
  const overlay=document.getElementById("bootOverlay");
  const log=document.getElementById("bootLog");
  const ready=document.getElementById("bootReady");
  if(!overlay||!log||!ready) return;
  const lines=["INITIALIZING BICSI TRAINING CONSOLE...","LOADING QUESTION BANK...","MOUNTING LOCAL MEMORY...","CALIBRATING DIAGNOSTIC PANELS...","SYNCING PALETTE MODULE...","READY."];
  log.textContent=""; ready.classList.remove("show");
  let index=0;
  function renderLine(){
    if(index>=lines.length){ log.textContent+="\n> OPERATOR LINK ESTABLISHED"; ready.classList.add("show"); setTimeout(()=>{overlay.style.display="none";},900); return; }
    log.textContent+=(index?"\n":"")+lines[index]; index++;
    setTimeout(renderLine,400);
  }
  setTimeout(()=>{overlay.style.display="none";},5000);
  renderLine();
}

/* =========================
   Init
   ========================= */
document.addEventListener("DOMContentLoaded", async ()=>{
   await loadSharedBank();
  
  render();
  wireMenuBar();
  wireFx();
  
  startBootSequence();
});
