import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInitialised: boolean;
}

const NetworkStatusContext = createContext<NetworkStatus | undefined>(
  undefined,
);

interface NetworkStatusProviderProps {
  children: React.ReactNode;
}

export function NetworkStatusProvider({
  children,
}: NetworkStatusProviderProps): React.ReactElement {
  const [isConnected, setIsConnected] = useState(true);
  const [isInitialised, setIsInitialised] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void NetInfo.fetch().then(state => {
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

  return React.createElement(
    NetworkStatusContext.Provider,
    { value: { isConnected, isInitialised } },
    children,
  );
}

export function useNetworkStatus(): NetworkStatus {
  const context = useContext(NetworkStatusContext);

  const [localConnected, setLocalConnected] = useState(true);
  const [localInitialised, setLocalInitialised] = useState(false);

  useEffect(() => {
    if (context !== undefined) {
      return;
    }

    let cancelled = false;

    void NetInfo.fetch().then(state => {
      if (cancelled) {
        return;
      }
      setLocalConnected(state.isConnected ?? true);
      setLocalInitialised(true);
    });

    const unsub = NetInfo.addEventListener(state => {
      setLocalConnected(state.isConnected ?? true);
      setLocalInitialised(true);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [context]);

  if (context !== undefined) {
    return context;
  }

  return { isConnected: localConnected, isInitialised: localInitialised };
}
