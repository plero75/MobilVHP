
import React, { useState, useEffect } from 'react';
import { useInterval } from '../hooks/useInterval';

export const Footer: React.FC = () => {
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString("fr-FR"));

  // This is a bit of a trick. The data itself refreshes on its own schedule.
  // This just updates the footer timestamp every minute to show the dashboard is "live".
  useInterval(() => {
    setLastUpdate(new Date().toLocaleTimeString("fr-FR"));
  }, 60 * 1000);

  return (
    <footer className="flex items-center justify-between text-xs p-4 bg-app-blue text-[#cfe0ff] mt-4">
      <div>© 2025 • PRIM IDFM, Open-Meteo, Nominis, Opendata Paris, PMU, Sytadin</div>
      <div>Dernière mise à jour : {lastUpdate}</div>
    </footer>
  );
};
