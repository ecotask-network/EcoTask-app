import React from "react";
import { View, Text } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "bold" }}>Profile</Text>
      <Text style={{ color: "#94A3B8", marginTop: 8 }}>User stats & settings</Text>
    </View>
  );
}
