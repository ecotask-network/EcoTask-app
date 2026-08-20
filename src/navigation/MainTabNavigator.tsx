import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import TaskStackNavigator from './TaskStackNavigator';
import WalletScreen from '../screens/WalletScreen';
import SubmitPlaceholderScreen from '../screens/SubmitPlaceholderScreen';
import TabBarIcon from '../components/TabBarIcon';

// react-navigation's typed hooks require ParamList to satisfy an implicit
// index signature, which only object-literal `type` aliases provide (not
// `interface`) — https://reactnavigation.org/docs/typescript
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
        tabBarActiveTintColor: '#22C55E',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1E293B' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon emoji="🏠" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon emoji="🌿" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Submit"
        component={SubmitPlaceholderScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon emoji="📸" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon emoji="💰" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
