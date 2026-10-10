/* Gemeinsame Seitenlogik der Übungsmodule (Kräftigung, Dehnen) – die Bibliothek kommt aus window.LA_LIB. */
(function(){
"use strict";
const $=id=>document.getElementById(id), esc=LA.esc, K=window.LA_LIB, T=K.text;
const P="la"+K.id[0].toUpperCase()+K.id.slice(1); // Gerätespeicher-Präfix, z. B. laKraft
const opt=(v,t,sel)=>'<option value="'+esc(v)+'"'+(v===sel?" selected":"")+">"+esc(t)+"</option>";
const ls={get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }};
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
let ATH=LA.athletes(), aid=null, tab=ls.get(P+".tab","all"), region="", ordering=false;

/* ---------- Athlet & Steuerung ---------- */
function pickAthlete(){
  ATH=LA.athletes();
  const saved=ls.get(P+".ath",null);
  aid=ATH.some(a=>a.id===saved)?saved:(ATH[0]?ATH[0].id:null);
}
const athlete=()=>ATH.find(a=>a.id===aid)||null;
function rec(){
  const r=aid?LA.progFor(K.id,aid):Object.assign(LA.cleanProg({}),ls.get(P+".gen",{}));
  // fehlende oder unbekannte Kürzel → Standard der Bibliothek
  if(!K.GOALS[r.goal]) r.goal=K.DEFAULTS.goal; if(!K.LEVELS[r.level]) r.level=K.DEFAULTS.level;
  if(!K.PHASES||!K.PHASES[r.phase]) r.phase=K.PHASES?K.DEFAULTS.phase:null;
  return r;
}
function saveRec(r){ if(aid) LA.saveProg(K.id,aid,r); else ls.set(P+".gen",{goal:r.goal,level:r.level,phase:r.phase}); }
const cfgTxt=(r,sep)=>[K.GOALS[r.goal],K.LEVELS[r.level],K.PHASES?K.PHASES[r.phase]:null].filter(Boolean).join(sep);
function age(){ const a=athlete(); return a&&a.birthYear?new Date().getFullYear()-a.birthYear:null; }
function doseFor(ex,r){
  const d=K.dose(ex,r,age()), o=(r||rec()).over[ex.id];
  return Object.assign({},d,{sets:o&&o.sets?o.sets:d.sets,reps:o&&o.reps?o.reps:d.reps,load:o?o.load:"",note:o?o.note:"",changed:!!o});
}
const doseTxt=d=>d.sets+" × "+d.reps+" "+d.unit+(d.side?" je Seite":"");
function renderWho(){
  $("ath").innerHTML=ATH.length?ATH.map(a=>opt(a.id,a.name,aid)).join(""):'<option value="">– kein Athlet angelegt –</option>';
  $("ath").disabled=!ATH.length;
  $("athHint").innerHTML=ATH.length?"":'Für ein eigenes Programm mit ☆-Favoriten <a class="link" href="../athleten/#neu">Athlet anlegen</a>.';
  const r=rec(), seg=(id,map,val,key)=>{ $(id).innerHTML=Object.keys(map).map(k=>'<button type="button" data-k="'+key+'" data-v="'+k+'" aria-pressed="'+(k===val)+'">'+esc(map[k])+"</button>").join(""); };
  seg("cGoal",K.GOALS,r.goal,"goal"); seg("cLevel",K.LEVELS,r.level,"level");
  $("phaseBox").hidden=!K.PHASES;
  if(K.PHASES) $("cPhase").innerHTML=Object.keys(K.PHASES).map(k=>opt(k,K.PHASES[k],r.phase)).join("");
  $("cfgSum").textContent="Steuerung: "+cfgTxt(r," · ");
  const g=age();
  $("cAge").textContent=g==null?"Mit Jahrgang in der Athletenverwaltung werden Masters-Anpassungen (ab 50) berücksichtigt."
    :"Alter "+g+(g>=50?": "+T.ageNote:": keine Altersanpassung.");
}
$("ath").addEventListener("change",()=>{ aid=$("ath").value||null; ls.set(P+".ath",aid); ordering=false; renderAll(); });
function onSeg(e){ const b=e.target.closest("button[data-k]"); if(!b) return; const r=rec(); r[b.dataset.k]=b.dataset.v; saveRec(r); renderAll(); }
$("cGoal").addEventListener("click",onSeg); $("cLevel").addEventListener("click",onSeg);
$("cPhase").addEventListener("change",()=>{ const r=rec(); r.phase=$("cPhase").value; saveRec(r); renderAll(); });

/* ---------- Kacheln ---------- */
function lastDone(r){ const m={}; r.log.forEach(s=>s.items.forEach(i=>{ if(i.sets>0&&(!m[i.id]||m[i.id]<s.date)) m[i.id]=s.date; })); return m; }
function tile(ex,r,i,n,last){
  const d=doseFor(ex,r), fav=r.favs.includes(ex.id);
  let h='<div class="tile" data-id="'+ex.id+'">'+K.sketch(ex)+'<div class="nm">'+esc(ex.name)+"</div>"
    +'<div class="rg">'+esc(K.REGIONS[ex.region])+(last[ex.id]?" · zuletzt "+LA.fmtDate(last[ex.id]).slice(0,6):"")+"</div>"
    +'<div class="ds'+(d.changed?" ad":"")+'">'+esc(doseTxt(d))+(d.load?" <small>· "+esc(d.load)+"</small>":"")+"</div>";
  if(aid) h+='<button type="button" class="star" data-fav="'+ex.id+'" aria-pressed="'+fav+'" aria-label="'+(fav?"Aus dem Programm entfernen":"Ins Programm aufnehmen")+'">'+(fav?"★":"☆")+"</button>";
  if(ordering&&n) h+='<div class="mv"><button type="button" data-mv="-1" data-i="'+i+'"'+(i===0?" disabled":"")+' aria-label="nach vorn">↑</button><button type="button" data-mv="1" data-i="'+i+'"'+(i===n-1?" disabled":"")+' aria-label="nach hinten">↓</button></div>';
  return h+"</div>";
}
function renderGrid(){
  const r=rec(), last=lastDone(r);
  const mine=tab==="mine"&&aid;
  $("tabMine").setAttribute("aria-selected",String(!!mine)); $("tabAll").setAttribute("aria-selected",String(!mine));
  $("tabMine").textContent="Mein Programm"+(aid?" ("+r.favs.filter(id=>K.BY_ID.has(id)).length+")":"");
  $("tabMine").disabled=!aid;
  $("mineHead").hidden=!mine; $("allHead").hidden=!!mine;
  let list;
  if(mine){
    list=r.favs.map(id=>K.BY_ID.get(id)).filter(Boolean);
    const n=list.length, a=athlete();
    $("mineCount").textContent=n?n+" Übung"+(n===1?"":"en")+" für "+a.name:"Noch keine Übungen ausgewählt";
    $("orderBtn").hidden=n<2; $("orderBtn").textContent=ordering?"Fertig":"Reihenfolge ändern";
    const has=new Set(list.map(e=>e.region));
    $("cov").innerHTML=Object.keys(K.REGIONS).map(k=>'<span class="'+(has.has(k)?"on":"off")+'">'+(has.has(k)?"✓ ":"")+esc(K.REGIONS[k])+"</span>").join("");
    const miss=Object.keys(K.REGIONS).filter(k=>!has.has(k)&&!T.skipCoverage.includes(k));
    $("covHint").textContent=!n?"In „Alle Übungen“ mit ☆ auswählen – "+T.empty+".":miss.length?"Für ein ausgewogenes Programm fehlt noch: "+miss.map(k=>K.REGIONS[k]).join(", ")+".":"Alle Bereiche abgedeckt.";
    $("grid").innerHTML=n?list.map((ex,i)=>tile(ex,r,i,n,last)).join(""):'<p class="empty" style="grid-column:1/-1">Noch leer – wechsle zu „Alle Übungen“ und tippe auf ☆.</p>';
  } else {
    const eq=$("fEquip").value, q=$("fSearch").value.trim().toLowerCase();
    list=K.EX.filter(e=>(!region||e.region===region)&&(!eq||e.equip.includes(eq))&&(!q||(e.name+" "+e.muscles).toLowerCase().includes(q)));
    $("fCount").textContent=list.length+" von "+K.EX.length+" Übungen";
    $("grid").innerHTML=list.length?list.map(ex=>tile(ex,r,0,0,last)).join(""):'<p class="empty" style="grid-column:1/-1">Keine Übung passt zum Filter.</p>';
  }
  $("startBtn").hidden=!(mine&&list.length);
  renderHist(r);
}
function renderHist(r){
  const show=tab==="mine"&&aid&&r.log.length;
  $("histBox").hidden=!show; if(!show) return;
  const t=today(), d7=r.log.filter(s=>LA.daysUntil(s.date,t)>-7).length, d28=r.log.filter(s=>LA.daysUntil(s.date,t)>-28).length;
  $("histSum").textContent="Letzte 7 Tage: "+d7+" · letzte 4 Wochen: "+d28+" Einheit"+(d28===1?"":"en")+".";
  $("hist").innerHTML=r.log.slice().reverse().slice(0,8).map(s=>{ const n=s.items.filter(i=>i.sets>0).length, sets=s.items.reduce((a,i)=>a+i.sets,0);
    return "<div><span>"+LA.fmtDate(s.date)+"</span><span>"+n+" Übung"+(n===1?"":"en")+" · "+sets+" "+T.unitSets+"</span></div>"; }).join("");
}
function renderFilters(){
  $("fRegion").innerHTML='<button type="button" data-r="" aria-pressed="'+(region==="")+'">Alle</button>'+Object.keys(K.REGIONS).map(k=>'<button type="button" data-r="'+k+'" aria-pressed="'+(region===k)+'">'+esc(K.REGIONS[k])+"</button>").join("");
  if(!$("fEquip").options.length) $("fEquip").innerHTML='<option value="">Alle Geräte</option>'+Object.keys(K.EQUIP).map(k=>opt(k,K.EQUIP[k],"")).join("");
}
function renderAll(){ renderWho(); renderFilters(); renderGrid(); }
$("fRegion").addEventListener("click",e=>{ const b=e.target.closest("button[data-r]"); if(!b) return; region=b.dataset.r; renderFilters(); renderGrid(); });
$("fEquip").addEventListener("change",renderGrid);
$("fSearch").addEventListener("input",renderGrid);
$("tabMine").addEventListener("click",()=>{ tab="mine"; ls.set(P+".tab",tab); renderGrid(); });
$("tabAll").addEventListener("click",()=>{ tab="all"; ordering=false; ls.set(P+".tab",tab); renderGrid(); });
$("orderBtn").addEventListener("click",()=>{ ordering=!ordering; renderGrid(); });
function toggleFav(id){ if(!aid) return; const r=rec(), i=r.favs.indexOf(id); if(i>=0) r.favs.splice(i,1); else r.favs.push(id); saveRec(r); }
$("grid").addEventListener("click",e=>{
  const s=e.target.closest("[data-fav]"); if(s){ e.stopPropagation(); toggleFav(s.dataset.fav); renderGrid(); return; }
  const m=e.target.closest("[data-mv]"); if(m){ e.stopPropagation(); const r=rec(), i=+m.dataset.i, j=i+(+m.dataset.mv), f=r.favs.filter(id=>K.BY_ID.has(id));
    [f[i],f[j]]=[f[j],f[i]]; r.favs=f; saveRec(r); renderGrid(); return; }
  const t=e.target.closest(".tile"); if(t) go("#u/"+t.dataset.id);
});

/* ---------- Übung ---------- */
let cur=null, anim=null;
function stopAnim(){ if(anim){ cancelAnimationFrame(anim); anim=null; } $("exPlay").textContent="▶ Bewegung abspielen"; if(cur) $("exSketch").innerHTML=K.sketch(cur); }
$("exPlay").addEventListener("click",()=>{
  if(anim){ stopAnim(); return; }
  if(!cur.poses[1]){ $("exNotes").textContent=T.stillNote; return; }
  const t0=performance.now(), P=2600;
  $("exPlay").textContent="■ Stopp";
  const step=now=>{ const x=((now-t0)%P)/P, t=x<0.4?x/0.4:x<0.5?1:x<0.9?1-(x-0.5)/0.4:0, e=t*t*(3-2*t);
    $("exSketch").innerHTML=K.sketch(cur,e); anim=requestAnimationFrame(step); };
  anim=requestAnimationFrame(step);
});
function openEx(id){
  cur=K.BY_ID.get(id); if(!cur){ go("#",true); return; }
  stopAnim();
  const r=rec(), d=doseFor(cur,r), base=K.dose(cur,r,age());
  $("exName").textContent=cur.name;
  $("exBadges").innerHTML='<span class="badge">'+esc(K.REGIONS[cur.region])+"</span>"+cur.equip.map(e=>'<span class="badge">'+esc(K.EQUIP[e])+"</span>").join("")
    +'<span class="badge">'+["","leicht","mittel","anspruchsvoll"][cur.level]+"</span>"+(cur.view?'<span class="badge">Skizze: '+esc(cur.view)+"</span>":"");
  $("exDose").innerHTML="<b>"+esc(d.sets+" × "+d.reps)+"</b><span>"+esc(d.unit+(d.side?" je Seite":""))+(d.changed?" · angepasst":"")+"</span>";
  $("exKv").innerHTML=(d.rest?"<dt>Pause</dt><dd>"+K.fmtRest(d.rest)+" "+T.restBetween+"</dd>":"")+"<dt>"+T.hintLabel+"</dt><dd>"+esc(d.hint)+"</dd>"
    +(d.load?"<dt>"+T.loadLabel+"</dt><dd>"+esc(d.load)+"</dd>":"")+(d.note?"<dt>Notiz</dt><dd>"+esc(d.note)+"</dd>":"")
    +(d.changed?"<dt>Empfehlung</dt><dd>"+esc(doseTxt(base))+"</dd>":"");
  $("exNotes").textContent="Grundlage: "+cfgTxt(r,", ")+(base.notes.length?" – "+base.notes.join("; "):"")+".";
  const o=r.over[cur.id]||{};
  $("oSets").value=o.sets||""; $("oSets").placeholder=base.sets; $("oReps").value=o.reps||""; $("oReps").placeholder=base.reps;
  $("oRepsLbl").textContent=base.unit==="s"?"Sekunden":base.unit; $("oLoad").value=o.load||""; $("oNote").value=o.note||""; $("oErr").textContent="";
  $("ovBox").hidden=!aid; $("oReset").hidden=!r.over[cur.id];
  const fav=r.favs.includes(cur.id);
  $("exFav").hidden=!aid; $("exFav").textContent=fav?"★ Im Programm":"☆ Ins Programm"; $("exFav").classList.toggle("primary",!fav);
  $("exSteps").innerHTML=cur.steps.map(s=>"<li>"+esc(s)+"</li>").join("");
  $("exCues").innerHTML=cur.cues.map(s=>"<li>"+esc(s)+"</li>").join("");
  $("exVar").innerHTML="<dt>Leichter</dt><dd>"+esc(cur.easier)+"</dd><dt>Schwerer</dt><dd>"+esc(cur.harder)+"</dd>";
  $("exWhy").textContent=cur.why; $("exMuscles").textContent="Muskeln: "+cur.muscles;
  $("exSketch").innerHTML=K.sketch(cur);
}
$("exFav").addEventListener("click",()=>{ toggleFav(cur.id); openEx(cur.id); });
$("oSave").addEventListener("click",()=>{
  const sets=$("oSets").value.trim(), reps=$("oReps").value.trim();
  if(sets&&!(/^\d{1,2}$/.test(sets)&&+sets>=1&&+sets<=12)) { $("oErr").textContent="Serien: 1 bis 12."; return; }
  if(reps&&!/^\d{1,3}(\s*[–-]\s*\d{1,3})?$/.test(reps)) { $("oErr").textContent="Wiederholungen als Zahl oder Bereich, z. B. 8 oder 8–10."; return; }
  const r=rec(); r.over[cur.id]={sets:sets?+sets:null,reps:reps.replace(/\s*-\s*/,"–"),load:$("oLoad").value.trim(),note:$("oNote").value.trim()};
  saveRec(r); $("ovBox").open=false; openEx(cur.id);
});
$("oReset").addEventListener("click",()=>{ const r=rec(); delete r.over[cur.id]; saveRec(r); $("ovBox").open=false; openEx(cur.id); });
$("exBack").addEventListener("click",e=>{ e.preventDefault(); back(); });

/* ---------- Training ---------- */
const RUN=P+".run";
let run=null, tInt=null, tEnd=0, audio=null;
function startRun(){
  const r=rec(), saved=ls.get(RUN,null);
  if(saved&&saved.aid===aid&&saved.date===today()) run=saved;
  else run={aid,date:today(),done:{}};
  ls.set(RUN,run); renderRun();
}
function renderRun(){
  const r=rec(), list=r.favs.map(id=>K.BY_ID.get(id)).filter(Boolean), a=athlete();
  $("runSub").textContent=(a?a.name+" · ":"")+LA.fmtDate(run.date)+" · "+T.runHint;
  $("runList").innerHTML=list.map(ex=>{ const d=doseFor(ex,r), n=run.done[ex.id]||0;
    return '<div class="wk'+(n>=d.sets?" done":"")+'"><div class="h">'+K.sketch(ex)+'<div class="tx"><b>'+esc(ex.name)+"</b><span>"+esc(doseTxt(d))+(d.load?" · "+esc(d.load):"")+(d.rest?" · Pause "+K.fmtRest(d.rest):"")+"</span></div></div>"
      +'<div class="sets">'+Array.from({length:d.sets},(_,i)=>'<button type="button" data-ex="'+ex.id+'" data-s="'+(i+1)+'" aria-pressed="'+(i<n)+'" aria-label="'+T.unitOne+" "+(i+1)+'">'+(i+1)+"</button>").join("")
      +(d.unit==="s"&&n<d.sets?'<button type="button" class="hold" data-hold="'+ex.id+'">▶ '+holdSec(d)+" s halten</button>":"")+"</div></div>"; }).join("")
    ||'<p class="empty">Noch keine Übungen im Programm.</p>';
}
// Haltedauer: obere Grenze der Spanne („30–40“ → 40)
const holdSec=d=>{ const m=String(d.reps).match(/(\d+)\D*$/); return m?+m[1]:30; };
function afterSet(id){
  const ex=K.BY_ID.get(id), d=doseFor(ex,rec()), n=run.done[id]||0;
  if(n<d.sets&&d.rest) startTimer(d.rest,"Pause · danach "+ex.name+" – "+T.unitOne+" "+(n+1)+" von "+d.sets,"Weiter mit "+T.unitOne+" "+(n+1));
  else stopTimer();
}
$("runList").addEventListener("click",e=>{
  const h=e.target.closest("button[data-hold]");
  if(h){ const id=h.dataset.hold, ex=K.BY_ID.get(id), d=doseFor(ex,rec());
    const sec=holdSec(d), finish=()=>{ run.done[id]=Math.min(d.sets,(run.done[id]||0)+1); ls.set(RUN,run); renderRun(); setTimeout(()=>afterSet(id),900); };
    // je Seite: erste Seite → 5 s Seitenwechsel → zweite Seite, erst dann zählt der Durchgang
    if(d.side) startTimer(sec,"Halten · "+ex.name+" – erste Seite","Seite wechseln",()=>setTimeout(()=>
      startTimer(5,"Seitenwechsel · gleich "+ex.name+" – zweite Seite","Los",()=>startTimer(sec,"Halten · "+ex.name+" – zweite Seite","Geschafft",finish)),600));
    else startTimer(sec,"Halten · "+ex.name,"Geschafft",finish);
    return; }
  const b=e.target.closest("button[data-ex]"); if(!b) return;
  const id=b.dataset.ex, s=+b.dataset.s, n=run.done[id]||0;
  run.done[id]=s<=n?s-1:s; ls.set(RUN,run); renderRun();
  if(s>n) afterSet(id);
});
function beep(){ try{ audio=audio||new (window.AudioContext||window.webkitAudioContext)(); const o=audio.createOscillator(), g=audio.createGain();
  o.frequency.value=880; g.gain.value=0.15; o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime+0.35); }catch(e){}
  if(navigator.vibrate) navigator.vibrate([200,100,200]); }
function tick(){ const left=Math.max(0,Math.round((tEnd-Date.now())/1000));
  $("tLeft").textContent=Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
  if(left<=0){ clearInterval(tInt); tInt=null; $("timer").classList.add("end"); $("tLbl").textContent=tDone; beep(); const f=tFn; tFn=null; if(f) f(); } }
let tDone="", tFn=null;
function startTimer(sec,label,doneLabel,onEnd){ try{ audio=audio||new (window.AudioContext||window.webkitAudioContext)(); audio.resume(); }catch(e){}
  tEnd=Date.now()+sec*1000; tDone=doneLabel||"Weiter"; tFn=onEnd||null; $("timer").hidden=false; $("timer").classList.remove("end"); $("tLbl").textContent=label;
  clearInterval(tInt); tInt=setInterval(tick,250); tick(); }
function stopTimer(){ clearInterval(tInt); tInt=null; $("timer").hidden=true; }
$("tPlus").addEventListener("click",()=>{ if(!tInt){ startTimer(15,"Zusätzliche Zeit"); return; } tEnd+=15000; tick(); });
$("tSkip").addEventListener("click",()=>{ tFn=null; stopTimer(); });
$("runDone").addEventListener("click",()=>{
  const items=Object.keys(run.done).filter(id=>run.done[id]>0).map(id=>({id,sets:run.done[id]}));
  if(!items.length){ if(!confirm("Noch nichts abgehakt. Trotzdem beenden?")) return; }
  else { const r=rec(); r.log.push({date:run.date,at:new Date().toISOString(),items}); saveRec(r); }
  ls.set(RUN,null); run=null; stopTimer(); go("#",true);
});
$("runCancel").addEventListener("click",()=>{ if(!confirm(T.run+" verwerfen? Abgehaktes wird nicht gespeichert.")) return; ls.set(RUN,null); run=null; stopTimer(); go("#",true); });
$("runBack").addEventListener("click",e=>{ e.preventDefault(); stopTimer(); back(); });

/* ---------- Navigation ---------- */
let listScroll=0, fromList=false;
function go(hash,replace){ if(location.hash===hash||(hash==="#"&&!location.hash)) return route(); if(replace) location.replace(hash); else location.hash=hash; }
function back(){ if(fromList) history.back(); else go("#",true); }
$("startBtn").addEventListener("click",e=>{ e.preventDefault(); go("#training"); });
function show(v){ ["viewList","viewEx","viewRun"].forEach(x=>{ $(x).hidden=x!==v; }); }
function route(){
  const h=location.hash, m=h.match(/^#u\/(.+)$/);
  if(m||h==="#training"){
    if(!$("viewList").hidden){ listScroll=window.scrollY; fromList=true; }
    if(m){ show("viewEx"); openEx(decodeURIComponent(m[1])); }
    else { if(!aid){ go("#",true); return; } show("viewRun"); startRun(); }
    window.scrollTo(0,0);
  } else {
    const was=$("viewList").hidden; stopAnim(); show("viewList"); fromList=false; renderAll(); if(was) window.scrollTo(0,listScroll);
  }
}
window.addEventListener("hashchange",route);
window.addEventListener("la:synced",()=>{ pickAthlete(); if(!$("viewList").hidden) renderAll(); });
window.addEventListener("pageshow",e=>{ if(e.persisted){ pickAthlete(); route(); } });

pickAthlete();
if(tab==="mine"&&!aid) tab="all";
$("ver").textContent=LA.VERSION;
document.title=T.title; $("pgTitle").textContent=T.title; $("pgSub").textContent=T.sub;
$("lGoal").textContent=T.goal; $("lLevel").textContent=T.level; if(T.phase) $("lPhase").textContent=T.phase;
$("startBtn").textContent=T.start; $("lLoad").textContent=T.loadLabel; $("oLoad").placeholder=T.loadPh; $("runTitle").textContent=T.run; $("runDone").textContent=T.done;
route();
LA.registerOffline("../",s=>{ $("offState").textContent=s; });
})();

