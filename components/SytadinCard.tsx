import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { useInterval } from '../hooks/useInterval';

const SYTADIN_URL = "https://www.sytadin.fr/img/dynamique/trafic_idf.jpg";

export const SytadinCard: React.FC = () => {
  const [imageUrl, setImageUrl] = useState(`${SYTADIN_URL}?t=${Date.now()}`);

  const refreshImage = () => {
    setImageUrl(`${SYTADIN_URL}?t=${Date.now()}`);
  };

  useInterval(refreshImage, 5 * 60 * 1000); // Refresh every 5 minutes

  return (
    <Card title={<strong>Trafic routier — Sytadin (Île-de-France)</strong>} fullWidth>
      <div className="text-center bg-gray-100 p-1 rounded-lg">
        <img
          src={imageUrl}
          alt="Carte trafic Sytadin"
          className="w-full max-w-5xl mx-auto rounded-md"
        />
      </div>
    </Card>
  );
};