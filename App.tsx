import React, { useEffect } from "react";
import { StatusBar, AppState, AppStateStatus, View } from "react-native";
import RootNavigator from "./src/navigation/RootNavigator";
import { useProofSubmit } from "./src/hooks/useProofSubmit";
import ErrorBoundary from "./src/components/ErrorBoundary";
import OfflineBanner from "./src/components/OfflineBanner";

function AppSync() {
  const { syncPendingProofs } = useProofSubmit();

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        syncPendingProofs();
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <AppSync />
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <RootNavigator />
      </View>
    </ErrorBoundary>
  );
}
