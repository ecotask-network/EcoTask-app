import React from "react";
import { View, Text } from "react-native";

export default function TaskListScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "bold" }}>Tasks</Text>
      <Text style={{ color: "#94A3B8", marginTop: 8 }}>Browse & filter tasks</Text>
    </View>
  );
}
