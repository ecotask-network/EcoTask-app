import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useWalletStore } from "../store/walletStore";

export default function WalletScreen() {
  const publicKey = useWalletStore((s) => s.publicKey);
  const balance = useWalletStore((s) => s.balance);
  const disconnect = useWalletStore((s) => s.disconnect);

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", padding: 24 }}>
      <Text style={{ color: "#F8FAFC", fontSize: 28, fontWeight: "bold", marginTop: 60 }}>Wallet</Text>

      <View style={{ backgroundColor: "#1E293B", borderRadius: 12, padding: 24, marginTop: 24, alignItems: "center" }}>
        <Text style={{ color: "#94A3B8", fontSize: 14 }}>Balance</Text>
        <Text style={{ color: "#22C55E", fontSize: 48, fontWeight: "bold", marginTop: 8 }}>
          {balance ?? "0"} ECO
        </Text>
      </View>

      <View style={{ backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginTop: 16 }}>
        <Text style={{ color: "#94A3B8", fontSize: 12 }}>PUBLIC KEY</Text>
        <Text style={{ color: "#F8FAFC", marginTop: 4, fontSize: 12 }} numberOfLines={1}>
          {publicKey ?? "Not connected"}
        </Text>
      </View>

      <TouchableOpacity
        onPress={disconnect}
        style={{
          marginTop: 32,
          padding: 16,
          backgroundColor: "#EF4444",
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Disconnect Wallet</Text>
      </TouchableOpacity>
    </View>
  );
}
