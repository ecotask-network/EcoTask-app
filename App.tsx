import React, { useEffect } from 'react';
import { StatusBar, AppState, AppStateStatus, View } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { useProofSubmit } from './src/hooks/useProofSubmit';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import { NetworkStatusProvider } from './src/hooks/useNetworkStatus';
import {
  registerForPushNotifications,
  sendTokenToServer,
} from './src/services/notifications';
import { initWalletVault } from './src/services/walletVault';

function AppSync() {
  const { syncPendingProofs } = useProofSubmit();

  useEffect(() => {
    void initWalletVault();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void syncPendingProofs();
      }
    });
    return () => sub.remove();
  }, [syncPendingProofs]);

  useEffect(() => {
    void registerForPushNotifications().then(token => {
      if (token) {
        void sendTokenToServer(token);
      }
    });
  }, []);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <NetworkStatusProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <AppSync />
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <RootNavigator />
        </View>
      </NetworkStatusProvider>
    </ErrorBoundary>
  );
}
