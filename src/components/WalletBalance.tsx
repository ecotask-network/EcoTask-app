import React from "react";
import { View, Text } from "react-native";
import { useWalletStore } from "../store/walletStore";
import { colors, spacing } from "../utils/theme";

export default function WalletBalance() {
  const { balance, isConnected } = useWalletStore();

  if (!isConnected) return null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
      <Text style={{ color: colors.primary, fontWeight: "600" }}>{balance ?? "0"} XLM</Text>
    </View>
  );
}
