import React, { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useWalletStore } from "../store/walletStore";
import { useStellarWallet } from "../hooks/useStellarWallet";
import { colors, spacing } from "../utils/theme";
import OnboardingScreen from "./OnboardingScreen";

export default function WalletScreen() {
  const { balance, publicKey, isConnected } = useWalletStore();
  const { disconnectWallet, refreshBalance } = useStellarWallet();

  useEffect(() => {
    refreshBalance();
  }, []);

  if (!isConnected) {
    return <OnboardingScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "bold" }}>Wallet</Text>

      <View style={{ marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 16 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Balance</Text>
        <Text style={{ color: colors.text, fontSize: 36, fontWeight: "bold", marginTop: spacing.xs }}>
          {balance ?? "0"} <Text style={{ fontSize: 18, color: colors.primary }}>XLM</Text>
        </Text>

        {publicKey && (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: spacing.md }} numberOfLines={1}>
            {publicKey}
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={disconnectWallet}
        style={{
          marginTop: spacing.xl,
          padding: spacing.md,
          backgroundColor: colors.error,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "600" }}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}
