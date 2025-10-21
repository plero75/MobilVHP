// ============================================================================
// 🌍 CONSTANTS – Dashboard Transports Hippodrome de Vincennes
// Version corrigée et optimisée (PRIM v2 / Proxy Cloudflare / IDFM)
// ============================================================================

// --- Proxy Cloudflare pour contourner CORS ---
export const PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

// ============================================================================
// 🌦 Météo / Actualités / Saint du jour
// ============================================================================

// Open-Meteo API (latitude/longitude Vincennes)
export const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=48.83&longitude=2.42&current_weather=true";

// Saint du jour (Nominis)
export const SAINT_URL = "https://nominis.cef.fr/json/nominis.php";

// Actualités France Info (remplacement Le Monde suite 403)
export const RSS_URL = "https://www.francetvinfo.fr/titres.rss";

// ============================================================================
// 🚉 Île-de-France Mobilités – API PRIM (CORRIGÉ)
// ============================================================================

// URLs corrigées pour PRIM v2
const PRIM_BASE_URL = "https://prim.iledefrance-mobilites.fr/marketplace";

// --- Base Navitia (pour GTFS théorique, découverte de lignes) ---
export const NAVITIA_BASE = `${PRIM_BASE_URL}/v2/navitia`;

// --- Temps réel (SIRI Stop Monitoring) ---
export const PRIM_STOP = (stopId: string) =>
  `${PRIM_BASE_URL}/stop-monitoring?MonitoringRef=${stopId}`;

// --- Infos trafic (SIRI General Message) ---
export const PRIM_GM = (lineId: string) =>
  `${PRIM_BASE_URL}/general-message?LineRef=line:IDFM:${lineId}`;

// --- Horaires théoriques (GTFS fallback via Navitia) ---
export const NAVI_SCHEDULE = (lineId: string, navitiaStopId: string, dt: string) =>
  `${NAVITIA_BASE}/lines/line:IDFM:${lineId}/stop_areas/${navitiaStopId}/stop_schedules?from_datetime=${dt}`;

// --- Découverte stop_points dans une stop_area (évite 404) ---
export const NAVI_STOP_POINTS = (navitiaStopAreaId: string) =>
  `${NAVITIA_BASE}/stop_areas/${navitiaStopAreaId}/stop_points?count=200`;

// --- Horaires via stop_points (plus fiable) ---
export const NAVI_SCHEDULE_SP = (lineId: string, navitiaStopPointId: string, dt: string) =>
  `${NAVITIA_BASE}/lines/line:IDFM:${lineId}/stop_points/${navitiaStopPointId}/stop_schedules?from_datetime=${dt}&count=200`;

// ============================================================================
// 🧭 Référentiel OpenData IDFM (lignes et couleurs)
// ============================================================================

const ODS_BASE_URL = "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/referentiel-des-lignes/records";

export const ODS_BY_ID = (lineId: string) =>
  `${ODS_BASE_URL}?where=id_line%3D%22${lineId}%22&limit=1`;

export const ODS_BY_CD = (code: string) =>
  `${ODS_BASE_URL}?where=shortname_line%3D%22${encodeURIComponent(code)}%22&limit=1`;

// ============================================================================
// 🐎 PMU – Programmes de courses (via proxy obligatoire)
// ============================================================================

export const PMU_DAY_URL = (day: string) =>
  `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${day}`;

// ============================================================================
// 🚏 IDENTIFIANTS DES ARRÊTS IDFM (Format SIRI)
// ============================================================================

export const STOP_IDS = {
  RER_A: "STIF:StopArea:SP:43135:",
  HIPPODROME: "STIF:StopArea:SP:463641:",
  BREUIL: "STIF:StopArea:SP:463644:",
  // StopArea principal pour toutes les lignes de bus à Joinville RER
  JOINVILLE_BUS_SIRI: "STIF:StopArea:SP:43135:",
};

// ID pour la découverte de lignes Navitia, différent du format SIRI
export const JOINVILLE_BUS_DISCOVERY_ID = "70640";

// ============================================================================
// 🚲 Vélib' – Stations locales
// ============================================================================

export const VELIB_STATIONS = {
  VINCENNES: "12104",
  BREUIL: "12115",
};

// ============================================================================
// ⚙️ Configuration technique
// ============================================================================

export const API_CONFIG = {
  TIMEOUT: 30000, // Timeout augmenté à 30s
  RETRY_COUNT: 3, // Nombre de tentatives
  RETRY_DELAY: 2000, // Délai entre tentatives (ms)
  UPDATE_INTERVAL: 60000, // Intervalle de mise à jour (1 min)
  VELIB_UPDATE_INTERVAL: 30000, // Vélib toutes les 30s
};