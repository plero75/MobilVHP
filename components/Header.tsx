
import React, { useState, useEffect } from 'react';
import { useClock } from '../hooks/useClock';
import { useInterval } from '../hooks/useInterval';
import { fetchWeather, fetchSaint } from '../services/api';
import type { Weather, Saint } from '../types';

export const Header: React.FC = () => {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [saint, setSaint] = useState<Saint | null>(null);
  const { dateString, timeString } = useClock();

  const loadData = async () => {
    const weatherData = await fetchWeather();
    if (weatherData?.current_weather) {
      setWeather({ temperature: Math.round(weatherData.current_weather.temperature) });
    }

    const saintData = await fetchSaint();
    if (saintData?.response) {
      const value = saintData.response.prenom || saintData.response.prenoms;
      const name = Array.isArray(value) ? value.join(", ") : String(value || "");
      setSaint({ name });
    }
  };

  useEffect(() => {
    loadData();
  }, []);
  
  useInterval(loadData, 10 * 60 * 1000); // Refresh weather every 10 mins

  return (
    <header className="bg-app-blue text-white flex items-center justify-between p-4 sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="opacity-90 border-l border-[#2b5ad6] pl-2 text-lg">Hippodrome</div>
        <h1 className="text-xl font-normal hidden md:block">Dashboard Transports Vincennes</h1>
      </div>
      <div className="text-right text-xs space-y-0.5">
        <div className="font-semibold">{weather ? `${weather.temperature}°C` : '--°C'}</div>
        <div className="opacity-90">{saint ? `Fête : ${saint.name}` : 'Fête du jour'}</div>
        <div className="font-mono opacity-80">
          <span>{dateString}</span> <span className="font-bold">{timeString}</span>
        </div>
      </div>
    </header>
  );
};
