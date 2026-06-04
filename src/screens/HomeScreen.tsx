import React from "react";
import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "bold" }}>Home</Text>
      <Text style={{ color: "#94A3B8", marginTop: 8 }}>Dashboard & impact summary</Text>
    </View>
  );
}
