import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import TaskListScreen from "../screens/TaskListScreen";
import SubmitProofScreen from "../screens/SubmitProofScreen";
import WalletScreen from "../screens/WalletScreen";
import SubmitPlaceholderScreen from "../screens/SubmitPlaceholderScreen";

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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: () => null }} />
      <Tab.Screen name="Tasks" component={TaskListScreen} options={{ tabBarIcon: () => null }} />
      <Tab.Screen name="Submit" component={SubmitPlaceholderScreen} options={{ tabBarIcon: () => null }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarIcon: () => null }} />
    </Tab.Navigator>
  );
}
