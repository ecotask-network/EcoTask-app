import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TaskStackParamList } from "../navigation/TaskStackNavigator";

type TaskDetailRoute = RouteProp<TaskStackParamList, "TaskDetail">;
type TaskDetailNav = NativeStackNavigationProp<TaskStackParamList, "TaskDetail">;

const MOCK_TASK = {
  id: "1",
  title: "Plant 10 trees in your area",
  description: "Find a suitable location and plant 10 native trees. Take photos before and after. GPS coordinates must match the task zone.",
  type: "Reforestation",
  rewardAmount: 50,
  lat: 40.7128,
  lng: -74.006,
  status: "open",
};

export default function TaskDetailScreen() {
  const route = useRoute<TaskDetailRoute>();
  const navigation = useNavigation<TaskDetailNav>();

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        <Text style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "bold" }}>{MOCK_TASK.title}</Text>
        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <Text style={{ color: "#22C55E", fontSize: 14, fontWeight: "600" }}>{MOCK_TASK.rewardAmount} ECO</Text>
          <Text style={{ color: "#94A3B8", marginLeft: 12 }}>{MOCK_TASK.type}</Text>
        </View>
      </View>

      <Text style={{ color: "#94A3B8", marginTop: 24, lineHeight: 22 }}>{MOCK_TASK.description}</Text>

      <View style={{ backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginTop: 24 }}>
        <Text style={{ color: "#94A3B8", fontSize: 12 }}>LOCATION</Text>
        <Text style={{ color: "#F8FAFC", marginTop: 4 }}>{MOCK_TASK.lat.toFixed(4)}, {MOCK_TASK.lng.toFixed(4)}</Text>
      </View>

      <View style={{ backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginTop: 12 }}>
        <Text style={{ color: "#94A3B8", fontSize: 12 }}>STATUS</Text>
        <Text style={{ color: "#22C55E", marginTop: 4, textTransform: "capitalize" }}>{MOCK_TASK.status}</Text>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate("SubmitProof", { taskId: route.params.taskId })}
        style={{
          marginTop: 32,
          padding: 16,
          backgroundColor: "#22C55E",
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Start Task</Text>
      </TouchableOpacity>
    </View>
  );
}
