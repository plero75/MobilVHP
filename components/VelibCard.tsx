import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './Card';
import { useInterval } from '../hooks/useInterval';
import { fetchVelibStation } from '../services/api';
import { VELIB_STATIONS } from '../constants';
import type { VelibStationStats } from '../types';

const BikeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a6 6 0 01-6-6h12a6 6 0 01-6 6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6a2 2 0 100-4 2 2 0 000 4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v6m-3-3h6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l2 3m-2-3l-2 3" />
  </svg>
);

const EBikeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a6 6 0 01-6-6h12a6 6 0 01-6 6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6a2 2 0 100-4 2 2 0 000 4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v6m-3-3h6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l2 3m-2-3l-2 3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 11.5l2-2 2 2-2 2-2-2z" className="fill-sky-500 stroke-sky-500"/>
  </svg>
);

const DockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V9a2 2 0 012-2h2a2 2 0 012 2v12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 7V5" />
    </svg>
);


const VelibStation: React.FC<{ title: string; stats: VelibStationStats | null }> = ({ title, stats }) => (
  <div className="bg-[#f7f9ff] border border-app-panel-border rounded-lg p-3">
    <div className="font-bold text-center text-app-text mb-2.5">{title}</div>
    {stats ? (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center justify-center">
          <BikeIcon />
          <div className="text-3xl font-extrabold text-app-text mt-1.5">{stats.mechanical}</div>
          <div className="text-sm text-gray-600">Mécaniques</div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <EBikeIcon />
          <div className="text-3xl font-extrabold text-app-text mt-1.5">{stats.ebike}</div>
          <div className="text-sm text-gray-600">Électriques</div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <DockIcon />
          <div className="text-3xl font-extrabold text-app-text mt-1.5">{stats.docks}</div>
          <div className="text-sm text-gray-600">Places</div>
        </div>
      </div>
    ) : (
      <div className="text-center text-sm text-gray-500 min-h-[88px] flex items-center justify-center">Données indisponibles</div>
    )}
  </div>
);

export const VelibCard: React.FC = () => {
  const [vincennesStats, setVincennesStats] = useState<VelibStationStats | null>(null);
  const [breuilStats, setBreuilStats] = useState<VelibStationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshVelib = useCallback(async () => {
    setLoading(true);
    const [vincennesData, breuilData] = await Promise.all([
      fetchVelibStation(VELIB_STATIONS.VINCENNES),
      fetchVelibStation(VELIB_STATIONS.BREUIL)
    ]);

    if (vincennesData?.results?.[0]) {
      const st = vincennesData.results[0];
      setVincennesStats({
        mechanical: st.mechanical_bikes ?? st.mechanical ?? 0,
        ebike: st.ebike_bikes ?? st.ebike ?? 0,
        docks: st.numdocksavailable ?? st.num_docks_available ?? 0
      });
    }

    if (breuilData?.results?.[0]) {
      const st = breuilData.results[0];
      setBreuilStats({
        mechanical: st.mechanical_bikes ?? st.mechanical ?? 0,
        ebike: st.ebike_bikes ?? st.ebike ?? 0,
        docks: st.numdocksavailable ?? st.num_docks_available ?? 0
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshVelib();
  }, [refreshVelib]);

  useInterval(refreshVelib, 30 * 1000);

  return (
    <Card title={<strong>Vélib</strong>}>
      {loading && !vincennesStats ? (
        <div>Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <VelibStation title="Vincennes" stats={vincennesStats} />
          <VelibStation title="École du Breuil" stats={breuilStats} />
        </div>
      )}
    </Card>
  );
};