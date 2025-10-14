import React, { useState, useEffect } from 'react';
import { useInterval } from './useInterval';

export const useClock = () => {
  const [time, setTime] = useState(new Date());

  useInterval(() => {
    setTime(new Date());
  }, 1000);

  const dateString = time.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const timeString = time.toLocaleTimeString("fr-FR");

  return { dateString, timeString };
};