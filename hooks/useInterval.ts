
import React, { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delay: number | null) {
  // FIX: Initialize useRef with null to avoid "Expected 1 arguments, but got 0" error in some environments.
  const savedCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
