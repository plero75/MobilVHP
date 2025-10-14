
import React, { useState, useEffect } from 'react';
import { fetchTrafficMessages } from '../services/api';
import { useInterval } from '../hooks/useInterval';

const TRAFFIC_LINES = ["C01742", "C02251", "C01219"]; // RER A, Bus 77, Bus 201

export const TrafficBanner: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMessages = async () => {
    setIsLoading(true);
    const msgs = await fetchTrafficMessages(TRAFFIC_LINES);
    setMessages(msgs);
    setIsLoading(false);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useInterval(loadMessages, 5 * 60 * 1000); // Refresh every 5 minutes

  const hasAlerts = messages.length > 0;
  const bannerClasses = hasAlerts
    ? 'bg-[#fff2f2] border-[#ffc7c7] text-status-warn'
    : 'bg-[#eef9f0] border-[#cde9d6] text-status-ok';

  return (
    <div className={`mx-4 mt-2.5 border-2 rounded-lg px-3 py-2 text-sm font-medium ${bannerClasses}`}>
      {isLoading
        ? 'Chargement des informations trafic...'
        : hasAlerts
        ? messages.join(' | ')
        : 'Trafic normal sur les lignes suivies.'}
    </div>
  );
};
