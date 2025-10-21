import { useState, useCallback } from 'react';

type StatusType = 'ok' | 'warning' | 'error' | 'loading';

interface StatusState {
  status: StatusType;
  lastUpdate?: string;
  errors: number;
}

interface UseStatusReturn extends StatusState {
  setLoading: () => void;
  setSuccess: () => void;
  setError: () => void;
  setWarning: () => void;
  reset: () => void;
}

export const useStatus = (initialStatus: StatusType = 'loading'): UseStatusReturn => {
  const [state, setState] = useState<StatusState>({
    status: initialStatus,
    lastUpdate: undefined,
    errors: 0
  });

  const setLoading = useCallback(() => {
    setState(prev => ({ ...prev, status: 'loading' }));
  }, []);

  const setSuccess = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      status: 'ok', 
      lastUpdate: new Date().toISOString() 
    }));
  }, []);

  const setError = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      status: 'error', 
      errors: prev.errors + 1 
    }));
  }, []);

  const setWarning = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      status: 'warning', 
      lastUpdate: new Date().toISOString() 
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'loading',
      lastUpdate: undefined,
      errors: 0
    });
  }, []);

  return {
    ...state,
    setLoading,
    setSuccess,
    setError,
    setWarning,
    reset
  };
};