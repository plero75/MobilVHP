import React from 'react';
import type { LineGroup, GtfsFallback } from '../types';
import { hhmm } from '../services/api';

const GtfsNote: React.FC<{ fallback: GtfsFallback | null }> = ({ fallback }) => {
    if (!fallback) return <div className="note-gtfs">Données théoriques indisponibles.</div>;
    const message = {
        first: `Premier service à ${hhmm(fallback.timeISO)}`,
        ended: `Service terminé — prochain à ${hhmm(fallback.timeISO)}`,
        next: `Prochain départ théorique à ${hhmm(fallback.timeISO)}`
    }[fallback.status];
    return <div className="note-gtfs">{message}</div>;
};

const NoteGTFSWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="bg-slate-100 border border-dashed border-slate-300 rounded-lg p-2 text-xs text-gray-600 my-2">
        {children}
    </div>
);

const DailyScheduleInfo: React.FC<{ schedule: { first: string | null; last: string | null; } | undefined }> = ({ schedule }) => {
    if (!schedule || !schedule.first || !schedule.last) return null;
    return (
        <div className="text-xs text-gray-500">
            Service de {hhmm(schedule.first)} à {hhmm(schedule.last)}
        </div>
    );
};

interface LineBlockProps {
  lineGroup: LineGroup;
  fallback: GtfsFallback | null;
  schedule?: { first: string | null; last: string | null; };
}

export const LineBlock: React.FC<LineBlockProps> = ({ lineGroup, fallback, schedule }) => {
  const { meta, dirs } = lineGroup;
  
  // For terminus stops, the API might return two directions but only one with actual departures.
  // This logic filters out empty directions ONLY IF at least one other direction has data.
  // If all directions are empty (e.g., service interruption), they will all be shown to trigger the GTFS fallback.
  let directionsToRender = dirs;
  const hasRealTimeData = dirs.some(d => d.list.length > 0);
  if (dirs.length > 1 && hasRealTimeData) {
      directionsToRender = dirs.filter(d => d.list.length > 0);
  }

  return (
    <div className="bg-[#f7f9ff] border border-app-panel-border rounded-lg p-2 my-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center min-w-[44px] h-6 px-2.5 rounded-full font-extrabold"
          style={{ backgroundColor: meta.color, color: meta.text }}
        >
          {meta.code}
        </span>
        {!hasRealTimeData && <DailyScheduleInfo schedule={schedule} />}
      </div>
      <div className="space-y-3">
        {directionsToRender.length > 0 ? (
          directionsToRender.map((dir, index) => (
            <div key={index} className="grid grid-cols-2 items-center text-sm gap-2">
              <div className="font-bold text-app-blue truncate">{dir.dest || 'Direction'}</div>
              <div className="flex flex-wrap gap-2 justify-end">
                {dir.list.length > 0 ? (
                  dir.list.map((visit, vIndex) => {
                    let text: React.ReactNode = visit.minutes !== null ? `${visit.minutes} min` : '...';
                    let titleText = `Prévu à ${hhmm(visit.expected)}`;

                    let className = 'font-bold text-center px-2 py-1.5 rounded-md text-sm min-w-[70px] transition-all';
                    
                    if (visit.cancelled) {
                      className += ' bg-red-100 text-red-700 line-through';
                      text = 'Supp.';
                      titleText = 'Supprimé';
                    } else if (visit.delayMin && visit.delayMin > 0) {
                      className += ' bg-yellow-100 text-yellow-800 border border-yellow-300';
                      titleText += ` (retard ${visit.delayMin} min)`;
                    } else if (visit.minutes !== null && visit.minutes <= 1) {
                      className += ' bg-green-100 text-green-800 border-2 border-green-400 animate-pulse';
                      text = "Approche";
                    } else {
                      className += ' bg-blue-100 text-blue-800';
                    }

                    return (
                      <div key={vIndex} className={className} title={titleText}>
                        {text}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-gray-500 pr-1 italic">Pas de passage prévu</span>
                )}
              </div>
            </div>
          ))
        ) : (
          !hasRealTimeData && !fallback && <div className="text-xs text-gray-500 text-center py-2">Aucun service actuellement.</div>
        )}
      </div>
      {!hasRealTimeData && fallback && (
          <NoteGTFSWrapper>
              <GtfsNote fallback={fallback} />
          </NoteGTFSWrapper>
      )}
    </div>
  );
};
