import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { TaskStackParamList } from "../navigation/TaskStackNavigator";

type SubmitProofRoute = RouteProp<TaskStackParamList, "SubmitProof">;

export default function SubmitProofScreen() {
  const route = useRoute<SubmitProofRoute>();

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        <Text style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "bold" }}>Submit Proof</Text>
        <Text style={{ color: "#94A3B8", marginTop: 4 }}>Task ID: {route.params.taskId}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TouchableOpacity
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: "#1E293B",
            borderWidth: 2,
            borderColor: "#22C55E",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 40 }}>📷</Text>
        </TouchableOpacity>
        <Text style={{ color: "#94A3B8", marginTop: 12 }}>Tap to capture proof photo</Text>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24, backgroundColor: "#1E293B", padding: 12, borderRadius: 12 }}>
          <Text style={{ fontSize: 20 }}>📍</Text>
          <Text style={{ color: "#22C55E", marginLeft: 8 }}>GPS: 40.7128, -74.0060</Text>
        </View>
      </View>

      <TouchableOpacity
        style={{
          padding: 16,
          backgroundColor: "#22C55E",
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Submit Proof</Text>
      </TouchableOpacity>
    </View>
  );
}
