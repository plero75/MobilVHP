// ============================================================================
// 🌍 DATA FETCHING LAYER – Dashboard Transports Vincennes
// Version corrigée avec retry, timeouts configurables et feedback
// ============================================================================

import {
  PROXY,
  WEATHER_URL,
  SAINT_URL,
  RSS_URL,
  PRIM_STOP,
  ODS_BY_ID,
  ODS_BY_CD,
  PRIM_GM,
  NAVI_SCHEDULE,
  PMU_DAY_URL,
  NAVITIA_BASE,
  API_CONFIG
} from '../constants';

import type { Visit, LineMeta, GtfsFallback, Course, BusSummary, Direction } from '../types';

// ============================================================================
// 🔧 UTILS GÉNÉRIQUES
// ============================================================================

async function wait(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function fetchWithRetry<T>(input: RequestInfo | URL, init: RequestInit & { timeout?: number } = {}, retries = API_CONFIG.RETRY_COUNT): Promise<T | null> {
  const timeout = init.timeout ?? API_CONFIG.TIMEOUT;
  const finalInit: RequestInit = { ...init, cache: 'no-store', signal: undefined };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(input, { ...finalInit, signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await resp.json() as T;
      // @ts-ignore
      return await resp.text();
    } catch (e: any) {
      clearTimeout(timer);
      if (attempt === retries) {
        console.error('fetchWithRetry failed', input.toString(), e.message);
        return null;
      }
      await wait(API_CONFIG.RETRY_DELAY * (attempt + 1));
    }
  }
  return null;
}

// JSON fetch sécurisé avec proxy automatique
async function fetchJSON<T>(url: string, timeout = API_CONFIG.TIMEOUT): Promise<T | null> {
  const finalUrl = url.startsWith(PROXY) ? url : PROXY + encodeURIComponent(url);
  return fetchWithRetry<T>(finalUrl, { timeout });
}

// Lecture texte simple (RSS / XML)
async function fetchText(url: string, timeout = API_CONFIG.TIMEOUT): Promise<string> {
  const finalUrl = url.startsWith(PROXY) ? url : PROXY + encodeURIComponent(url);
  const res = await fetchWithRetry<string>(finalUrl, { timeout });
  return (res as any) || '';
}

const clean = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export const minutesFromISO = (iso: string | null) => {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
};

export const ymdhm = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const hhmm = (iso: string | null) => {
  if (!iso) return "—:—";
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const navitiaTimeToISO = (navitiaTime: string) => {
    return `${navitiaTime.slice(0, 4)}-${navitiaTime.slice(4, 6)}-${navitiaTime.slice(6, 8)}T${navitiaTime.slice(9, 11)}:${navitiaTime.slice(11, 13)}:${navitiaTime.slice(13, 15)}`;
}

// ============================================================================
// 🌦 MODULES DE DONNÉES PUBLIQUES (météo, saint, actu, vélib)
// ============================================================================

export const fetchWeather = () =>
  fetchJSON<{ current_weather: { temperature: number } }>(WEATHER_URL);

export const fetchSaint = () =>
  fetchJSON<{ response: { prenom?: string, prenoms?: string[] } }>(SAINT_URL);

export const fetchVelibStation = (stationCode: string) =>
  fetchJSON<any>(
    `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${stationCode}&limit=1`
  );

export const fetchNews = async () => {
  const xml = await fetchText(RSS_URL);
  if (!xml) return [];
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = [...doc.querySelectorAll("item")].slice(0, 8);
    return nodes.map(n => ({
      title: clean(n.querySelector("title")?.textContent || ""),
      desc: clean(n.querySelector("description")?.textContent || "")
    }));
  } catch {
    return [];
  }
};

// ============================================================================
// 🚉 TRANSPORTS TEMPS RÉEL – PRIM (StopMonitoring + Info Trafic)
// ============================================================================

export const fetchStopMonitoring = async (stopId: string): Promise<Visit[]> => {
  const data = await fetchJSON<any>(PRIM_STOP(stopId));
  const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;
  if (!Array.isArray(visits)) return [];

  return visits.map((v: any) => {
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
    return { lineId, dest, expected, minutes, delayMin, cancelled };
  });
};

export const fetchTrafficMessages = async (lineRefs: string[]): Promise<string[]> => {
  const messages: string[] = [];
  for (const ref of lineRefs) {
    const data = await fetchJSON<any>(PRIM_GM(ref));
    const deliveries = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery || [];
    deliveries.forEach((d: any) => {
      (d.InfoMessage || []).forEach((m: any) => {
        const txt = clean(m?.Content?.Message?.[0]?.MessageText?.[0]?.value || "");
        if (txt) messages.push(txt);
      });
    });
  }
  return messages;
};

// ============================================================================
// 🧭 MÉTADONNÉES LIGNES (OpenDataSoft)
// ============================================================================

const metaCache = new Map<string, LineMeta>();
const FALLBACK_COLORS: Record<string, string> = {
  "A": "#e41e26", "77": "#0066cc", "201": "#00aa55"
};

export const getMetaById = async (lineId: string): Promise<LineMeta> => {
  if (metaCache.has(lineId)) return metaCache.get(lineId)!;
  const data = await fetchJSON<any>(ODS_BY_ID(lineId));
  let meta: LineMeta = { code: lineId, color: "#2450a4", text: "#fff" };
  if (data?.results?.length) {
    const e = data.results[0];
    meta = { code: e.shortname_line || lineId, color: e.colourweb_hexa || "#2450a4", text: e.textcolourweb_hexa || "#fff" };
  }
  metaCache.set(lineId, meta);
  return meta;
};

export const getMetaByCode = async (code: string): Promise<LineMeta> => {
  if (metaCache.has(code)) return metaCache.get(code)!;
  const data = await fetchJSON<any>(ODS_BY_CD(code));
  let meta: LineMeta = { code, color: FALLBACK_COLORS[code] || "#2450a4", text: "#fff" };
  if (data?.results?.length) {
    const e = data.results[0];
    meta = { code: e.shortname_line || code, color: e.colourweb_hexa || FALLBACK_COLORS[code] || "#2450a4", text: e.textcolourweb_hexa || "#fff" };
  }
  metaCache.set(code, meta);
  return meta;
};

// ============================================================================
// 📅 GTFS FALLBACK – Horaires théoriques Navitia
// ============================================================================

const siriToNavitiaStopArea = (siriId: string): string => {
  const match = siriId.match(/SP:(\d+):/);
  if (match && match[1]) {
    return `stop_area:IDFM:${match[1]}`;
  }
  return siriId;
};

export const getDailySchedule = async (lineId: string, siriStopId: string): Promise<{ first: string | null, last: string | null }> => {
    try {
        const navitiaStopId = siriToNavitiaStopArea(siriStopId);
        const dayStart = ymdhm(startOfDay(new Date()));
        const data = await fetchJSON<any>(NAVI_SCHEDULE(lineId, navitiaStopId, dayStart) + '&count=200');
        const times = data?.stop_schedules?.[0]?.date_times;
        if (Array.isArray(times) && times.length > 0) {
            const first = navitiaTimeToISO(times[0].date_time);
            const last = navitiaTimeToISO(times[times.length - 1].date_time);
            return { first, last };
        }
    } catch (e: any) {
        console.warn("getDailySchedule failed", e.message);
    }
    return { first: null, last: null };
};

export const gtfsFallback = async (lineId: string, siriStopId: string): Promise<GtfsFallback | null> => {
  try {
    const navitiaStopId = siriToNavitiaStopArea(siriStopId);
    const now = new Date();
    
    const n1 = await fetchJSON<any>(NAVI_SCHEDULE(lineId, navitiaStopId, ymdhm(now)));
    const next = n1?.stop_schedules?.[0]?.date_times?.[0]?.date_time;
    if (next) {
      const iso = navitiaTimeToISO(next);
      return { status: "next", timeISO: iso };
    }

    const sod = startOfDay(now);
    const n2 = await fetchJSON<any>(NAVI_SCHEDULE(lineId, navitiaStopId, ymdhm(sod)));
    const firstToday = n2?.stop_schedules?.[0]?.date_times?.[0]?.date_time;
    if (firstToday) {
      const isoFirst = navitiaTimeToISO(firstToday);
      if (new Date(isoFirst) > now) return { status: "first", timeISO: isoFirst };
    }

    const tomorrow = startOfDay(addDays(now, 1));
    const n3 = await fetchJSON<any>(NAVI_SCHEDULE(lineId, navitiaStopId, ymdhm(tomorrow)));
    const firstTom = n3?.stop_schedules?.[0]?.date_times?.[0]?.date_time;
    if (firstTom) {
      const isoTom = navitiaTimeToISO(firstTom);
      return { status: "ended", timeISO: isoTom };
    }
  } catch (e: any) {
    console.warn("gtfsFallback failed", e.message);
  }
  return null;
};

// ============================================================================
// 🐎 COURSES HIPPIQUES – PMU (via proxy non nécessaire)
// ============================================================================

export const fetchCourses = async (): Promise<{ vin: Course[], eng: Course[] }> => {
  const day = ((d) => `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`)(new Date());
  const data = await fetchJSON<any>(PMU_DAY_URL(day));
  const vin: Course[] = [], eng: Course[] = [];

  if (data?.programme?.reunions) {
    data.programme.reunions.forEach((r: any) => {
      const hip = r.hippodrome?.code;
      const list = hip === "VIN" ? vin : hip === "ENG" ? eng : null;
      if (!list) return;
      (r.courses || []).forEach((c: any) => {
        const ts = Date.parse(c.heureDepart);
        if (!Number.isFinite(ts)) return;
        list.push({
          ts,
          heure: new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          lib: c.libelle,
          dist: c.distance,
          disc: c.discipline,
          dot: c.montantPrix,
          ref: `R${r.numOfficiel || ""}C${c.numOrdre || ""}`
        });
      });
    });
  }

  vin.sort((a, b) => a.ts - b.ts);
  eng.sort((a, b) => a.ts - b.ts);
  return { vin, eng };
};

// ============================================================================
// 🚌 DISCOVERY – Lignes de bus depuis une zone Navitia
// ============================================================================

export const discoverBusLines = async (stopAreaId: string) => {
  const url = `${NAVITIA_BASE}/stop_areas/stop_area:IDFM:${stopAreaId}/lines?count=200`;
  const data = await fetchJSON<any>(url);
  if (!data?.lines) return [];

  return data.lines
    .filter((l: any) => l.commercial_mode?.name?.toLowerCase() === "bus")
    .map((l: any) => {
      const lineIdMatch = l.id?.match(/:(C\d+)/);
      return {
        id: l.id,
        code: l.code,
        name: l.name,
        color: l.color,
        lineId: lineIdMatch ? lineIdMatch[1] : null
      };
    })
    .filter((l: any) => l.lineId);
};

export const fetchAllBusesSummary = async (navitiaStopAreaId: string, siriStopId: string, perDir: number = 3): Promise<BusSummary[]> => {
    const discoveredLines = await discoverBusLines(navitiaStopAreaId);
    if (!discoveredLines.length) return [];
    
    const lineMetaMap = new Map<string, any>(discoveredLines.map(l => [l.lineId, l]));

    const plannedSchedulesPromises = discoveredLines.map(line => 
        getDailySchedule(line.lineId, siriStopId)
    );
    
    const [plannedSchedules, realtimeVisits] = await Promise.all([
        Promise.all(plannedSchedulesPromises),
        fetchStopMonitoring(siriStopId)
    ]);
    
    const plannedSchedulesMap = new Map<string, { first: string | null; last: string | null; }>();
    discoveredLines.forEach((line, index) => {
        plannedSchedulesMap.set(line.lineId, plannedSchedules[index]);
    });

    const byKey = new Map<string, { lineId: string; dest: string; list: Visit[] }>();
    realtimeVisits.forEach(v => {
        if (!v.lineId || !lineMetaMap.has(v.lineId)) return;
        const key = v.lineId + "|" + v.dest.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, { lineId: v.lineId, dest: v.dest, list: [] });
        if (v.minutes !== null) byKey.get(key)!.list.push(v);
    });

    const byLine = new Map<string, { lineId: string; dirs: Direction[] }>();
    for (const g of byKey.values()) {
        if (!byLine.has(g.lineId)) byLine.set(g.lineId, { lineId: g.lineId, dirs: [] });
        byLine.get(g.lineId)!.dirs.push({
            dest: g.dest,
            list: g.list.sort((a, b) => a.minutes! - b.minutes!).slice(0, perDir)
        });
    }

    const summary: BusSummary[] = discoveredLines.map(lineInfo => {
        const lineId = lineInfo.lineId;
        const lineGroup = byLine.get(lineId);
        const planned = plannedSchedulesMap.get(lineId) || { first: null, last: null };

        return {
            meta: {
                code: lineInfo.code,
                name: lineInfo.name,
                color: `#${lineInfo.color}`,
                text: '#ffffff',
            },
            planned: {
                first: planned.first,
                last: planned.last,
            },
            directions: lineGroup?.dirs || [],
        };
    });

    summary.sort((a, b) => (a.meta.code || '').localeCompare(b.meta.code || '', 'fr', { numeric: true }));
    return summary;
};