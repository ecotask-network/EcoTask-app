import React, { useEffect, useRef, useCallback } from 'react';
import { Linking } from 'react-native';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
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
import { ECOTASK_SCHEME, resolveLobstrCallback } from '../services/lobstr';
import type { RootStackParamList } from './types';
import { parseDeepLink, navigateToTarget } from './deepLinks';
import {
  registerForPushNotifications,
  sendTokenToServer,
  listenForTokenRefresh,
  scheduleLocalNotification,
  NOTIFICATION_TYPES,
} from '../services/notifications';
import { getMessaging } from '../services/firebaseMessaging';

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
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);

  const pendingDeepLink = useRef<string | null>(null);

  const navigate = useCallback((link: string | undefined) => {
    const target = parseDeepLink(link);
    if (!target) {
      return;
    }
    const nav = navigationRef.current;
    if (!nav?.isReady()) {
      pendingDeepLink.current = link ?? null;
      return;
    }
    navigateToTarget(nav, target);
  }, []);

  useEffect(() => {
    let stopTokenRefresh: (() => void) | null = null;

    const bootstrap = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await sendTokenToServer(token);
      }

      stopTokenRefresh = listenForTokenRefresh(newToken => {
        void sendTokenToServer(newToken);
      });

      const messaging = getMessaging();

      const initialNotification = await messaging.getInitialNotification();
      if (typeof initialNotification?.data?.deepLink === 'string') {
        pendingDeepLink.current = initialNotification.data.deepLink;
      }

      const unsubForeground = messaging.onMessage(async remoteMessage => {
        const data = (remoteMessage.data ?? {}) as Record<string, string>;
        const type =
          data.type ?? data.notificationType ?? NOTIFICATION_TYPES.NEW_TASK;
        await scheduleLocalNotification({
          title: remoteMessage.notification?.title ?? 'EcoTask',
          body: remoteMessage.notification?.body ?? '',
          type,
          data: { ...data, type },
          deepLink: data.deepLink,
        });
      });

      messaging.onNotificationOpenedApp(remoteMessage => {
        const deepLink = (remoteMessage.data?.deepLink as string) ?? undefined;
        navigate(deepLink);
      });

      return () => {
        unsubForeground();
      };
    };

    const cleanupPromise = bootstrap();

    return () => {
      stopTokenRefresh?.();
      void cleanupPromise.then(cleanup => cleanup?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigatorReady = useCallback(() => {
    if (pendingDeepLink.current) {
      navigate(pendingDeepLink.current);
      pendingDeepLink.current = null;
    }
  }, [navigate]);

  useEffect(() => {
    function handleUrl({ url }: { url: string }) {
      try {
        const parsed = new URL(url);
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

    void Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleNavigatorReady}
      linking={linking}
    >
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
export type { RootStackParamList } from './types';
