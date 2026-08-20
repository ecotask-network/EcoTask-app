import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useWalletStore } from '../store/walletStore';
import MainTabNavigator from './MainTabNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import SubmitProofScreen from '../screens/SubmitProofScreen';
import SendTokensScreen from '../screens/SendTokensScreen';
import { SubmitProofParams } from '../types';

// react-navigation's typed hooks require ParamList to satisfy an implicit
// index signature, which only object-literal `type` aliases provide (not
// `interface`) — https://reactnavigation.org/docs/typescript
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Profile: undefined;
  EditProfile: undefined;
  TaskDetail: { taskId: string };
  SubmitProof: SubmitProofParams;
  SendTokens: undefined;
  NotificationPreferences: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isConnected = useWalletStore(s => s.isConnected);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isConnected ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="NotificationPreferences"
              component={NotificationPreferencesScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="SubmitProof"
              component={SubmitProofScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="SendTokens"
              component={SendTokensScreen}
              options={{ presentation: 'card' }}
            />
          </>
        ) : (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
