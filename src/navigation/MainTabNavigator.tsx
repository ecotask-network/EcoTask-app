import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import TaskListScreen from "../screens/TaskListScreen";
import SubmitProofScreen from "../screens/SubmitProofScreen";
import WalletScreen from "../screens/WalletScreen";

export type MainTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Submit: undefined;
  Wallet: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#22C55E",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "#1E293B" },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Tasks" component={TaskListScreen} />
      <Tab.Screen name="Submit" component={SubmitProofScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
    </Tab.Navigator>
  );
}
