import { Platform, PermissionsAndroid } from 'react-native';
import { usePrefsStore } from '../store/prefsStore';
import { isNowInQuietHours } from '../utils/quietHours';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}

let onNotificationCallback: ((payload: NotificationPayload) => void) | null =
  null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS permission is handled by the system prompt when registering
  return true;
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return null;
    }

    // In production, this would use @react-native-firebase/messaging
    // or expo-notifications to get the device token
    // For now, return null as a placeholder
    return null;
  } catch {
    return null;
  }
}

export async function sendTokenToServer(token: string): Promise<void> {
  // POST token to backend for server-side push notification delivery
  // The backend stores this token and uses it to send targeted notifications
  try {
    const { default: api } = await import('../services/api');
    await api.post('/notifications/register', { token });
  } catch {
    // Best-effort registration
  }
}

export function onNotificationReceived(
  callback: (payload: NotificationPayload) => void,
): () => void {
  onNotificationCallback = callback;
  return () => {
    onNotificationCallback = null;
  };
}

// Notification types (re-exported from constants to avoid circular imports)
export { NOTIFICATION_TYPES } from '../constants/notificationTypes';

export async function scheduleLocalNotification(
  payload: NotificationPayload & { type?: string },
): Promise<void> {
  // Check global prefs and quiet hours before firing
  const prefs = usePrefsStore.getState();
  if (!prefs.allEnabled) {
    return;
  }

  const type =
    payload.type || payload.data?.type || payload.data?.notificationType;
  if (type && prefs.notificationPrefs[type] === false) {
    return;
  }

  const { from, to } = prefs.quietHours;
  if (isNowInQuietHours(from, to)) {
    return;
  }

  // Best-effort: if notifee is available and payload requests scheduling, use it
  try {
    const { default: notifee } = await import('@notifee/react-native');
    // If payload contains a timestamp/data.trigger we could schedule; for now display immediately
    const notificationId = await notifee.displayNotification({
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    usePrefsStore.getState().addScheduledId(type || 'unknown', notificationId);
    onNotificationCallback?.(payload);
    return;
  } catch {
    // fallback to local callback
    onNotificationCallback?.(payload);
  }
}
