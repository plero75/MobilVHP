// ============================================================================
// 🌍 CONSTANTS – Dashboard Transports Hippodrome de Vincennes
// Version stable et corrigée (PRIM v2 / Proxy Cloudflare / IDFM)
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

// Actualités France Info (flux RSS) - Replaced with Le Monde due to HTTP 403 errors.
export const RSS_URL = "https://www.lemonde.fr/rss/une.xml";

// ============================================================================
// 🚉 Île-de-France Mobilités – API PRIM
// ============================================================================

// The /api endpoint is incorrect; the correct path is /marketplace.
const PRIM_BASE_URL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace";

// --- Base Navitia (pour GTFS théorique, découverte de lignes) ---
export const NAVITIA_BASE = `${PRIM_BASE_URL}/v2/navitia`;

// --- Temps réel (SIRI Stop Monitoring) ---
// This is a direct SIRI endpoint, not under the Navitia path.
export const PRIM_STOP = (stopId: string) =>
  `${PRIM_BASE_URL}/stop-monitoring?MonitoringRef=${stopId}`;

// --- Infos trafic (SIRI General Message) ---
// This is a direct SIRI endpoint, not under the Navitia path.
export const PRIM_GM = (lineId: string) =>
  `${PRIM_BASE_URL}/general-message?LineRef=line:IDFM:${lineId}`;

// --- Horaires théoriques (GTFS fallback via Navitia) ---
// This correctly uses the Navitia endpoint.
export const NAVI_SCHEDULE = (lineId: string, navitiaStopId: string, dt: string) =>
  `${NAVITIA_BASE}/lines/line:IDFM:${lineId}/stop_areas/${navitiaStopId}/stop_schedules?from_datetime=${dt}`;

// ============================================================================
// 🧭 Référentiel OpenData IDFM (lignes et couleurs)
// ============================================================================

const ODS_BASE_URL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/referentiel-des-lignes/records";

export const ODS_BY_ID = (lineId: string) =>
  `${ODS_BASE_URL}?where=id_line%3D%22${lineId}%22&limit=1`;

export const ODS_BY_CD = (code: string) =>
  `${ODS_BASE_URL}?where=shortname_line%3D%22${encodeURIComponent(code)}%22&limit=1`;

// ============================================================================
// 🐎 PMU – Programmes de courses (via proxy obligatoire)
// ============================================================================

export const PMU_DAY_URL = (day: string) =>
  `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${day}`;

// ============================================================================
// 🚏 IDENTIFIANTS DES ARRÊTS IDFM (Format SIRI)
// ============================================================================

export const STOP_IDS = {
  RER_A: "STIF:StopArea:SP:43135:",
  HIPPODROME: "STIF:StopArea:SP:463641:",
  BREUIL: "STIF:StopArea:SP:463644:",
  // This is the main StopArea for all bus lines at Joinville RER
  JOINVILLE_BUS_SIRI: "STIF:StopArea:SP:43135:",
};

// ID for Navitia line discovery, which is different from SIRI.
export const JOINVILLE_BUS_DISCOVERY_ID = "70640";


// ============================================================================
// 🚲 Vélib’ – Stations locales
// ============================================================================

export const VELIB_STATIONS = {
  VINCENNES: "12104",
  BREUIL: "12115",
};
