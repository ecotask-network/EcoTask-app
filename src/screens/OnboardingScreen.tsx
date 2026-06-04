import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function OnboardingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ fontSize: 48 }}>🌱</Text>
      <Text style={{ fontSize: 32, fontWeight: "bold", color: "#F8FAFC", marginTop: 16 }}>EcoTask</Text>
      <Text style={{ color: "#94A3B8", textAlign: "center", marginTop: 8 }}>
        Earn rewards for climate action
      </Text>
      <TouchableOpacity
        style={{
          marginTop: 32,
          padding: 16,
          backgroundColor: "#22C55E",
          borderRadius: 12,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Connect Wallet</Text>
      </TouchableOpacity>
    </View>
  );
}
