/* ===============================
   Dashboard Hippodrome – Corrections lignes/retards/traﬁc + responsive 16:9
   =============================== */

const PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

const APIS = {
  WEATHER: "https://api.open-meteo.com/v1/forecast?latitude=48.83&longitude=2.42&current_weather=true",
  SAINT: "https://nominis.cef.fr/json/nominis.php",
  RSS: "https://www.francetvinfo.fr/titres.rss",
  PRIM_STOP: (stopId) => `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`,
  PRIM_GM: (cCode) => `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=STIF:Line::${cCode}:`,
  PMU: (day) => `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${day}`,
  VELIB: (station) => `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${station}&limit=1`
};

const STOP_IDS = { RER_A: "STIF:StopArea:SP:43135:", HIPPODROME: "STIF:StopArea:SP:463641:", BREUIL: "STIF:StopArea:SP:463644:" };

const qs = (s, el=document) => el.querySelector(s);
const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; };

function banner(msg){ const host=document.getElementById('prim-messages'); if(!host) return; host.prepend(el('div','message critical', msg)); }
async function fetchAPI(url, timeout=15000){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeout); try{ const f=url.startsWith(PROXY)?url:PROXY+encodeURIComponent(url); const r=await fetch(f,{signal:c.signal}); clearTimeout(t); if(!r.ok) throw new Error(`HTTP ${r.status}`); const ct=r.headers.get('content-type')||''; return ct.includes('application/json')? await r.json(): await r.text(); }catch(e){ clearTimeout(t); console.warn('fetchAPI failed:',url,e.message); banner(`Erreur API (${e.message}) sur ${url.split('/')[2]}`); return null; }}

const clean=(s="")=>s.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const minutesFromISO=(iso)=> iso? Math.max(0,Math.round((new Date(iso).getTime()-Date.now())/60000)):null;

const COLORS={ modes:{bus:'#0aa3df','rer-a':'#e5003a'}, lines:{'77':'#0aa3df','201':'#0aa3df','A':'#e5003a','101':'#0aa3df','106':'#0aa3df','108':'#0aa3df','110':'#0aa3df','112':'#0aa3df','111':'#0aa3df','281':'#0aa3df','N33':'#7b68ee'} };
const colorFor=(g)=> COLORS.lines[g.lineId]||COLORS.modes[g.mode]||'#0aa3df';

function setClock(){ const d=new Date(); qs('#datetime').textContent=`${d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} – ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`; }

async function loadTrafficMessages(){
  const cLines={'RER A':'C01742','77':'C01399','201':'C01219'};
  const out=[];
  for(const [label,code] of Object.entries(cLines)){
    const d=await fetchAPI(APIS.PRIM_GM(code));
    const dels=d?.Siri?.ServiceDelivery?.GeneralMessageDelivery||[];
    dels.forEach(x=> (x.InfoMessage||[]).forEach(m=>{
      const txt=clean(m?.Content?.Message?.[0]?.MessageText?.[0]?.value||""); if(txt) out.push({label,txt});
    }));
  }
  const prim=qs('#prim'); prim.innerHTML='';
  if(!out.length) prim.textContent='Aucune perturbation majeure signalée.';
  else out.forEach(i=> prim.appendChild(el('div','message info', `<strong>${i.label}</strong> — ${i.txt}`)));
}

async function fetchStopData(stopId){ const d=await fetchAPI(APIS.PRIM_STOP(stopId)); const vs=d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit||[]; return vs.map(v=>{ const mv=v.MonitoredVehicleJourney||{}; const call=mv.MonitoredCall||{}; const lineRef=mv.LineRef?.value||mv.LineRef||''; const lineId=(lineRef.match(/C\d{5}/)||[null])[0]; const dest=clean(call.DestinationDisplay?.[0]?.value||''); const expected=call.ExpectedDepartureTime||call.ExpectedArrivalTime||null; const aimed=call.AimedDepartureTime||call.AimedArrivalTime||null; const minutes=minutesFromISO(expected); let delayMin=null; if(expected&&aimed){ const d=Math.round((new Date(expected)-new Date(aimed))/60000); if(Number.isFinite(d)&&d>0) delayMin=d; } const cancelled=/cancel|annul|supprim/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase()); return { lineId,dest,expected,aimed,minutes,delayMin,cancelled,timeStr: expected? new Date(expected).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'' }; }); }

function renderBoard(container,groups){
  groups=[...groups].sort((a,b)=>{ if(a.lineId==='A'&&b.lineId!=='A') return -1; if(a.lineId!=='A'&&b.lineId==='A') return 1; if(a.lineId===b.lineId) return (a.direction||'').localeCompare(b.direction||''); return (''+a.lineId).localeCompare(''+b.lineId,'fr',{numeric:true}); });
  container.innerHTML='';
  if(!groups.length){ container.appendChild(el('div','placeholder','Aucune donnée.')); return; }
  groups.forEach(g=>{
    const group=el('div','group');
    const head=el('div','group-head'); head.style.borderBottom='1px dashed #e5e7eb'; head.style.paddingBottom='6px';
    const pill=el('div','pill '+(g.mode==='rer-a'?'rer-a':'bus'), g.mode==='rer-a'?'A':g.lineId); pill.style.background=colorFor(g);
    const dir=el('div','dir', g.direction||''); head.append(pill,dir); group.appendChild(head);

    if(!g.trips?.length){
      const none=el('div','row no-service');
      none.append(el('div','wait', `<div class="minutes">–</div><div class="label"></div>`));
      none.append(el('div','info', `<div class="dest">Pas de passage prévu</div><div class="via">Service en cours</div>`));
      none.append(el('div','meta', `<div class="clock"></div><div class="status termine">Théorique</div>`));
      group.appendChild(none);
    } else {
      g.trips.slice(0,3).forEach(t=>{
        const row=el('div','row');
        const wait=el('div','wait', `<div class="minutes">${t.waitMin!=null? String(t.waitMin):''}</div><div class="label">min</div>`);
        const info=el('div','info', `<div class="dest">${t.dest||''}</div>`);
        const aimedStr=t.aimed? new Date(t.aimed).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
        const clockHTML = t.delayMin>0? `<span class="aimed">${aimedStr}</span><span class="expected">${t.timeStr||''}</span>` : `<span class="expected">${t.timeStr||''}</span>`;
        const meta=el('div','meta', `<div class="clock">${clockHTML}</div>`);
        if(t.cancelled){ meta.appendChild(el('div','status supprime','Supprimé')); }
        else if(t.delayMin>0){ meta.appendChild(el('div','status retard', `Retard +${t.delayMin}`)); }
        row.append(wait,info,meta); group.appendChild(row);
      });
    }
    container.appendChild(group);
  });
}

// Affectations lignes par arrêt (corrigées)
const STATIC_LINES={
  'col-joinville-rer-a':[
    {lineId:'A',mode:'rer-a',direction:'Vers Paris / La Défense'},
    {lineId:'A',mode:'rer-a',direction:'Vers Boissy‑Saint‑Léger'},
    {lineId:'77',mode:'bus',direction:'Direction Joinville RER'},
    {lineId:'101',mode:'bus',direction:''}, {lineId:'106',mode:'bus',direction:''}, {lineId:'108',mode:'bus',direction:''}, {lineId:'110',mode:'bus',direction:''}, {lineId:'112',mode:'bus',direction:''}, {lineId:'201',mode:'bus',direction:''}, {lineId:'281',mode:'bus',direction:''}, {lineId:'317',mode:'bus',direction:''}, {lineId:'N33',mode:'bus',direction:'Noctilien'}
  ],
  'col-hpv-77': [
    {lineId:'77',mode:'bus',direction:'Direction Joinville RER'},
    {lineId:'77',mode:'bus',direction:'Direction Plateau de Gravelle'},
    {lineId:'111',mode:'bus',direction:''}, {lineId:'112',mode:'bus',direction:''}, {lineId:'201',mode:'bus',direction:''}
  ],
  'col-breuil-77-201': [
    {lineId:'77',mode:'bus',direction:'Direction Joinville RER'},
    {lineId:'201',mode:'bus',direction:'Direction Porte Dorée'},
    {lineId:'112',mode:'bus',direction:''}
  ]
};

const LINE_CODES={'77':'C01399','201':'C01219','A':'C01742','101':'C01260','106':'C01371','108':'C01374','110':'C01376','112':'C01379','111':'C01377','281':'C01521','317':'C01693','N33':'C01833'};

async function loadTransportData(){
  const [rerData,hippoData,breuilData]=await Promise.all([
    fetchStopData(STOP_IDS.RER_A),
    fetchStopData(STOP_IDS.HIPPODROME),
    fetchStopData(STOP_IDS.BREUIL)
  ]);

  function mergeStatic(staticLines, real) {
    return staticLines.map(st => {
      const c=LINE_CODES[st.lineId];
      const live = real.filter(v=> v.lineId===c).map(v=>({
        waitMin:v.minutes,timeStr:v.timeStr,dest:v.dest,delayMin:v.delayMin,cancelled:v.cancelled,aimed:v.aimed
      }));
      return {...st,trips: live.slice(0,3), hasRealTimeData: live.length>0};
    });
  }

  const dataByCol={
    'col-joinville-rer-a': mergeStatic(STATIC_LINES['col-joinville-rer-a'], rerData),
    'col-hpv-77': mergeStatic(STATIC_LINES['col-hpv-77'], hippoData),
    'col-breuil-77-201': mergeStatic(STATIC_LINES['col-breuil-77-201'], breuilData)
  };

  Object.keys(dataByCol).forEach(colId=>{ const cont=qs('#'+colId+' .board'); if(cont) renderBoard(cont, dataByCol[colId]); });
}

function applyResponsive(){
  const root=document.documentElement;
  const isLandscape= window.matchMedia('(orientation: landscape)').matches;
  root.style.setProperty('--base-font', isLandscape? 'clamp(12px,1.0vw,16px)':'clamp(12px,1.2vw,16px)');
}

async function init(){
  setClock(); setInterval(setClock,30_000);
  applyResponsive(); window.addEventListener('resize',applyResponsive);
  await Promise.allSettled([loadTrafficMessages(),loadTransportData()]);
  setInterval(loadTransportData, 60_000);
  setInterval(loadTrafficMessages, 300_000);
}

init().catch(console.error);
