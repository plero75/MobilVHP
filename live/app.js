/* ===============================
   Dashboard Hippodrome – Live avec APIs PRIM
   Règles d'affichage :
   - Groupement par LIGNE → DIRECTION (max 3 prochains)
   - Attente en minutes en GRAS + heure exacte en dessous
   - Statuts texte (pas d'émojis) : Retard +X, Supprimé, Non desservi, Arrêt déplacé, Premier, Dernier, Service terminé
   - Lignes attendues restent visibles même sans données (placeholders)
   - Header principal (date/heure/météo/saint) + Header bis (/general-message)
   =============================== */

// ---- CONFIGURATION ----
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

const VELIB_STATIONS = {
  VINCENNES: "12104",
  BREUIL: "12115"
};

// ---- UTIL ----
const qs = (s, el=document) => el.querySelector(s);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt!=null) n.textContent = txt; return n; };

// Fetch avec proxy automatique
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
    return null;
  }
}

const clean = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const minutesFromISO = (iso) => {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
};

// ---- IDFM Palette ----
const COLORS = {
  modes: {
    'bus': '#0aa3df',
    'rer-a': '#e5003a'
  },
  lines: {
    '77': '#0aa3df','201': '#0aa3df','101': '#0aa3df','108': '#0aa3df','110': '#0aa3df',
    '281': '#0aa3df','317': '#0aa3df','393': '#0aa3df','520': '#0aa3df','N': '#0aa3df',
    'A': '#e5003a'
  }
};
function colorFor(group){
  return COLORS.lines[group.lineId] || COLORS.modes[group.mode] || '#0aa3df';
}

// ---- HEADER (Clock + Weather + Saint) ----
function setClock() {
  const d = new Date();
  const dd = d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const hh = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  qs('#datetime').textContent = `${dd} — ${hh}`;
}

async function loadWeather() {
  try {
    const data = await fetchAPI(APIS.WEATHER);
    const temp = data?.current_weather?.temperature;
    qs('#weather').textContent = temp ? `${Math.round(temp)}°C` : '—';
  } catch (e) {
    qs('#weather').textContent = 'Météo indisponible';
  }
}

async function loadSaint() {
  try {
    const data = await fetchAPI(APIS.SAINT);
    const prenom = data?.response?.prenom || data?.response?.prenoms?.[0];
    qs('#saint').textContent = prenom ? `Saint ${prenom}` : 'Saint du jour';
  } catch (e) {
    qs('#saint').textContent = 'Saint du jour';
  }
}

// ---- MESSAGES PRIM (/general-message) ----
async function loadTrafficMessages() {
  const lineRefs = ['C01399', 'C01219', 'C01742']; // Bus 77, 201, RER A
  const messages = [];
  
  for (const ref of lineRefs) {
    try {
      const data = await fetchAPI(APIS.PRIM_GM(ref));
      const deliveries = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery || [];
      deliveries.forEach((d) => {
        (d.InfoMessage || []).forEach((m) => {
          const txt = clean(m?.Content?.Message?.[0]?.MessageText?.[0]?.value || "");
          if (txt) messages.push(txt);
        });
      });
    } catch (e) {
      console.warn(`Traffic messages failed for ${ref}:`, e);
    }
  }
  
  setPrimMessages(messages);
}

function setPrimMessages(msgs = []) {
  const box = qs('#prim-messages');
  box.innerHTML = "";
  if (!msgs.length) { 
    box.appendChild(el('div','message','Aucun message trafic.')); 
    return; 
  }
  msgs.forEach(m => {
    const text = typeof m === 'string' ? m : (m.text || '');
    const sev = typeof m === 'string' ? 'info' : (m.severity || 'info');
    const node = el('div', 'message '+sev, text);
    box.appendChild(node);
  });
}

// ---- TRANSPORT DATA (PRIM Stop Monitoring) ----
async function fetchStopData(stopId) {
  try {
    const data = await fetchAPI(APIS.PRIM_STOP(stopId));
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    
    return visits.map((v) => {
      const mv = v.MonitoredVehicleJourney || {};
      const call = mv.MonitoredCall || {};
      const lineRef = mv.LineRef?.value || mv.LineRef || "";
      const lineId = (lineRef.match(/C\d{5}/) || [null])[0];
      const dest = clean(call.DestinationDisplay?.[0]?.value || "");
      const expected = call.ExpectedDepartureTime || call.ExpectedArrivalTime || null;
      const aimed = call.AimedDepartureTime || call.AimedArrivalTime || null;
      const minutes = minutesFromISO(expected);
      
      let delayMin = null;
      if (expected && aimed) {
        const d = Math.round((new Date(expected).getTime() - new Date(aimed).getTime()) / 60000);
        if (Number.isFinite(d) && d > 0) delayMin = d;
      }
      
      const status = (call.DepartureStatus || call.ArrivalStatus || "").toLowerCase();
      const cancelled = /cancel|annul|supprim/.test(status);
      
      return { 
        lineId, 
        dest, 
        expected, 
        minutes, 
        delayMin, 
        cancelled,
        timeStr: expected ? new Date(expected).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : ''
      };
    });
  } catch (e) {
    console.warn('fetchStopData failed:', stopId, e);
    return [];
  }
}

// ---- NEWS ----
async function loadNews() {
  try {
    const xml = await fetchAPI(APIS.RSS);
    if (!xml) {
      qs('#news').textContent = 'Actualités indisponibles';
      return;
    }
    
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = [...doc.querySelectorAll("item, entry")].slice(0, 5);
    
    if (!nodes.length) {
      qs('#news').textContent = 'Aucune actualité trouvée';
      return;
    }
    
    const newsItems = nodes.map(n => ({
      title: clean(n.querySelector("title")?.textContent || "Titre indisponible"),
      desc: clean(n.querySelector("description, summary")?.textContent || "")
    }));
    
    const newsHtml = newsItems.map(item => 
      `<div class="news-item"><strong>${item.title}</strong>${item.desc ? ` - ${item.desc.slice(0, 100)}...` : ''}</div>`
    ).join('');
    
    qs('#news').innerHTML = newsHtml;
  } catch (e) {
    qs('#news').textContent = `Erreur actualités: ${e.message}`;
  }
}

// ---- VELIB ----
async function loadVelib() {
  try {
    const [vincennesData, breuil] = await Promise.all([
      fetchAPI(APIS.VELIB(VELIB_STATIONS.VINCENNES)),
      fetchAPI(APIS.VELIB(VELIB_STATIONS.BREUIL))
    ]);
    
    const vincenesInfo = vincennesData?.results?.[0];
    if (vincenesInfo) {
      const available = vincenesInfo.numbikesavailable || 0;
      const electrical = vincenesInfo.numdocksavailable || 0;
      qs('#velib-vincennes').textContent = `${available} vélos disponibles - ${electrical} emplacements libres`;
    }
    
    const breuil = breuil?.results?.[0];
    if (breuil) {
      const available = breuil.numbikesavailable || 0;
      const electrical = breuil.numdocksavailable || 0;
      qs('#velib-breuil').textContent = `${available} vélos disponibles - ${electrical} emplacements libres`;
    }
  } catch (e) {
    qs('#velib-vincennes').textContent = 'Vélib indisponible';
    qs('#velib-breuil').textContent = 'Vélib indisponible';
  }
}

// ---- COURSES ----
async function loadCourses() {
  try {
    const day = new Date().toISOString().slice(0,10).replace(/-/g,'').slice(2,8); // DDMMYY
    const data = await fetchAPI(APIS.PMU(day));
    
    const vin = [], eng = [];
    if (data?.programme?.reunions) {
      data.programme.reunions.forEach((r) => {
        const hip = r.hippodrome?.code;
        const list = hip === "VIN" ? vin : hip === "ENG" ? eng : null;
        if (!list) return;
        
        (r.courses || []).forEach((c) => {
          const ts = Date.parse(c.heureDepart);
          if (Number.isFinite(ts) && ts > Date.now()) {
            list.push({
              heure: new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
              lib: c.libelle,
              ref: `R${r.numOfficiel || ""}C${c.numOrdre || ""}`
            });
          }
        });
      });
    }
    
    qs('#races-vincennes').innerHTML = vin.length ? 
      vin.slice(0,3).map(c => `${c.heure} - ${c.lib} (${c.ref})`).join('<br>') : 
      'Aucune course prévue';
      
    qs('#races-enghien').innerHTML = eng.length ? 
      eng.slice(0,3).map(c => `${c.heure} - ${c.lib} (${c.ref})`).join('<br>') : 
      'Aucune course prévue';
      
  } catch (e) {
    qs('#races-vincennes').textContent = 'Courses indisponibles';
    qs('#races-enghien').textContent = 'Courses indisponibles';
  }
}

// ---- RENDERER ----
function renderBoard(container, groups) {
  groups = [...groups].sort((a,b)=>{
    if (a.lineId===b.lineId) return (a.direction||'').localeCompare(b.direction||'');
    return (''+a.lineId).localeCompare(''+b.lineId, 'fr', {numeric:true});
  });

  container.innerHTML = "";
  if (!groups || !groups.length) {
    const ph = el('div','placeholder','Aucune donnée disponible pour le moment.');
    container.appendChild(ph);
    return;
  }
  
  groups.forEach(g => {
    const group = el('div','group');
    const head = el('div','group-head'); 
    head.style.borderBottom='1px dashed #e5e7eb'; 
    head.style.paddingBottom='8px';
    
    const pill = el('div','pill ' + (g.mode === 'rer-a' ? 'rer-a':'bus'), g.mode === 'rer-a' ? 'A' : g.lineId);
    pill.style.background = colorFor(g);
    const dir = el('div','dir', g.direction || '');
    head.append(pill, dir);
    group.appendChild(head);

    if (!g.trips || g.trips.length === 0) {
      const none = el('div','row');
      const w = el('div','wait');
      w.append(el('div','minutes',''), el('div','label','attente'));
      const info = el('div','info');
      info.append(el('div','dest','Aucun départ pour l\'instant'), el('div','via',''));
      const meta = el('div','meta');
      meta.append(el('div','clock',''), el('div','status termine','Service terminé'));
      none.append(w, info, meta);
      group.appendChild(none);
    } else {
      g.trips.slice(0,3).forEach(t => {
        const row = el('div','row');
        const wait = el('div','wait');
        const minutes = (t.waitMin!=null) ? String(t.waitMin) : '';
        wait.append(el('div','minutes', minutes), el('div','label','min'));
        
        const info = el('div','info');
        info.append(el('div','dest', t.dest || ''));
        info.append(el('div','via', t.via ? `via ${t.via}` : ''));
        
        const meta = el('div','meta');
        meta.append(el('div','clock', t.timeStr || ''));
        
        if (t.status) {
          let label = '';
          switch (t.status) {
            case 'retard': label = `Retard +${t.delayMin ?? 0}`; break;
            case 'supprime': label = 'Supprimé'; break;
            case 'nondesservi': label = 'Non desservi'; break;
            case 'deplace': label = 'Arrêt déplacé'; break;
            case 'premier': label = 'Premier'; break;
            case 'dernier': label = 'Dernier'; break;
            case 'termine': label = 'Service terminé'; break;
          }
          const st = el('div','status '+t.status, label);
          meta.append(st);
        }
        
        row.append(wait, info, meta);
        group.appendChild(row);
      });
    }
    
    container.appendChild(group);
  });
}

// ---- EXPECTED GROUPS (persistence) ----
const EXPECTED = {
  'col-hpv-77': [
    { lineId:'77', mode:'bus', direction:'Direction Joinville RER' },
    { lineId:'77', mode:'bus', direction:'Direction Plateau de Gravelle' }
  ],
  'col-breuil-77-201': [
    { lineId:'77', mode:'bus', direction:'Direction Joinville RER' },
    { lineId:'201', mode:'bus', direction:'Direction Porte Dorée' }
  ],
  'col-joinville-rer-a': [
    { lineId:'A', mode:'rer-a', direction:'Vers Paris / La Défense' },
    { lineId:'A', mode:'rer-a', direction:'Vers Boissy‑Saint‑Léger' }
  ]
};

// ---- MAIN DATA LOADING ----
async function loadTransportData() {
  try {
    const [rerData, hippoData, breuil] = await Promise.all([
      fetchStopData(STOP_IDS.RER_A),
      fetchStopData(STOP_IDS.HIPPODROME),
      fetchStopData(STOP_IDS.BREUIL)
    ]);
    
    // Process RER A data
    const rerGroups = [];
    const rerByDirection = new Map();
    
    rerData.forEach(visit => {
      if (visit.lineId !== 'A') return; // RER A only
      const key = visit.dest.toLowerCase().includes('boissy') ? 'boissy' : 'paris';
      if (!rerByDirection.has(key)) rerByDirection.set(key, []);
      rerByDirection.get(key).push({
        waitMin: visit.minutes,
        timeStr: visit.timeStr,
        dest: visit.dest,
        status: visit.cancelled ? 'supprime' : (visit.delayMin > 0 ? 'retard' : null),
        delayMin: visit.delayMin
      });
    });
    
    for (const [key, trips] of rerByDirection) {
      rerGroups.push({
        lineId: 'A',
        mode: 'rer-a',
        direction: key === 'boissy' ? 'Vers Boissy‑Saint‑Léger' : 'Vers Paris / La Défense',
        trips: trips.slice(0, 3)
      });
    }
    
    // Process bus data for Hippodrome (77)
    const hippoGroups = [];
    const hippoBus = hippoData.filter(v => v.lineId === 'C01399'); // Bus 77
    const hippoByDirection = new Map();
    
    hippoBus.forEach(visit => {
      const key = visit.dest.toLowerCase().includes('joinville') ? 'joinville' : 'gravelle';
      if (!hippoByDirection.has(key)) hippoByDirection.set(key, []);
      hippoByDirection.get(key).push({
        waitMin: visit.minutes,
        timeStr: visit.timeStr,
        dest: visit.dest,
        status: visit.cancelled ? 'supprime' : (visit.delayMin > 0 ? 'retard' : null),
        delayMin: visit.delayMin
      });
    });
    
    for (const [key, trips] of hippoByDirection) {
      hippoGroups.push({
        lineId: '77',
        mode: 'bus',
        direction: key === 'joinville' ? 'Direction Joinville RER' : 'Direction Plateau de Gravelle',
        trips: trips.slice(0, 3)
      });
    }
    
    // Process bus data for Breuil (77, 201)
    const breuil = [];
    const breuil77 = breuil.filter(v => v.lineId === 'C01399'); // Bus 77
    const breuil201 = breuil.filter(v => v.lineId === 'C01219'); // Bus 201
    
    // Similar processing for Breuil...
    // (Simplified for demo)
    
    // Render with persistence
    const dataByCol = {
      'col-joinville-rer-a': rerGroups,
      'col-hpv-77': hippoGroups,
      'col-breuil-77-201': [] // Add Breuil processing
    };
    
    Object.keys(EXPECTED).forEach(colId => {
      const expectedGroups = EXPECTED[colId];
      const current = dataByCol[colId] || [];
      const merged = [];
      
      expectedGroups.forEach(exp => {
        const found = current.find(g => g.lineId===exp.lineId && g.mode===exp.mode && g.direction===exp.direction);
        if (found) merged.push(found);
        else merged.push({ ...exp, trips: [] });
      });
      
      const cont = qs('#'+colId+' .board');
      if (cont) renderBoard(cont, merged);
    });
    
  } catch (e) {
    console.error('Transport data loading failed:', e);
    // Fallback
    Object.keys(EXPECTED).forEach(colId => {
      const cont = qs('#'+colId+' .board');
      if (cont) renderBoard(cont, []);
    });
  }
}

// ---- INIT ----
async function init() {
  setClock();
  setInterval(setClock, 30_000);
  
  // Load all data
  await Promise.allSettled([
    loadWeather(),
    loadSaint(),
    loadTrafficMessages(),
    loadTransportData(),
    loadNews(),
    loadVelib(),
    loadCourses()
  ]);
  
  // Set up refresh intervals
  setInterval(loadTransportData, 60_000); // Transport every minute
  setInterval(loadTrafficMessages, 5*60_000); // Messages every 5 minutes
  setInterval(() => Promise.allSettled([loadNews(), loadVelib(), loadCourses()]), 10*60_000); // Others every 10 minutes
}

// Boot
init().catch(console.error);