import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useWalletStore } from "../store/walletStore";
import { useStellarWallet } from "../hooks/useStellarWallet";
import { colors, spacing } from "../utils/theme";
import OnboardingScreen from "./OnboardingScreen";
import EmptyState from "../components/EmptyState";
import Skeleton from "../components/LoadingSkeleton";

export default function WalletScreen() {
  const { balance, publicKey, isConnected } = useWalletStore();
  const { disconnectWallet, refreshBalance } = useStellarWallet();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshBalance().finally(() => setLoading(false));
  }, []);

  if (!isConnected) {
    return (
      <EmptyState
        icon="💳"
        title="No wallet connected"
        description="Connect to start earning"
      />
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
        <Skeleton height={28} width="40%" style={{ marginTop: spacing.xl }} />
        <View style={{ marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 16 }}>
          <Skeleton height={14} width="30%" />
          <Skeleton height={36} width="60%" style={{ marginTop: spacing.xs }} />
        </View>
      </View>
    );
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
