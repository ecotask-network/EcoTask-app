import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/MainTabNavigator";

type HomeNav = BottomTabNavigationProp<MainTabParamList, "Home">;

const stats = [
  { label: "Trees planted", value: "0", unit: "trees" },
  { label: "Plastic collected", value: "0", unit: "kg" },
  { label: "CO₂ reduced", value: "0", unit: "kg" },
];

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", padding: 24 }}>
      <Text style={{ color: "#F8FAFC", fontSize: 28, fontWeight: "bold", marginTop: 60 }}>Dashboard</Text>
      <Text style={{ color: "#94A3B8", marginTop: 4 }}>Your climate impact summary</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 32 }}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              backgroundColor: "#1E293B",
              borderRadius: 12,
              padding: 16,
              marginHorizontal: 4,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#22C55E", fontSize: 32, fontWeight: "bold" }}>{stat.value}</Text>
            <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>{stat.unit}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate("Tasks")}
        style={{
          marginTop: 32,
          padding: 16,
          backgroundColor: "#22C55E",
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Browse Tasks</Text>
      </TouchableOpacity>
    </View>
  );
}
