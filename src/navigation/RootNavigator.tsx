import React, { useEffect, useRef, useCallback } from 'react';
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
import { SubmitProofParams } from '../types';
import {
  registerForPushNotifications,
  sendTokenToServer,
  listenForTokenRefresh,
  scheduleLocalNotification,
  NOTIFICATION_TYPES,
} from '../services/notifications';
import { getMessaging } from '../services/firebaseMessaging';

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
 * Parse a deep-link string such as "ecotask://tasks" or
 * "ecotask://task/abc123" into a screen name + params understood by the
 * RootStack navigator.
 */
function parseDeepLink(link: string | undefined): {
  screen: keyof RootStackParamList;
  params?: Record<string, unknown>;
} | null {
  if (!link) {
    return null;
  }
  try {
    const url = new URL(link);
    const path = url.pathname.replace(/^\//, '') || url.host;
    if (path === 'tasks') {
      return { screen: 'Main' };
    }
    if (path.startsWith('task/')) {
      const taskId = path.split('/')[1];
      if (taskId) {
        return { screen: 'TaskDetail', params: { taskId } };
      }
    }
    if (path === 'wallet') {
      return { screen: 'Main' };
    }
    if (path === 'notifications') {
      return { screen: 'NotificationPreferences' };
    }
  } catch {
    // Malformed URL — ignore.
  }
  return null;
}

export default function RootNavigator() {
  const isConnected = useWalletStore(s => s.isConnected);
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);

  /**
   * Pending deep-links are queued here while the navigator has not yet
   * mounted (cold-start scenario). They are flushed in onReady().
   */
  const pendingDeepLink = useRef<string | null>(null);

  const navigate = useCallback((link: string | undefined) => {
    const target = parseDeepLink(link);
    if (!target) {
      return;
    }
    const nav = navigationRef.current;
    if (!nav?.isReady()) {
      // Navigator not ready yet — queue for onReady
      pendingDeepLink.current = link ?? null;
      return;
    }
    if (target.params) {
      nav.navigate(target.screen as any, target.params as any);
    } else {
      nav.navigate(target.screen as any);
    }
  }, []);

  useEffect(() => {
    let stopTokenRefresh: (() => void) | null = null;

    const bootstrap = async () => {
      // 1. Request permission and obtain FCM token
      const token = await registerForPushNotifications();
      if (token) {
        await sendTokenToServer(token);
      }

      // 2. Listen for token rotation and re-register
      stopTokenRefresh = listenForTokenRefresh(async (newToken: string) => {
        await sendTokenToServer(newToken);
      });

      // 3. Handle notification tap that opened the app from background/quit state
      const messaging = getMessaging();

      // Cold-start: getInitialNotification() is non-null when the app was
      // opened by tapping a notification while terminated.
      const initialNotification = await messaging.getInitialNotification();
      if (initialNotification?.data?.deepLink) {
        pendingDeepLink.current = initialNotification.data.deepLink as string;
      }

      // Foreground messages — surface as a local notification via notifee
      // so the user sees a system banner even when the app is open.
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

      // Background/quit tap: fires when notification opened the app
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
      cleanupPromise.then(cleanup => cleanup?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigatorReady = useCallback(() => {
    // Flush any queued deep-link from a cold-start notification tap
    if (pendingDeepLink.current) {
      navigate(pendingDeepLink.current);
      pendingDeepLink.current = null;
    }
  }, [navigate]);

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigatorReady}>
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
