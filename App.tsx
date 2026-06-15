import React, { useEffect } from "react";
import { StatusBar, AppState, AppStateStatus } from "react-native";
import RootNavigator from "./src/navigation/RootNavigator";
import { useProofSubmit } from "./src/hooks/useProofSubmit";

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
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <AppSync />
      <RootNavigator />
    </>
  );
}
