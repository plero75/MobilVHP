
import React from 'react';
import { hhmm } from '../services/api';
import type { Visit } from '../types';

interface TimeBadgeProps {
  visit: Visit;
}

export const TimeBadge: React.FC<TimeBadgeProps> = ({ visit }) => {
  let badgeClass = 'bg-chip-bg text-chip-text';
  if (visit.cancelled) {
    badgeClass = 'bg-[#f2f3f5] text-status-warn';
  } else if (visit.minutes !== null && visit.minutes <= 1.5) {
    badgeClass += ' outline-2 outline-green-500';
  } else if (visit.delayMin !== null && visit.delayMin > 0) {
    badgeClass += ' outline-2 outline-dashed outline-yellow-500';
  }
  
  const minutesText = visit.cancelled ? 'Supp.' : (visit.minutes !== null ? String(visit.minutes) : '—');
  const subText = visit.expected && !visit.cancelled
    ? `Prévu ${hhmm(visit.expected)}${visit.delayMin && visit.delayMin > 0 ? ` (+${visit.delayMin}m)` : ''}`
    : visit.cancelled ? 'Supprimé' : '';

  return (
    <div className="flex flex-col items-center">
      <div className={`font-extrabold rounded-lg py-1.5 px-2.5 min-w-[62px] text-center ${badgeClass}`}>
        {minutesText}
      </div>
      {subText && <div className="text-xs text-gray-600 mt-1">{subText}</div>}
    </div>
  );
};
