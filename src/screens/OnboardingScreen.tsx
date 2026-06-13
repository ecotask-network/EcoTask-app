import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useStellarWallet } from "../hooks/useStellarWallet";
import { colors, spacing } from "../utils/theme";

export default function OnboardingScreen() {
  const { connectFreighter, createInAppWallet, isConnecting, error } = useStellarWallet();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.xl }}>
      <View style={{ alignItems: "center", marginBottom: spacing.xl * 2 }}>
        <Text style={{ fontSize: 48, color: colors.primary }}>🌱</Text>
        <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.text, marginTop: spacing.sm }}>EcoTask</Text>
        <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm }}>
          Earn rewards for climate action
        </Text>
      </View>

      {error && (
        <Text style={{ color: colors.error, textAlign: "center", marginBottom: spacing.md }}>{error}</Text>
      )}

      <TouchableOpacity
        onPress={connectFreighter}
        disabled={isConnecting}
        style={{
          padding: spacing.md,
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: spacing.md,
          opacity: isConnecting ? 0.5 : 1,
        }}
      >
        {isConnecting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Connect Freighter</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={createInAppWallet}
        disabled={isConnecting}
        style={{
          padding: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>Create Test Wallet</Text>
      </TouchableOpacity>

      <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 12, marginTop: spacing.xl }}>
        Testnet only • No real funds required
      </Text>
    </View>
  );
}
