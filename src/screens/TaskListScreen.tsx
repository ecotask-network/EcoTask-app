import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TaskStackParamList } from "../navigation/TaskStackNavigator";

type TaskListNav = NativeStackNavigationProp<TaskStackParamList, "TaskList">;

const MOCK_TASKS = [
  { id: "1", title: "Plant 10 trees in your area", type: "Reforestation", rewardAmount: 50, lat: 40.7128, lng: -74.006, status: "open" },
  { id: "2", title: "Collect 5 kg of plastic waste", type: "Cleanup", rewardAmount: 30, lat: 40.7282, lng: -73.7949, status: "open" },
  { id: "3", title: "Clean 100 m² of park land", type: "Cleanup", rewardAmount: 40, lat: 40.7589, lng: -73.9851, status: "open" },
  { id: "4", title: "Build 3 compost bins", type: "Infrastructure", rewardAmount: 60, lat: 40.7484, lng: -73.9857, status: "open" },
  { id: "5", title: "Document local wildlife species", type: "Research", rewardAmount: 20, lat: 40.7829, lng: -73.9654, status: "open" },
];

export default function TaskListScreen() {
  const navigation = useNavigation<TaskListNav>();

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", padding: 24 }}>
      <Text style={{ color: "#F8FAFC", fontSize: 28, fontWeight: "bold", marginTop: 60 }}>Tasks</Text>
      <Text style={{ color: "#94A3B8", marginTop: 4 }}>Find tasks near you</Text>

      <FlatList
        data={MOCK_TASKS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate("TaskDetail", { taskId: item.id })}
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#F8FAFC", fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ color: "#94A3B8", fontSize: 14 }}>{item.type}</Text>
              <Text style={{ color: "#22C55E", fontSize: 14, fontWeight: "600" }}>{item.rewardAmount} ECO</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
