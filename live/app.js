/* ===============================
   Dashboard Hippodrome – Panneau public IDFM complet (horizontal times)
   =============================== */

// Utiliser un proxy CORS plus fiable
const PROXY = "https://cors-anywhere.herokuapp.com/";
// Alternative: const PROXY = "https://api.allorigins.win/raw?url=";

const APIS = {
  WEATHER: "https://api.open-meteo.com/v1/forecast?latitude=48.83&longitude=2.42&current_weather=true",
  SAINT: "https://nominis.cef.fr/json/nominis.php",
  RSS: "https://www.francetvinfo.fr/titres.rss",
  PRIM_STOP: (stopId, lineCode) => {
    const base = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`;
    return lineCode ? `${base}&LineRef=STIF:Line::${lineCode}:` : base;
  },
  PRIM_GM: (cCode) => `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=STIF:Line::${cCode}:`,
  PMU: (day) => `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${day}`,
  VELIB: (station) => `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${station}&limit=1`
};

const STOP_IDS = { 
  JOINVILLE_RER: "STIF:StopArea:SP:43135:", 
  HIPPODROME: "STIF:StopArea:SP:463641:", 
  BREUIL: "STIF:StopArea:SP:463644:" 
};

const qs = (s, el=document) => el.querySelector(s);
const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; };

function banner(msg){ const host=document.getElementById('prim-messages'); if(!host) return; host.prepend(el('div','message critical', msg)); }

async function fetchAPI(url, timeout=15000){ 
  const c=new AbortController(); 
  const t=setTimeout(()=>c.abort(),timeout); 
  try{ 
    const proxyUrl = url.startsWith('http') ? PROXY + encodeURIComponent(url) : url;
    console.log('Fetching:', proxyUrl); // Debug log
    const r=await fetch(proxyUrl,{signal:c.signal}); 
    clearTimeout(t); 
    if(!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); 
    const ct=r.headers.get('content-type')||''; 
    const result = ct.includes('application/json')? await r.json(): await r.text();
    console.log('API Response for', url, ':', result); // Debug log
    return result;
  }catch(e){ 
    clearTimeout(t); 
    console.error('fetchAPI failed:',url,e.message); 
    banner(`Erreur API: ${e.message} (${url})`); 
    return null; 
  }
}

const clean=(s="")=>s.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const minutesFromISO=(iso)=> iso? Math.max(0,Math.round((new Date(iso).getTime()-Date.now())/60000)):null;

const COLORS={ 
  modes:{bus:'#0055c3','rer-a':'#e2223b'}, 
  lines:{'77':'#0055c3','201':'#0055c3','A':'#e2223b','101':'#0055c3','106':'#0055c3','108':'#0055c3','110':'#0055c3','112':'#0055c3','111':'#0055c3','281':'#0055c3','317':'#0055c3','N33':'#662d91'} 
};
const colorFor=(g)=> COLORS.lines[g.lineId]||COLORS.modes[g.mode]||'#0055c3';

function setClock(){ const d=new Date(); qs('#datetime').textContent=`${d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} – ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`; }

async function loadWeather(){ const d=await fetchAPI(APIS.WEATHER); const t=d?.current_weather?.temperature; qs('#weather').textContent=Number.isFinite(t)? `${Math.round(t)}°C`:'–'; }
async function loadSaint(){ const d=await fetchAPI(APIS.SAINT); const p=d?.response?.prenom||d?.response?.prenoms?.[0]; qs('#saint').textContent=p? `Saint ${p}`:'Saint du jour'; }

async function loadTrafficMessages(){ 
  const lines=[{label:'RER A',code:'C01742'},{label:'Bus 77',code:'C01399'},{label:'Bus 201',code:'C01219'}]; 
  const out=[]; 
  for(const {label,code} of lines){ 
    const d=await fetchAPI(APIS.PRIM_GM(code)); 
    if(!d?.Siri?.ServiceDelivery) continue; 
    const dels=d.Siri.ServiceDelivery.GeneralMessageDelivery||[]; 
    dels.forEach(x=> (x.InfoMessage||[]).forEach(m=>{ 
      const txt=clean(m?.Content?.Message?.[0]?.MessageText?.[0]?.value||""); 
      if(txt) out.push({label,txt,sev:m?.Content?.Severity||'info'}); 
    })); 
  } 
  const box=qs('#prim-messages'); 
  box.innerHTML=''; 
  if(!out.length) { 
    box.appendChild(el('div','message info', '✅ Aucune perturbation signalée sur le réseau')); 
  } else { 
    out.slice(0,3).forEach(i=> box.appendChild(el('div',`message ${i.sev}`, `<strong>${i.label}:</strong> ${i.txt}`))); 
  } 
}

async function fetchStopData(stopId, lineCode = null){ 
  const url = lineCode ? APIS.PRIM_STOP(stopId, lineCode) : APIS.PRIM_STOP(stopId);
  const d=await fetchAPI(url); 
  if (!d || !d.Siri) {
    console.warn('No SIRI data received for stop:', stopId);
    return [];
  }
  const vs=d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit||[]; 
  console.log(`Found ${vs.length} vehicles for stop ${stopId}`);
  return vs.map(v=>{ 
    const mv=v.MonitoredVehicleJourney||{}; 
    const call=mv.MonitoredCall||{}; 
    const lineRef=mv.LineRef?.value||mv.LineRef||''; 
    // Extraire l'ID de ligne correctement
    const lineMatch = lineRef.match(/STIF:Line::([^:]+):/);
    const lineId = lineMatch ? lineMatch[1] : lineRef;
    const dest=clean(call.DestinationDisplay?.[0]?.value||''); 
    const expected=call.ExpectedDepartureTime||call.ExpectedArrivalTime||null; 
    const aimed=call.AimedDepartureTime||call.AimedArrivalTime||null; 
    const minutes=minutesFromISO(expected); 
    let delayMin=null; 
    if(expected&&aimed){ 
      const d=Math.round((new Date(expected)-new Date(aimed))/60000); 
      if(Number.isFinite(d)&&d>0) delayMin=d; 
    } 
    const cancelled=/cancel|annul|supprim/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase()); 
    const atStop=/at.stop|quai|imminent/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase()); 
    return { 
      lineId,
      dest,
      expected,
      aimed,
      minutes,
      delayMin,
      cancelled,
      atStop,
      timeStr: expected? new Date(expected).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'' 
    }; 
  }).filter(trip => trip.minutes !== null && trip.minutes >= 0); // Filtrer les horaires invalides
}

// Import helper horizontal
async function loadHorizontalHelper(){ 
  if(!window.renderHorizontalTimes){ 
    const s=document.createElement('script'); 
    s.src='partials/horizontal-timeline.js'; 
    document.head.appendChild(s); 
    await new Promise(res=> s.onload=res); 
  } 
}

function renderHorizontalTimes(trips){ 
  return window.renderHorizontalTimes? window.renderHorizontalTimes(trips) : ''; 
}

function renderBoard(container, groups){ 
  if (!container) return; 
  groups=[...groups].sort((a,b)=>{ 
    if(a.lineId==='A'&&b.lineId!=='A') return -1; 
    if(a.lineId!=='A'&&b.lineId==='A') return 1; 
    if(a.lineId===b.lineId) return (a.direction||'').localeCompare(b.direction||''); 
    return (''+a.lineId).localeCompare(''+b.lineId,'fr',{numeric:true}); 
  }); 
  container.innerHTML=''; 
  if(!groups.length) {
    container.appendChild(el('div','group', '<div class="row"><div class="info"><div class="dest">Aucune donnée transport disponible</div></div></div>'));
    return;
  }
  groups.forEach(g=>{ 
    const group=el('div','group'); 
    const head=el('div','group-head'); 
    const pill=el('div',`pill ${g.mode==='rer-a'?'rer-a':'bus'}`, g.mode==='rer-a'?'A':g.lineId); 
    pill.style.background=colorFor(g); 
    const dir=el('div','dir', g.direction || g.dest || ''); 
    head.append(pill,dir); 
    group.appendChild(head); 
    const block=el('div','row'); 
    block.innerHTML = renderHorizontalTimes(g.trips||[]); 
    group.appendChild(block); 
    container.appendChild(group); 
  }); 
}

// LIGNES PAR ARRÊT avec codes corrigés
const STATIC_LINES={ 
  'rer-a': [
    {lineId:'A',mode:'rer-a',direction:'Vers Paris / La Défense', cCode:'C01742'}, 
    {lineId:'A',mode:'rer-a',direction:'Vers Boissy‑Saint‑Léger', cCode:'C01742'}
  ], 
  'joinville-bus': [
    {lineId:'77',mode:'bus', cCode:'C01399'},
    {lineId:'101',mode:'bus', cCode:'C01260'},
    {lineId:'106',mode:'bus', cCode:'C01371'},
    {lineId:'108',mode:'bus', cCode:'C01374'},
    {lineId:'110',mode:'bus', cCode:'C01376'},
    {lineId:'112',mode:'bus', cCode:'C01379'},
    {lineId:'201',mode:'bus', cCode:'C01219'},
    {lineId:'281',mode:'bus', cCode:'C01521'},
    {lineId:'317',mode:'bus', cCode:'C01693'},
    {lineId:'N33',mode:'bus', cCode:'C01833'}
  ], 
  'hippodrome': [
    {lineId:'77',mode:'bus',direction:'Direction Joinville RER', cCode:'C01399'},
    {lineId:'77',mode:'bus',direction:'Direction Plateau de Gravelle', cCode:'C01399'},
    {lineId:'111',mode:'bus', cCode:'C01377'},
    {lineId:'112',mode:'bus', cCode:'C01379'},
    {lineId:'201',mode:'bus', cCode:'C01219'}
  ], 
  'breuil': [
    {lineId:'77',mode:'bus',direction:'Direction Joinville RER', cCode:'C01399'},
    {lineId:'201',mode:'bus',direction:'Direction Porte Dorée', cCode:'C01219'},
    {lineId:'112',mode:'bus', cCode:'C01379'}
  ] 
};

async function loadTransportData(){ 
  await loadHorizontalHelper(); 
  console.log('Loading transport data...');
  
  const [joinvilleData, hippoData, breuilData] = await Promise.all([ 
    fetchStopData(STOP_IDS.JOINVILLE_RER), 
    fetchStopData(STOP_IDS.HIPPODROME), 
    fetchStopData(STOP_IDS.BREUIL) 
  ]); 
  
  console.log('Transport data loaded:', {joinvilleData, hippoData, breuilData});
  
  function mergeStaticWithRealtime(staticLines, realTimeData) { 
    return staticLines.map(st => { 
      const liveTrips = realTimeData.filter(v => v.lineId === st.cCode);
      console.log(`Line ${st.lineId} (${st.cCode}): found ${liveTrips.length} live trips`);
      
      if(liveTrips.length > 0) { 
        return { 
          ...st, 
          trips: liveTrips.slice(0, 3).map(v => ({ 
            waitMin: v.minutes, 
            timeStr: v.timeStr, 
            aimed: v.aimed, 
            dest: v.dest, 
            delayMin: v.delayMin, 
            cancelled: v.cancelled, 
            atStop: v.atStop 
          })), 
          hasRealTimeData: true 
        }; 
      } else { 
        const theoretical = generateTheoretical(st.lineId); 
        return { 
          ...st, 
          trips: theoretical.slice(0, 3).map(th => ({ 
            waitMin: th.waitMin, 
            timeStr: th.aimedTime, 
            aimed: th.aimed, 
            dest: th.dest, 
            delayMin: 0, 
            cancelled: false, 
            atStop: false 
          })), 
          hasRealTimeData: false 
        }; 
      } 
    }); 
  } 
  
  const rerGroups = mergeStaticWithRealtime(STATIC_LINES['rer-a'], joinvilleData); 
  renderBoard(qs('#board-rer-a'), rerGroups); 
  
  const joinvilleBusGroups = mergeStaticWithRealtime(STATIC_LINES['joinville-bus'], joinvilleData); 
  renderBoard(qs('#board-joinville-bus'), joinvilleBusGroups); 
  
  const hippoGroups = mergeStaticWithRealtime(STATIC_LINES['hippodrome'], hippoData); 
  renderBoard(qs('#board-hippodrome'), hippoGroups); 
  
  const breuilGroups = mergeStaticWithRealtime(STATIC_LINES['breuil'], breuilData); 
  renderBoard(qs('#board-breuil'), breuilGroups); 
}

// Théorique
function generateTheoretical(lineId, now=new Date()){ 
  const base=now.getTime(); 
  const freq={'A':4,'77':6,'201':8,'101':12,'106':10,'108':9,'110':11,'112':15,'111':13,'281':18,'317':20,'N33':30}[lineId]||10; 
  const trips=[]; 
  for(let i=0;i<6;i++){ 
    const offset=freq*i*60*1000 + (Math.random()-0.5)*120*1000; 
    if(offset>2*60*60*1000) break; 
    const aimedTime=new Date(base+offset); 
    trips.push({ 
      aimed: aimedTime.toISOString(), 
      aimedTime: aimedTime.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), 
      waitMin: Math.round(offset/60000), 
      dest: getDestination(lineId, i) 
    }); 
  } 
  return trips.filter(t=>t.waitMin>=0&&t.waitMin<=120); 
}

function getDestination(lineId, index){ 
  const map={
    'A': index%2?'Boissy-Saint-Léger':'La Défense - Châtelet',
    '77': index%2?'Joinville RER':'Plateau de Gravelle',
    '201': index%2?'Champigny la Plage':'Porte Dorée',
    '101':'Château de Vincennes',
    '106':'Créteil Université',
    '108':'Maisons-Alfort',
    '110':'Créteil Préfecture',
    '112':'École du Breuil',
    '111':'République',
    '281':'Torcy RER',
    '317':'Val-de-Fontenay',
    'N33':'Château de Vincennes'
  }; 
  return map[lineId]||`Terminus ${lineId}`; 
}

async function loadNews(){ 
  const xml=await fetchAPI(APIS.RSS); 
  if(!xml) return qs('#news').textContent='Actualités indisponibles'; 
  const doc=new DOMParser().parseFromString(xml,'application/xml'); 
  const nodes=[...doc.querySelectorAll('item')].slice(0,6); 
  qs('#news').innerHTML=nodes.length? nodes.map(n=>`<div class="news-item"><strong>${clean(n.querySelector('title')?.textContent||'')}</strong></div>`).join('') : 'Aucune actualité'; 
}

async function loadVelib(){ 
  const [d1,d2]=await Promise.all([fetchAPI(APIS.VELIB('12163')),fetchAPI(APIS.VELIB('12128'))]); 
  const v1=d1?.results?.[0]; 
  if(v1) qs('#velib-vincennes').textContent=`${v1.numbikesavailable||0} vélos – ${v1.numdocksavailable||0} libres`; 
  const v2=d2?.results?.[0]; 
  if(v2) qs('#velib-breuil').textContent=`${v2.numbikesavailable||0} vélos – ${v2.numdocksavailable||0} libres`; 
}

async function loadCourses(){ 
  const today = new Date(); 
  const day = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`; 
  const data = await fetchAPI(APIS.PMU(day)); 
  const vin=[],eng=[]; 
  (data?.programme?.reunions||[]).forEach(r=>{ 
    const hip=r.hippodrome?.code; 
    const list=hip==='VIN'?vin:hip==='ENG'?eng:null; 
    if(!list) return; 
    (r.courses||[]).slice(0,4).forEach(c=>{ 
      const ts=Date.parse(c.heureDepart); 
      if(ts>Date.now()) list.push(`<strong>${new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</strong> - ${c.libelle||'Course'} (${c.numOrdre?`C${c.numOrdre}`:''})`); 
    }); 
  }); 
  qs('#races-vincennes').innerHTML=vin.length? vin.join('<br>') :'Aucune course aujourd\'hui'; 
  qs('#races-enghien').innerHTML=eng.length? eng.join('<br>') :'Aucune course aujourd\'hui'; 
}

let pollInterval=60_000; 
function adaptPolling(){ 
  const h=new Date().getHours(); 
  if(h>=6&&h<=9||h>=17&&h<=20) pollInterval=45_000; 
  else if(h>=22||h<=5) pollInterval=300_000; 
  else pollInterval=90_000; 
}

let transportTimer; 
function scheduleTransportRefresh(){ 
  clearTimeout(transportTimer); 
  transportTimer=setTimeout(()=>{ 
    loadTransportData().then(scheduleTransportRefresh); 
  }, pollInterval); 
}

async function init(){ 
  console.log('Initializing dashboard...');
  setClock(); 
  setInterval(setClock,30_000); 
  adaptPolling(); 
  setInterval(adaptPolling, 10*60_000); 
  
  await Promise.allSettled([ 
    loadWeather(),
    loadSaint(),
    loadTrafficMessages(),
    loadTransportData(),
    loadNews(),
    loadVelib(),
    loadCourses() 
  ]); 
  
  scheduleTransportRefresh(); 
  setInterval(loadTrafficMessages, 300_000); 
  setInterval(()=>Promise.allSettled([loadNews(),loadVelib(),loadCourses()]), 600_000); 
}

init().catch(console.error);