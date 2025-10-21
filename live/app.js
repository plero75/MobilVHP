/* ===============================
   Dashboard Hippodrome – Live avec référentiel complet des lignes
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
const VELIB_STATIONS = { VINCENNES: "12104", BREUIL: "12115" };

const qs = (s, el=document) => el.querySelector(s);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt!=null) n.textContent = txt; return n; };

function banner(msg){ const host=document.getElementById('prim-messages'); if(!host) return; const n=el('div','message critical',msg); host.prepend(n); }

async function fetchAPI(url, timeout=15000){ const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout); try{ const final=url.startsWith(PROXY)?url:PROXY+encodeURIComponent(url); const r=await fetch(final,{signal:controller.signal}); clearTimeout(timer); if(!r.ok) throw new Error(`HTTP ${r.status}`); const ct=r.headers.get('content-type')||''; return ct.includes('application/json')? await r.json(): await r.text(); }catch(e){ clearTimeout(timer); console.warn('fetchAPI failed:',url,e.message); banner(`Erreur API (${e.message}) sur ${url.split('/')[2]}`); return null; }}

const clean=(s="")=>s.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const minutesFromISO=(iso)=> iso? Math.max(0,Math.round((new Date(iso).getTime()-Date.now())/60000)):null;

const COLORS={ modes:{bus:'#0aa3df','rer-a':'#e5003a'}, lines:{'77':'#0aa3df','201':'#0aa3df','A':'#e5003a','101':'#0aa3df','106':'#0aa3df','108':'#0aa3df','110':'#0aa3df','112':'#0aa3df','111':'#0aa3df','281':'#0aa3df','N33':'#7b68ee'} };
const colorFor=(g)=> COLORS.lines[g.lineId]||COLORS.modes[g.mode]||'#0aa3df';

function setClock(){ const d=new Date(); qs('#datetime').textContent=`${d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} – ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`; }

async function loadWeather(){ const d=await fetchAPI(APIS.WEATHER); const t=d?.current_weather?.temperature; qs('#weather').textContent=Number.isFinite(t)? `${Math.round(t)}°C`:'–'; }
async function loadSaint(){ const d=await fetchAPI(APIS.SAINT); const p=d?.response?.prenom||d?.response?.prenoms?.[0]; qs('#saint').textContent=p? `Saint ${p}`:'Saint du jour'; }

async function loadTrafficMessages(){ const cLines=['C01399','C01219','C01742']; const out=[]; for(const c of cLines){ const d=await fetchAPI(APIS.PRIM_GM(c)); const del=d?.Siri?.ServiceDelivery?.GeneralMessageDelivery||[]; del.forEach(x=> (x.InfoMessage||[]).forEach(m=>{ const txt=clean(m?.Content?.Message?.[0]?.MessageText?.[0]?.value||""); if(txt) out.push(txt); })); } setPrimMessages(out); }
function setPrimMessages(msgs=[]){ const box=qs('#prim-messages'); box.innerHTML=''; if(!msgs.length) return box.appendChild(el('div','message','Aucun message trafic.')); msgs.forEach(t=> box.appendChild(el('div','message info', t))); }

async function fetchStopData(stopId){ const d=await fetchAPI(APIS.PRIM_STOP(stopId)); const vs=d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit||[]; return vs.map(v=>{ const mv=v.MonitoredVehicleJourney||{}; const call=mv.MonitoredCall||{}; const lineRef=mv.LineRef?.value||mv.LineRef||''; const lineId=(lineRef.match(/C\d{5}/)||[null])[0]; const dest=clean(call.DestinationDisplay?.[0]?.value||''); const expected=call.ExpectedDepartureTime||call.ExpectedArrivalTime||null; const aimed=call.AimedDepartureTime||call.AimedArrivalTime||null; const minutes=minutesFromISO(expected); let delayMin=null; if(expected&&aimed){ const d=Math.round((new Date(expected)-new Date(aimed))/60000); if(Number.isFinite(d)&&d>0) delayMin=d; } const cancelled=/cancel|annul|supprim/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase()); return { lineId,dest,expected,minutes,delayMin,cancelled,timeStr: expected? new Date(expected).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'' }; }); }

async function loadNews(){ const xml=await fetchAPI(APIS.RSS); if(!xml) return qs('#news').textContent='Actualités indisponibles'; const doc=new DOMParser().parseFromString(xml,'application/xml'); const nodes=[...doc.querySelectorAll('item, entry')].slice(0,5); if(!nodes.length) return qs('#news').textContent='Aucune actualité trouvée'; qs('#news').innerHTML=nodes.map(n=>`<div class="news-item"><strong>${clean(n.querySelector('title')?.textContent||'')}</strong></div>`).join(''); }

async function loadVelib(){ const [d1,d2]=await Promise.all([fetchAPI(APIS.VELIB(VELIB_STATIONS.VINCENNES)),fetchAPI(APIS.VELIB(VELIB_STATIONS.BREUIL))]); const v1=d1?.results?.[0]; if(v1) qs('#velib-vincennes').textContent=`${v1.numbikesavailable||0} vélos – ${v1.numdocksavailable||0} libres`; const v2=d2?.results?.[0]; if(v2) qs('#velib-breuil').textContent=`${v2.numbikesavailable||0} vélos – ${v2.numdocksavailable||0} libres`; }

async function loadCourses(){ const d=new Date(); const day=`${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`; const data=await fetchAPI(APIS.PMU(day)); const vin=[],eng=[]; (data?.programme?.reunions||[]).forEach(r=>{ const hip=r.hippodrome?.code; const list= hip==='VIN'?vin: hip==='ENG'?eng:null; if(!list) return; (r.courses||[]).forEach(c=>{ const ts=Date.parse(c.heureDepart); if(Number.isFinite(ts)&&ts>Date.now()) list.push({heure:new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), lib:c.libelle, ref:`R${r.numOfficiel||''}C${c.numOrdre||''}`}); });}); qs('#races-vincennes').innerHTML= vin.length? vin.slice(0,3).map(c=>`${c.heure} - ${c.lib} (${c.ref})`).join('<br>'):'Aucune course prévue'; qs('#races-enghien').innerHTML= eng.length? eng.slice(0,3).map(c=>`${c.heure} - ${c.lib} (${c.ref})`).join('<br>'):'Aucune course prévue'; }

function renderBoard(container,groups){ 
  groups=[...groups].sort((a,b)=> {
    if(a.lineId==='A'&&b.lineId!=='A') return -1;
    if(a.lineId!=='A'&&b.lineId==='A') return 1;
    if(a.lineId===b.lineId) return (a.direction||'').localeCompare(b.direction||'');
    return (""+a.lineId).localeCompare(""+b.lineId,'fr',{numeric:true});
  }); 
  container.innerHTML=''; 
  if(!groups.length){ container.appendChild(el('div','placeholder','Aucune donnée disponible pour le moment.')); return; } 
  
  groups.forEach(g=>{ 
    const group=el('div','group'); 
    const head=el('div','group-head'); 
    head.style.borderBottom='1px dashed #e5e7eb'; 
    head.style.paddingBottom='8px'; 
    const pill=el('div','pill '+(g.mode==='rer-a'?'rer-a':'bus'), g.mode==='rer-a'?'A':g.lineId); 
    pill.style.background=colorFor(g); 
    const dir=el('div','dir', g.direction||''); 
    head.append(pill,dir); 
    group.appendChild(head); 
    
    if(!g.trips?.length){ 
      const none=el('div','row no-service'); 
      const w=el('div','wait'); 
      w.append(el('div','minutes','–'), el('div','label','')); 
      const info=el('div','info'); 
      
      // Distinguer "pas de passage" vs "hors service"
      const now = new Date().getHours();
      const isNightService = g.lineId === 'N33';
      const isOffPeak = now < 6 || now > 22;
      
      if(isNightService && !isOffPeak) {
        info.append(el('div','dest','Service de nuit'), el('div','via','Circulation nocturne uniquement'));
      } else if(!g.hasRealTimeData && isOffPeak) {
        info.append(el('div','dest','Service arrêté'), el('div','via','Hors horaires de circulation'));
      } else {
        info.append(el('div','dest','Pas de passage prévu'), el('div','via','Service en cours'));
      }
      
      const meta=el('div','meta'); 
      meta.append(el('div','clock',''), el('div','status termine',g.hasRealTimeData?'Temps réel':'Théorique')); 
      none.append(w,info,meta); 
      group.appendChild(none);
    } else { 
      g.trips.slice(0,3).forEach(t=>{ 
        const row=el('div','row'); 
        const wait=el('div','wait'); 
        wait.append(el('div','minutes', t.waitMin!=null? String(t.waitMin):''), el('div','label','min')); 
        const info=el('div','info'); 
        info.append(el('div','dest', t.dest||'')); 
        info.append(el('div','via', t.via? `via ${t.via}`:'')); 
        const meta=el('div','meta'); 
        meta.append(el('div','clock', t.timeStr||'')); 
        if(t.status){ 
          const map={retard:`Retard +${t.delayMin??0}`, supprime:'Supprimé', nondesservi:'Non desservi', deplace:'Arrêt déplacé', premier:'Premier', dernier:'Dernier', termine:'Service terminé'}; 
          meta.append(el('div','status '+t.status, map[t.status]||'')); 
        } 
        row.append(wait,info,meta); 
        group.appendChild(row); 
      }); 
    } 
    container.appendChild(group); 
  }); 
}

// RÉFÉRENTIEL COMPLET DES LIGNES PAR ARRÊT (données officielles)
const STATIC_LINES={
  'col-joinville-rer-a':[
    {lineId:'A',mode:'rer-a',direction:'Vers Paris / La Défense'},
    {lineId:'A',mode:'rer-a',direction:'Vers Boissy‑Saint‑Léger'},
    {lineId:'77',mode:'bus',direction:'Direction Gare de Lyon'},
    {lineId:'77',mode:'bus',direction:'Direction Plateau de Gravelle'},
    {lineId:'101',mode:'bus',direction:'Direction Château de Vincennes'},
    {lineId:'101',mode:'bus',direction:'Direction Montgallet'},
    {lineId:'106',mode:'bus',direction:'Direction République'},
    {lineId:'106',mode:'bus',direction:'Direction Créteil Université'},
    {lineId:'108',mode:'bus',direction:'Direction Maisons‑Alfort'},
    {lineId:'108',mode:'bus',direction:'Direction Créteil Échat'},
    {lineId:'110',mode:'bus',direction:'Direction Créteil Préfecture'},
    {lineId:'110',mode:'bus',direction:'Direction République'},
    {lineId:'112',mode:'bus',direction:'Direction École du Breuil'},
    {lineId:'112',mode:'bus',direction:'Direction Château de Vincennes'},
    {lineId:'201',mode:'bus',direction:'Direction Champigny la Plage'},
    {lineId:'201',mode:'bus',direction:'Direction Porte Dorée'},
    {lineId:'281',mode:'bus',direction:'Direction Torcy RER'},
    {lineId:'281',mode:'bus',direction:'Direction École Vétérinaire'},
    {lineId:'N33',mode:'bus',direction:'Direction Château de Vincennes (Noctilien)'}
  ],
  'col-hpv-77':[
    {lineId:'77',mode:'bus',direction:'Direction Gare de Lyon'},
    {lineId:'77',mode:'bus',direction:'Direction Joinville RER'},
    {lineId:'111',mode:'bus',direction:'Direction Château de Vincennes'},
    {lineId:'111',mode:'bus',direction:'Direction République'},
    {lineId:'112',mode:'bus',direction:'Direction École du Breuil'},
    {lineId:'112',mode:'bus',direction:'Direction Château de Vincennes'},
    {lineId:'201',mode:'bus',direction:'Direction Champigny la Plage'},
    {lineId:'201',mode:'bus',direction:'Direction Porte Dorée'}
  ],
  'col-breuil-77-201':[
    {lineId:'A',mode:'rer-a',direction:'Vers Paris / La Défense'},
    {lineId:'A',mode:'rer-a',direction:'Vers Boissy‑Saint‑Léger'},
    {lineId:'77',mode:'bus',direction:'Direction Gare de Lyon'},
    {lineId:'77',mode:'bus',direction:'Direction Joinville RER'},
    {lineId:'101',mode:'bus',direction:'Direction Château de Vincennes'},
    {lineId:'101',mode:'bus',direction:'Direction Montgallet'},
    {lineId:'106',mode:'bus',direction:'Direction République'},
    {lineId:'106',mode:'bus',direction:'Direction Créteil Université'},
    {lineId:'108',mode:'bus',direction:'Direction Maisons‑Alfort'},
    {lineId:'108',mode:'bus',direction:'Direction Créteil Échat'},
    {lineId:'110',mode:'bus',direction:'Direction Créteil Préfecture'},
    {lineId:'110',mode:'bus',direction:'Direction République'},
    {lineId:'112',mode:'bus',direction:'Direction École du Breuil'},
    {lineId:'112',mode:'bus',direction:'Direction Château de Vincennes'},
    {lineId:'201',mode:'bus',direction:'Direction Champigny la Plage'},
    {lineId:'201',mode:'bus',direction:'Direction Porte Dorée'},
    {lineId:'281',mode:'bus',direction:'Direction Torcy RER'},
    {lineId:'281',mode:'bus',direction:'Direction École Vétérinaire'},
    {lineId:'N33',mode:'bus',direction:'Direction Château de Vincennes (Noctilien)'}
  ]
};

// CODES LIGNE PRIM RÉELS (mapping C-codes)
const LINE_CODES={'77':'C01399','201':'C01219','A':'C01742','101':'C01260','106':'C01371','108':'C01374','110':'C01376','112':'C01379','111':'C01377','281':'C01521','N33':'C01833'};

async function loadTransportData(){
  const [rerData,hippoData,breuilData]=await Promise.all([
    fetchStopData(STOP_IDS.RER_A),
    fetchStopData(STOP_IDS.HIPPODROME),
    fetchStopData(STOP_IDS.BREUIL)
  ]);
  
  // Fonction pour fusionner statique + temps réel
  function mergeStaticWithRealTime(staticLines, realTimeData, stopName) {
    return staticLines.map(staticLine => {
      // Chercher données temps réel pour cette ligne
      const cCode = LINE_CODES[staticLine.lineId];
      const liveTrips = realTimeData
        .filter(v => v.lineId === cCode)
        .filter(v => {
          if(!v.dest) return true;
          // Filtrage basique par destination pour direction
          const destLower = v.dest.toLowerCase();
          const dirLower = staticLine.direction.toLowerCase();
          if(dirLower.includes('paris') || dirLower.includes('défense')) return destLower.includes('paris') || destLower.includes('châtelet') || destLower.includes('défense');
          if(dirLower.includes('boissy')) return destLower.includes('boissy');
          if(dirLower.includes('gare de lyon') || dirLower.includes('lyon')) return destLower.includes('lyon') || destLower.includes('gare');
          if(dirLower.includes('joinville')) return destLower.includes('joinville');
          if(dirLower.includes('château') || dirLower.includes('vincennes')) return destLower.includes('château') || destLower.includes('vincennes');
          if(dirLower.includes('république')) return destLower.includes('république');
          if(dirLower.includes('créteil')) return destLower.includes('créteil');
          if(dirLower.includes('montgallet')) return destLower.includes('montgallet');
          if(dirLower.includes('maisons')) return destLower.includes('maisons');
          if(dirLower.includes('champigny')) return destLower.includes('champigny');
          if(dirLower.includes('porte dorée')) return destLower.includes('porte') || destLower.includes('dorée');
          if(dirLower.includes('école') || dirLower.includes('breuil')) return destLower.includes('école') || destLower.includes('breuil');
          if(dirLower.includes('torcy')) return destLower.includes('torcy');
          return true; // Défaut: inclure
        })
        .map(v => ({
          waitMin: v.minutes,
          timeStr: v.timeStr,
          dest: v.dest,
          status: v.cancelled ? 'supprime' : (v.delayMin > 0 ? 'retard' : null),
          delayMin: v.delayMin
        }));
      
      return {
        ...staticLine,
        trips: liveTrips.slice(0, 3),
        hasRealTimeData: liveTrips.length > 0
      };
    });
  }
  
  // Application par colonne
  const dataByCol = {
    'col-joinville-rer-a': mergeStaticWithRealTime(STATIC_LINES['col-joinville-rer-a'], rerData, 'Joinville RER'),
    'col-hpv-77': mergeStaticWithRealTime(STATIC_LINES['col-hpv-77'], hippoData, 'Hippodrome'),
    'col-breuil-77-201': mergeStaticWithRealTime(STATIC_LINES['col-breuil-77-201'], breuilData, 'École du Breuil')
  };
  
  // Rendu final
  Object.keys(dataByCol).forEach(colId => {
    const cont = qs('#'+colId+' .board');
    if(cont) renderBoard(cont, dataByCol[colId]);
  });
}

async function init(){
  setClock(); setInterval(setClock,30_000);
  await Promise.allSettled([loadWeather(),loadSaint(),loadTrafficMessages(),loadTransportData(),loadNews(),loadVelib(),loadCourses()]);
  setInterval(loadTransportData,60_000);
  setInterval(loadTrafficMessages,300_000);
  setInterval(()=>Promise.allSettled([loadNews(),loadVelib(),loadCourses()]),600_000);
}

init().catch(console.error);
