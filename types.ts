
export interface Weather {
  temperature: number;
}

export interface Saint {
  name: string;
}

export interface Visit {
  lineId: string | null;
  dest: string;
  expected: string | null;
  minutes: number | null;
  delayMin: number | null;
  cancelled: boolean;
}

export interface LineGroup {
  lineId: string | null;
  meta: LineMeta;
  dirs: Direction[];
}

export interface Direction {
  dest: string;
  list: Visit[];
}

export interface LineMeta {
  code: string;
  color: string;
  text: string;
  name?: string;
}

export interface VelibStationStats {
  mechanical: number;
  ebike: number;
  docks: number;
}

export interface NewsArticle {
  title: string;
  desc: string;
}

export interface Course {
  ts: number;
  heure: string;
  lib: string;
  dist: number;
  disc: string;
  dot: number;
  ref: string;
}

export interface GtfsFallback {
  status: "first" | "ended" | "next";
  timeISO: string;
}

export interface BusSummary {
  meta: LineMeta;
  planned: {
    first: string | null;
    last: string | null;
  };
  directions: Direction[];
}
