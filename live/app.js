/* ===============================
   Dashboard Hippodrome – Live avec APIs PRIM (version corrigée finale)
   =============================== */

const PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

const APIS = {
  WEATHER: "https://api.open-meteo.com/v1/forecast?latitude=48.83&longitude=2.42&current_weather=true",
  SAINT: "https://nominis.cef.fr/json/nominis.php",
  RSS: "https://www.francetvinfo.fr/titres.rss",
  PRIM_STOP: (stopId) => `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`,
  PRIM_GM: (lineId) => `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=line:IDFM:${lineId}`,
  PMU: (day) => `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${day}`,
  VELIB: (station) => `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${station}&limit=1`
};

const STOP_IDS = {
  RER_A: "STIF:StopArea:SP:43135:",
  HIPPODROME: "STIF:StopArea:SP:463641:",
  BREUIL: "STIF:StopArea:SP:463644:"
};

const VELIB_STATIONS = { VINCENNES: "12104", BREUIL: "12115" };

const qs = (s, el=document) => el.querySelector(s);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt!=null) n.textContent = txt; return n; };

// Bannière d'erreur visible
function banner(msg){
  const host = document.getElementById('prim-messages');
  if (!host) return;
  const n = el('div','message critical', msg);
  host.prepend(n);
}

async function fetchAPI(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const finalUrl = url.startsWith(PROXY) ? url : PROXY + encodeURIComponent(url);
    const resp = await fetch(finalUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json') ? await resp.json() : await resp.text();
  } catch (e) {
    clearTimeout(timer);
    console.warn('fetchAPI failed:', url, e.message);
    banner(`Erreur API (${e.message}) sur ${url.split('/')[2]}`);
    return null;
  }
}

const clean = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const minutesFromISO = (iso) => iso ? Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000)) : null;

const COLORS = { modes: { 'bus': '#0aa3df', 'rer-a': '#e5003a' }, lines: { '77': '#0aa3df','201': '#0aa3df','A': '#e5003a' } };
const colorFor = (g) => COLORS.lines[g.lineId] || COLORS.modes[g.mode] || '#0aa3df';

function setClock() {
  const d = new Date();
  qs('#datetime').textContent = `${d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })} — ${d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}`;
}

async function loadWeather() {
  const data = await fetchAPI(APIS.WEATHER);
  const temp = data?.current_weather?.temperature;
  qs('#weather').textContent = Number.isFinite(temp) ? `${Math.round(temp)}°C` : '—';
}

async function loadSaint() {
  const data = await fetchAPI(APIS.SAINT);
  const prenom = data?.response?.prenom || data?.response?.prenoms?.[0];
  qs('#saint').textContent = prenom ? `Saint ${prenom}` : 'Saint du jour';
}

async function loadTrafficMessages() {
  const lineRefs = ['C01399','C01219','C01742'];
  const messages = [];
  for (const ref of lineRefs) {
    const data = await fetchAPI(APIS.PRIM_GM(ref));
    const deliveries = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery || [];
    deliveries.forEach((d) => (d.InfoMessage||[]).forEach((m) => {
      const txt = clean(m?.Content?.Message?.[0]?.MessageText?.[0]?.value || "");
      if (txt) messages.push(txt);
    }));
  }
  setPrimMessages(messages);
}

function setPrimMessages(msgs=[]) {
  const box = qs('#prim-messages');
  box.innerHTML = '';
  if (!msgs.length) return box.appendChild(el('div','message','Aucun message trafic.'));
  msgs.forEach(m => box.appendChild(el('div','message info', typeof m==='string'? m : m.text)));
}

async function fetchStopData(stopId) {
  const data = await fetchAPI(APIS.PRIM_STOP(stopId));
  const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
  return visits.map((v) => {
    const mv = v.MonitoredVehicleJourney||{}; const call = mv.MonitoredCall||{};
    const lineRef = mv.LineRef?.value || mv.LineRef || '';
    const lineId = (lineRef.match(/C\d{5}/)||[null])[0];
    const dest = clean(call.DestinationDisplay?.[0]?.value || '');
    const expected = call.ExpectedDepartureTime || call.ExpectedArrivalTime || null;
    const aimed = call.AimedDepartureTime || call.AimedArrivalTime || null;
    const minutes = minutesFromISO(expected);
    let delayMin = null; if (expected&&aimed){ const d = Math.round((new Date(expected)-new Date(aimed))/60000); if (Number.isFinite(d)&&d>0) delayMin=d; }
    const cancelled = /cancel|annul|supprim/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase());
    return { lineId, dest, expected, minutes, delayMin, cancelled, timeStr: expected ? new Date(expected).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '' };
  });
}

async function loadNews(){
  const xml = await fetchAPI(APIS.RSS);
  if (!xml) return qs('#news').textContent = 'Actualités indisponibles';
  const doc = new DOMParser().parseFromString(xml,'application/xml');
  const nodes = [...doc.querySelectorAll('item, entry')].slice(0,5);
  if (!nodes.length) return qs('#news').textContent = 'Aucune actualité trouvée';
  qs('#news').innerHTML = nodes.map(n=>`<div class="news-item"><strong>${clean(n.querySelector('title')?.textContent||'')}</strong></div>`).join('');
}

async function loadVelib(){
  const [d1, d2] = await Promise.all([ fetchAPI(APIS.VELIB(VELIB_STATIONS.VINCENNES)), fetchAPI(APIS.VELIB(VELIB_STATIONS.BREUIL)) ]);
  const v1 = d1?.results?.[0]; if (v1) qs('#velib-vincennes').textContent = `${v1.numbikesavailable||0} vélos – ${v1.numdocksavailable||0} libres`;
  const v2 = d2?.results?.[0]; if (v2) qs('#velib-breuil').textContent = `${v2.numbikesavailable||0} vélos – ${v2.numdocksavailable||0} libres`;
}

async function loadCourses(){
  const d = new Date(); const day = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;
  const data = await fetchAPI(APIS.PMU(day));
  const vin=[], eng=[]; (data?.programme?.reunions||[]).forEach((r)=>{ const hip=r.hippodrome?.code; const list= hip==='VIN'?vin: hip==='ENG'?eng: null; if(!list) return; (r.courses||[]).forEach((c)=>{ const ts=Date.parse(c.heureDepart); if(Number.isFinite(ts)&&ts>Date.now()) list.push({heure:new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), lib:c.libelle, ref:`R${r.numOfficiel||''}C${c.numOrdre||''}`}); });});
  qs('#races-vincennes').innerHTML = vin.length? vin.slice(0,3).map(c=>`${c.heure} - ${c.lib} (${c.ref})`).join('<br>') : 'Aucune course prévue';
  qs('#races-enghien').innerHTML = eng.length? eng.slice(0,3).map(c=>`${c.heure} - ${c.lib} (${c.ref})`).join('<br>') : 'Aucune course prévue';
}

function renderBoard(container, groups){
  groups=[...groups].sort((a,b)=> a.lineId===b.lineId? (a.direction||'').localeCompare(b.direction||'') : (''+a.lineId).localeCompare(''+b.lineId,'fr',{numeric:true}));
  container.innerHTML=''; if(!groups.length){ container.appendChild(el('div','placeholder','Aucune donnée disponible pour le moment.')); return; }
  groups.forEach(g=>{ const group=el('div','group'); const head=el('div','group-head'); head.style.borderBottom='1px dashed #e5e7eb'; head.style.paddingBottom='8px'; const pill=el('div','pill '+(g.mode==='rer-a'?'rer-a':'bus'), g.mode==='rer-a'?'A':g.lineId); pill.style.background=colorFor(g); const dir=el('div','dir', g.direction||''); head.append(pill,dir); group.appendChild(head); if(!g.trips?.length){ const none=el('div','row'); const w=el('div','wait'); w.append(el('div','minutes',''), el('div','label','attente')); const info=el('div','info'); info.append(el('div','dest','Aucun départ pour l\'instant'), el('div','via','')); const meta=el('div','meta'); meta.append(el('div','clock',''), el('div','status termine','Service terminé')); none.append(w,info,meta); group.appendChild(none);} else { g.trips.slice(0,3).forEach(t=>{ const row=el('div','row'); const wait=el('div','wait'); wait.append(el('div','minutes', t.waitMin!=null? String(t.waitMin):''), el('div','label','min')); const info=el('div','info'); info.append(el('div','dest', t.dest||'')); info.append(el('div','via', t.via? `via ${t.via}`:'')); const meta=el('div','meta'); meta.append(el('div','clock', t.timeStr||'')); if(t.status){ const map={retard:`Retard +${t.delayMin??0}`, supprime:'Supprimé', nondesservi:'Non desservi', deplace:'Arrêt déplacé', premier:'Premier', dernier:'Dernier', termine:'Service terminé'}; meta.append(el('div','status '+t.status, map[t.status]||'')); } row.append(wait,info,meta); group.appendChild(row); }); } container.appendChild(group); });
}

const EXPECTED={
  'col-hpv-77':[ {lineId:'77',mode:'bus',direction:'Direction Joinville RER'}, {lineId:'77',mode:'bus',direction:'Direction Plateau de Gravelle'} ],
  'col-breuil-77-201':[ {lineId:'77',mode:'bus',direction:'Direction Joinville RER'}, {lineId:'201',mode:'bus',direction:'Direction Porte Dorée'} ],
  'col-joinville-rer-a':[ {lineId:'A',mode:'rer-a',direction:'Vers Paris / La Défense'}, {lineId:'A',mode:'rer-a',direction:'Vers Boissy‑Saint‑Léger'} ]
};

// CORRECTION PRINCIPALE: breuilData au lieu de breuil
async function loadTransportData(){
  const [rerData, hippoData, breuilData] = await Promise.all([
    fetchStopData(STOP_IDS.RER_A),
    fetchStopData(STOP_IDS.HIPPODROME),
    fetchStopData(STOP_IDS.BREUIL)
  ]);

  const rerByDir=new Map();
  rerData.forEach(v=>{ if(v.lineId!=='A') return; const key= v.dest.toLowerCase().includes('boissy')?'boissy':'paris'; if(!rerByDir.has(key)) rerByDir.set(key,[]); rerByDir.get(key).push({ waitMin:v.minutes, timeStr:v.timeStr, dest:v.dest, status: v.cancelled? 'supprime' : (v.delayMin>0? 'retard': null), delayMin:v.delayMin }); });
  const rerGroups=[...rerByDir.entries()].map(([key,trips])=>({ lineId:'A', mode:'rer-a', direction: key==='boissy'? 'Vers Boissy‑Saint‑Léger' : 'Vers Paris / La Défense', trips: trips.slice(0,3) }));

  const hippoByDir=new Map();
  hippoData.filter(v=>v.lineId==='C01399').forEach(v=>{ const key=v.dest.toLowerCase().includes('joinville')?'joinville':'gravelle'; if(!hippoByDir.has(key)) hippoByDir.set(key,[]); hippoByDir.get(key).push({ waitMin:v.minutes, timeStr:v.timeStr, dest:v.dest, status: v.cancelled? 'supprime' : (v.delayMin>0?'retard':null), delayMin:v.delayMin }); });
  const hippoGroups=[...hippoByDir.entries()].map(([key,trips])=>({ lineId:'77', mode:'bus', direction: key==='joinville'? 'Direction Joinville RER':'Direction Plateau de Gravelle', trips: trips.slice(0,3) }));

  // CORRECTION: breuilData au lieu de breuil
  const breuilGroups=[];
  const breuil77=breuilData.filter(v=>v.lineId==='C01399');
  const breuil201=breuilData.filter(v=>v.lineId==='C01219');
  if (breuil77.length) breuilGroups.push({ lineId:'77', mode:'bus', direction:'Direction Joinville RER', trips: breuil77.slice(0,3).map(v=>({waitMin:v.minutes,timeStr:v.timeStr,dest:v.dest,status:v.cancelled?'supprime':(v.delayMin>0?'retard':null),delayMin:v.delayMin}))});
  if (breuil201.length) breuilGroups.push({ lineId:'201', mode:'bus', direction:'Direction Porte Dorée', trips: breuil201.slice(0,3).map(v=>({waitMin:v.minutes,timeStr:v.timeStr,dest:v.dest,status:v.cancelled?'supprime':(v.delayMin>0?'retard':null),delayMin:v.delayMin}))});

  const dataByCol={ 'col-joinville-rer-a': rerGroups, 'col-hpv-77': hippoGroups, 'col-breuil-77-201': breuilGroups };
  Object.keys(EXPECTED).forEach(colId=>{ const expected=EXPECTED[colId]; const current=dataByCol[colId]||[]; const merged=[]; expected.forEach(exp=>{ const f=current.find(g=>g.lineId===exp.lineId && g.mode===exp.mode && g.direction===exp.direction); merged.push(f? f : {...exp, trips:[]} ); }); const cont=qs('#'+colId+' .board'); if(cont) renderBoard(cont, merged); });
}

async function fetchStopData(stopId) {
  const data = await fetchAPI(APIS.PRIM_STOP(stopId));
  const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
  return visits.map((v) => {
    const mv = v.MonitoredVehicleJourney||{}; const call = mv.MonitoredCall||{};
    const lineRef = mv.LineRef?.value || mv.LineRef || '';
    const lineId = (lineRef.match(/C\d{5}/)||[null])[0];
    const dest = clean(call.DestinationDisplay?.[0]?.value || '');
    const expected = call.ExpectedDepartureTime || call.ExpectedArrivalTime || null;
    const aimed = call.AimedDepartureTime || call.AimedArrivalTime || null;
    const minutes = minutesFromISO(expected);
    let delayMin = null; if (expected&&aimed){ const d = Math.round((new Date(expected)-new Date(aimed))/60000); if (Number.isFinite(d)&&d>0) delayMin=d; }
    const cancelled = /cancel|annul|supprim/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase());
    return { lineId, dest, expected, minutes, delayMin, cancelled, timeStr: expected ? new Date(expected).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '' };
  });
}

async function loadNews(){
  const xml = await fetchAPI(APIS.RSS);
  if (!xml) return qs('#news').textContent = 'Actualités indisponibles';
  const doc = new DOMParser().parseFromString(xml,'application/xml');
  const nodes = [...doc.querySelectorAll('item, entry')].slice(0,5);
  if (!nodes.length) return qs('#news').textContent = 'Aucune actualité trouvée';
  qs('#news').innerHTML = nodes.map(n=>`<div class="news-item"><strong>${clean(n.querySelector('title')?.textContent||'')}</strong></div>`).join('');
}

async function loadVelib(){
  const [d1, d2] = await Promise.all([ fetchAPI(APIS.VELIB(VELIB_STATIONS.VINCENNES)), fetchAPI(APIS.VELIB(VELIB_STATIONS.BREUIL)) ]);
  const v1 = d1?.results?.[0]; if (v1) qs('#velib-vincennes').textContent = `${v1.numbikesavailable||0} vélos – ${v1.numdocksavailable||0} libres`;
  const v2 = d2?.results?.[0]; if (v2) qs('#velib-breuil').textContent = `${v2.numbikesavailable||0} vélos – ${v2.numdocksavailable||0} libres`;
}

async function loadCourses(){
  const d = new Date(); const day = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;
  const data = await fetchAPI(APIS.PMU(day));
  const vin=[], eng=[]; (data?.programme?.reunions||[]).forEach((r)=>{ const hip=r.hippodrome?.code; const list= hip==='VIN'?vin: hip==='ENG'?eng: null; if(!list) return; (r.courses||[]).forEach((c)=>{ const ts=Date.parse(c.heureDepart); if(Number.isFinite(ts)&&ts>Date.now()) list.push({heure:new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), lib:c.libelle, ref:`R${r.numOfficiel||''}C${c.numOrdre||''}`}); });});
  qs('#races-vincennes').innerHTML = vin.length? vin.slice(0,3).map(c=>`${c.heure} - ${c.lib} (${c.ref})`).join('<br>') : 'Aucune course prévue';
  qs('#races-enghien').innerHTML = eng.length? eng.slice(0,3).map(c=>`${c.heure} - ${c.lib} (${c.ref})`).join('<br>') : 'Aucune course prévue';
}

function renderBoard(container, groups){
  groups=[...groups].sort((a,b)=> a.lineId===b.lineId? (a.direction||'').localeCompare(b.direction||'') : (''+a.lineId).localeCompare(''+b.lineId,'fr',{numeric:true}));
  container.innerHTML=''; if(!groups.length){ container.appendChild(el('div','placeholder','Aucune donnée disponible pour le moment.')); return; }
  groups.forEach(g=>{ const group=el('div','group'); const head=el('div','group-head'); head.style.borderBottom='1px dashed #e5e7eb'; head.style.paddingBottom='8px'; const pill=el('div','pill '+(g.mode==='rer-a'?'rer-a':'bus'), g.mode==='rer-a'?'A':g.lineId); pill.style.background=colorFor(g); const dir=el('div','dir', g.direction||''); head.append(pill,dir); group.appendChild(head); if(!g.trips?.length){ const none=el('div','row'); const w=el('div','wait'); w.append(el('div','minutes',''), el('div','label','attente')); const info=el('div','info'); info.append(el('div','dest','Aucun départ pour l\'instant'), el('div','via','')); const meta=el('div','meta'); meta.append(el('div','clock',''), el('div','status termine','Service terminé')); none.append(w,info,meta); group.appendChild(none);} else { g.trips.slice(0,3).forEach(t=>{ const row=el('div','row'); const wait=el('div','wait'); wait.append(el('div','minutes', t.waitMin!=null? String(t.waitMin):''), el('div','label','min')); const info=el('div','info'); info.append(el('div','dest', t.dest||'')); info.append(el('div','via', t.via? `via ${t.via}`:'')); const meta=el('div','meta'); meta.append(el('div','clock', t.timeStr||'')); if(t.status){ const map={retard:`Retard +${t.delayMin??0}`, supprime:'Supprimé', nondesservi:'Non desservi', deplace:'Arrêt déplacé', premier:'Premier', dernier:'Dernier', termine:'Service terminé'}; meta.append(el('div','status '+t.status, map[t.status]||'')); } row.append(wait,info,meta); group.appendChild(row); }); } container.appendChild(group); });
}

async function init(){
  setClock(); setInterval(setClock,30_000);
  await Promise.allSettled([ loadWeather(), loadSaint(), loadTrafficMessages(), loadTransportData(), loadNews(), loadVelib(), loadCourses() ]);
  setInterval(loadTransportData, 60_000);
  setInterval(loadTrafficMessages, 300_000);
  setInterval(()=>Promise.allSettled([loadNews(), loadVelib(), loadCourses()]), 600_000);
}

init().catch(console.error);