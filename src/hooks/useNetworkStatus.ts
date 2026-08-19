import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInitialised: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState(true);
  const [isInitialised, setIsInitialised] = useState(false);

  useEffect(() => {
    let cancelled = false;

    NetInfo.fetch().then(state => {
      if (cancelled) {
        return;
      }
      setIsConnected(state.isConnected ?? true);
      setIsInitialised(true);
    });

    const unsub = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
      setIsInitialised(true);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { isConnected, isInitialised };
}
