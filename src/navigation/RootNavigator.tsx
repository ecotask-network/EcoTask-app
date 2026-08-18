import React, { useEffect } from 'react';
import { Linking } from 'react-native';
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
import {
  ECOTASK_SCHEME,
  resolveLobstrCallback,
} from '../services/lobstr';

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

/**
 * Linking configuration for the `ecotask://` deep-link scheme.
 * This makes React Navigation aware of inbound deep links so the app
 * resumes on the correct screen after backgrounding for Lobstr signing.
 */
const linking = {
  prefixes: ['ecotask://'],
  config: {
    screens: {
      Main: 'main',
      Onboarding: 'onboarding',
    },
  },
};

export default function RootNavigator() {
  const isConnected = useWalletStore(s => s.isConnected);

  useEffect(() => {
    /**
     * Handle deep links that arrive while the app is already open
     * (foreground / background).
     */
    function handleUrl({ url }: { url: string }) {
      try {
        const parsed = new URL(url);
        // ecotask://lobstr/callback?xdr=...
        // URL parses: hostname='lobstr', pathname='/callback'
        if (
          parsed.protocol === `${ECOTASK_SCHEME}:` &&
          parsed.hostname === 'lobstr' &&
          parsed.pathname === '/callback'
        ) {
          resolveLobstrCallback(url);
        }
      } catch {
        // Ignore malformed URLs.
      }
    }

    const subscription = Linking.addEventListener('url', handleUrl);

    // Handle the case where the app was launched cold via a deep link.
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer linking={linking}>
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
