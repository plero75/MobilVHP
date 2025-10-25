
// ====== Configuration ======
const PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
const PRIM_API_KEY = "7nAc6NHplCJtJ46Qw32QFtefq3TQEYrT";

const STOP_AREAS = {
  JOINVILLE: "STIF:StopArea:SP:43135:",
  JOINVILLE_IDFM: "70640"
};
const LINES_CODE = { RER_A:"C01742", BUS_77:"C02251", BUS_201:"C01219", N33:"C01325" };

const APIS = {
  PRIM_STOP: (stopRef, lineRef=null) => {
    const u = new URL("https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring");
    u.searchParams.set("MonitoringRef", stopRef);
    if(lineRef) u.searchParams.set("LineRef", `STIF:Line::${lineRef}:`);
    return u.toString();
  },
  PRIM_GM: (lineCode) => `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=STIF:Line::${lineCode}:`,
  NAVITIA_LINES: (stopAreaId) => `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/stop_area:IDFM:${stopAreaId}/lines?count=200`,
  NAVITIA_SCHEDULE: (lineCode, stopAreaId, dt) => `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/lines/line:IDFM:${lineCode}/stop_areas/stop_area:IDFM:${stopAreaId}/stop_schedules?from_datetime=${dt}`,
  METEO: (lat=48.835, lon=2.45) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code`,
  FRANCEINFO: () => `https://www.francetvinfo.fr/titres.rss`,
  VELIB_STATUS: () => `https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json`,
  VELIB_INFO: () => `https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json`,
};

const qs = (sel, el=document)=> el.querySelector(sel);
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
function formatHHMM(d){ if(!d) return "—:—"; const date=new Date(d); return date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
function ymdhm(d=new Date()){ const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }

async function fetchAPI(url, timeout=15000){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeout);
  try{
    const isPrim = url.includes("prim.iledefrance-mobilites.fr/marketplace/");
    const finalUrl = PROXY + encodeURIComponent(url);
    const init = isPrim ? { headers: { "apikey": PRIM_API_KEY, "Accept":"application/json" } } : {};
    const resp = await fetch(finalUrl, { ...init, signal: controller.signal });
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if(resp.headers.get('content-type')?.includes('xml')) return await resp.text();
    return await resp.json();
  } finally { clearTimeout(timer); }
}

// News
async function loadNews(){
  try{
    const xml = await fetchAPI(APIS.FRANCEINFO());
    if(typeof xml !== 'string') throw new Error('RSS attendu');
    const items = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/g)].map(m=>m[1]).slice(0,6);
    qs('#news-ticker').textContent = items.join("  •  ");
  }catch{ qs('#news-ticker').textContent = "Actualités indisponibles"; }
}

// Group helper
function groupByDestination(visits){
  const groups={};
  (visits||[]).forEach(v=>{
    const dest=v?.MonitoredVehicleJourney?.DestinationName?.[0]?.value||'—';
    (groups[dest]||(groups[dest]=[])).push(v);
  });
  return groups;
}

async function getRERPlanned(){
  const dt = ymdhm(new Date());
  const data = await fetchAPI(APIS.NAVITIA_SCHEDULE(LINES_CODE.RER_A, STOP_AREAS.JOINVILLE_IDFM, dt));
  try{
    const ss = data?.stop_schedules?.[0];
    const ds = ss?.date_times||[];
    const times = ds.map(x=>x?.date).filter(Boolean);
    times.sort();
    const hh = (t)=> t ? (t.slice(9,11)+':'+t.slice(11,13)) : null;
    return { first: hh(times[0]), next: times.slice(0,4).map(hh) };
  }catch{return {first:null,next:[]};}
}

async function renderRER(){
  const board = qs('#board-rer-a'); board.innerHTML = 'Chargement…';
  try{
    const data = await fetchAPI(APIS.PRIM_STOP(STOP_AREAS.JOINVILLE, LINES_CODE.RER_A));
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    if(!visits.length){
      const planned = await getRERPlanned();
      const msg = planned.first ? `Service terminé — prochain passage à ${planned.first}` : 'Service terminé — prochains horaires indisponibles';
      board.innerHTML = `<div class="row ended">${msg}</div>`; return;
    }
    const groups = groupByDestination(visits);
    board.innerHTML = Object.entries(groups).map(([dest, arr])=>{
      const items = arr.slice(0,4).map(v=>{
        const mvj = v.MonitoredVehicleJourney||{};
        const est = mvj.MonitoredCall?.ExpectedDepartureTime || mvj.MonitoredCall?.ExpectedArrivalTime;
        const sch = mvj.MonitoredCall?.AimedDepartureTime || mvj.MonitoredCall?.AimedArrivalTime;
        const delayMin = est && sch ? Math.round((new Date(est)-new Date(sch))/60000) : 0;
        const immin = est ? ((new Date(est)-Date.now())/60000 < 1.5) : false;
        const cancelled = mvj?.MonitoredCall?.DepartureStatus==='cancelled';
        const aimed = sch ? `<s>${formatHHMM(sch)}</s>` : '';
        const delayTxt = delayMin>0 ? `<span class="delay">+${delayMin} min</span>` : '';
        const imminTxt = immin ? `<span class="imminent">🟢 imminent</span>` : '';
        const cancelTxt = cancelled ? `<span class="cancelled">❌ supprimé</span>` : '';
        return `<div class="cell">${aimed} <strong>${formatHHMM(est)}</strong> ${delayTxt} ${imminTxt} ${cancelTxt}</div>`;
      }).join('');
      return `<div class="dest-group"><div class="dest-head">→ ${dest}</div><div class="cells">${items}</div></div>`;
    }).join('');
  }catch{ board.innerHTML = `<div class="row ended">Données RER indisponibles</div>`; }

  try{
    const d = await fetchAPI(APIS.PRIM_GM(LINES_CODE.RER_A));
    const list = d?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    if(list.length){
      const txt = list.map(x=> (x?.Content?.Message?.[0]?.MessageText?.[0]?.value || '').trim()).filter(Boolean).join(' • ');
      const bar = qs('#traffic-rer-a'); bar.textContent = `⚠️ ${txt}`; bar.classList.remove('hidden');
    }
  }catch{}
}

// Buses
async function discoverBusLines(stopAreaId){
  const data = await fetchAPI(APIS.NAVITIA_LINES(stopAreaId));
  const lines = (data?.lines||[]).map(l=>{
    const id = (l?.id||'').split(':').pop();
    return { id, code: l?.code || id, name: l?.name || l?.label || id };
  });
  return lines.filter(x=>x.id && /^C\\d+/.test(x.id));
}
async function getRealtimeForLine(lineCode){
  const url = APIS.PRIM_STOP(STOP_AREAS.JOINVILLE, lineCode);
  const d = await fetchAPI(url);
  return d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
}
function _ymdhm(d=new Date()){ const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }
async function getPlannedForLine(lineCode, fromDate=new Date()){
  const data = await fetchAPI(APIS.NAVITIA_SCHEDULE(lineCode, STOP_AREAS.JOINVILLE_IDFM, _ymdhm(fromDate)));
  const ss = data?.stop_schedules?.[0];
  const dts = (ss?.date_times||[]).map(x=>x?.date).filter(Boolean);
  const hh = (t)=> t ? (t.slice(9,11)+':'+t.slice(11,13)) : null;
  if(dts.length) return { next: dts.slice(0,4).map(hh), first: hh(dts[0]) };
  const nextDay = new Date(fromDate); nextDay.setDate(nextDay.getDate()+1); nextDay.setHours(0,1,0,0);
  const data2 = await fetchAPI(APIS.NAVITIA_SCHEDULE(lineCode, STOP_AREAS.JOINVILLE_IDFM, _ymdhm(nextDay)));
  const dts2 = (data2?.stop_schedules?.[0]?.date_times||[]).map(x=>x?.date).filter(Boolean);
  return { next: (dts2||[]).slice(0,4).map(hh), first: hh(dts2?.[0]) };
}
function renderBusLineBlock(container, meta, visits){
  const wrap = document.createElement('div');
  wrap.className = 'line-block';
  const title = document.createElement('div');
  title.className = 'line-head';
  title.innerHTML = `🚌 <span class="chip">${meta.code||meta.id}</span> <strong>${meta.name||''}</strong>`;
  wrap.appendChild(title);
  const body = document.createElement('div'); body.className='line-body';
  const groups = groupByDestination(visits||[]);
  const keys = Object.keys(groups);
  if(keys.length){
    keys.forEach(dest=>{
      const arr = groups[dest].slice(0,4);
      const row = document.createElement('div');
      row.className='dest-row';
      const cells = arr.map(v=>{
        const mvj = v.MonitoredVehicleJourney||{};
        const est = mvj.MonitoredCall?.ExpectedDepartureTime || mvj.MonitoredCall?.ExpectedArrivalTime;
        const sch = mvj.MonitoredCall?.AimedDepartureTime || mvj.MonitoredCall?.AimedArrivalTime;
        const delayMin = est && sch ? Math.round((new Date(est)-new Date(sch))/60000) : 0;
        const immin = est ? ((new Date(est)-Date.now())/60000 < 1.5) : false;
        const cancelled = mvj?.MonitoredCall?.DepartureStatus==='cancelled';
        const aimed = sch ? `<s>${formatHHMM(sch)}</s>` : '';
        const delayTxt = delayMin>0 ? `<span class="delay">+${delayMin} min</span>` : '';
        const imminTxt = immin ? `<span class="imminent">🟢</span>` : '';
        const cancelTxt = cancelled ? `<span class="cancelled">❌</span>` : '';
        return `<div class="cell">${aimed} <strong>${formatHHMM(est)}</strong> ${delayTxt} ${imminTxt} ${cancelTxt}</div>`;
      }).join('');
      row.innerHTML = `<div class="dest-head">→ ${dest}</div><div class="cells">${cells}</div>`;
      body.appendChild(row);
    });
  }else{
    const empty = document.createElement('div'); empty.className = 'no-realtime'; empty.textContent = 'Aucun passage imminent'; body.appendChild(empty);
  }
  wrap.appendChild(body); container.appendChild(wrap); return wrap;
}
async function renderJoinvilleAllBuses(){
  const mount = qs('#board-joinville-bus'); mount.innerHTML = 'Chargement des lignes…';
  const lines = await discoverBusLines(STOP_AREAS.JOINVILLE_IDFM);
  lines.sort((a,b)=>(a.code||a.id).localeCompare(b.code||b.id,'fr',{numeric:true}));
  mount.innerHTML = '';
  // Traffic banners (77/201/N33 basiques)
  const codesForBanner = [LINES_CODE.BUS_77, LINES_CODE.BUS_201, LINES_CODE.N33];
  for(const c of codesForBanner){
    try{
      const d = await fetchAPI(APIS.PRIM_GM(c));
      const list = d?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
      if(list.length){
        const txt = list.map(x=> (x?.Content?.Message?.[0]?.MessageText?.[0]?.value || '').trim()).filter(Boolean).join(' • ');
        const bar = qs('#traffic-bus'); bar.textContent = `⚠️ ${txt}`; bar.classList.remove('hidden'); break;
      }
    }catch{}
  }
  for(const meta of lines){
    const box = renderBusLineBlock(mount, meta, []);
    await sleep(150);
    (async ()=>{
      const visits = await getRealtimeForLine(meta.id);
      if(visits && visits.length){
        const body = box.querySelector('.line-body'); if(body) body.innerHTML='';
        const groups = groupByDestination(visits);
        Object.entries(groups).forEach(([dest, arr])=>{
          const items = arr.slice(0,4).map(v=>{
            const mvj = v.MonitoredVehicleJourney||{};
            const est = mvj.MonitoredCall?.ExpectedDepartureTime || mvj.MonitoredCall?.ExpectedArrivalTime;
            const sch = mvj.MonitoredCall?.AimedDepartureTime || mvj.MonitoredCall?.AimedArrivalTime;
            const delayMin = est && sch ? Math.round((new Date(est)-new Date(sch))/60000) : 0;
            const immin = est ? ((new Date(est)-Date.now())/60000 < 1.5) : false;
            const cancelled = mvj?.MonitoredCall?.DepartureStatus==='cancelled';
            const aimed = sch ? `<s>${formatHHMM(sch)}</s>` : '';
            const delayTxt = delayMin>0 ? `<span class="delay">+${delayMin} min</span>` : '';
            const imminTxt = immin ? `<span class="imminent">🟢</span>` : '';
            const cancelTxt = cancelled ? `<span class="cancelled">❌</span>` : '';
            return `<div class="cell">${aimed} <strong>${formatHHMM(est)}</strong> ${delayTxt} ${imminTxt} ${cancelTxt}</div>`;
          }).join('');
          const row = document.createElement('div'); row.className='dest-row';
          row.innerHTML = `<div class="dest-head">→ ${dest}</div><div class="cells">${items}</div>`;
          const body = box.querySelector('.line-body'); if(body) body.appendChild(row);
        });
      } else {
        const planned = await getPlannedForLine(meta.id);
        const info = document.createElement('div'); info.className='planned';
        if (planned && (!planned.next || planned.next.length===0)) {
          if (planned.first) info.textContent = `Service terminé — prochain passage à ${planned.first}`;
          else info.textContent = `Service terminé — prochains horaires indisponibles`;
        } else {
          info.textContent = `Prochains passages (GTFS) : ${(planned.next||[]).join(' • ')}`;
        }
        const body = box.querySelector('.line-body'); if(body) body.appendChild(info);
      }
    })();
  }
}

// Open-Meteo
async function renderMeteo(){
  try{
    const d = await fetchAPI(APIS.METEO(48.835, 2.45), 12000);
    const c = d?.current;
    qs('#meteo').innerHTML = `
      <div>Température : <strong>${Math.round(c?.temperature_2m??0)}°C</strong> (ressentie ${Math.round(c?.apparent_temperature??0)}°C)</div>
      <div>Vent : ${Math.round(c?.wind_speed_10m??0)} km/h</div>
    `;
  }catch{ qs('#meteo').textContent = 'Météo indisponible'; }
}

// Vélib
async function renderVelib(){
  try{
    const [status, info] = await Promise.all([fetchAPI(APIS.VELIB_STATUS(), 12000), fetchAPI(APIS.VELIB_INFO(), 12000)]);
    const byId = Object.fromEntries((info?.data?.stations||[]).map(s=>[s.station_id, s]));
    const wanted = ["12163","12128"];
    const rows = wanted.map(id=>{
      const s = (status?.data?.stations||[]).find(x=>x.station_id===id);
      const meta = byId[id]||{};
      if(!s) return `<div>Station ${id} indisponible</div>`;
      const bikes = s.num_bikes_available, docks = s.num_docks_available;
      return `<div><strong>${meta?.name||id}</strong> — vélos: ${bikes} / places: ${docks}</div>`;
    }).join('');
    qs('#velib').innerHTML = rows;
  }catch{ qs('#velib').textContent = 'Vélib’ indisponible'; }
}

// Init
window.addEventListener('load', async()=>{
  loadNews();
  renderRER();
  renderJoinvilleAllBuses();
  renderMeteo();
  renderVelib();
  setInterval(renderRER, 60*1000);
  setInterval(renderJoinvilleAllBuses, 2*60*1000);
  setInterval(loadNews, 5*60*1000);
  setInterval(renderMeteo, 10*60*1000);
  setInterval(renderVelib, 5*60*1000);
});
