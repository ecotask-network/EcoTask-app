/**
 * Thin adapter around @react-native-firebase/messaging.
 *
 * Centralising the import here means:
 *  - Tests can mock this module with jest.mock() instead of fighting with
 *    virtual:true and dynamic import() incompatibilities in Jest's CommonJS
 *    transform.
 *  - If the native Firebase files (google-services.json / GoogleService-Info.plist)
 *    are absent (CI), every function returns a safe no-op, keeping tests green.
 *
 * @react-native-firebase/messaging is a peer dependency; see .env.example for
 * setup instructions.
 */

export interface FirebaseMessage {
  notification?: { title?: string; body?: string };
  data?: Record<string, unknown>;
}

export interface FirebaseMessagingAdapter {
  getToken(): Promise<string | null>;
  onTokenRefresh(handler: (token: string) => void): () => void;
  getInitialNotification(): Promise<FirebaseMessage | null>;
  onMessage(handler: (msg: FirebaseMessage) => Promise<void>): () => void;
  onNotificationOpenedApp(handler: (msg: FirebaseMessage) => void): () => void;
  requestPermission(): Promise<number | null>;
}

/** No-op adapter — used when Firebase native module is not available. */
const nullAdapter: FirebaseMessagingAdapter = {
  getToken: async () => null,
  onTokenRefresh: () => () => undefined,
  getInitialNotification: async () => null,
  onMessage: () => () => undefined,
  onNotificationOpenedApp: () => () => undefined,
  requestPermission: async () => null,
};

/**
 * Returns a Firebase messaging adapter. Always safe to call — returns a no-op
 * adapter if the package or native config is missing.
 */
export function getMessaging(): FirebaseMessagingAdapter {
  try {
    // require() is used intentionally: it works in both the CommonJS Jest
    // transform and the Metro bundler, and it allows jest.mock() on this file
    // to intercept the call cleanly.
    const { default: messaging } = require('@react-native-firebase/messaging');
    const instance = messaging();
    return {
      getToken: () => instance.getToken(),
      onTokenRefresh: handler => instance.onTokenRefresh(handler),
      getInitialNotification: () => instance.getInitialNotification(),
      onMessage: handler => instance.onMessage(handler),
      onNotificationOpenedApp: handler =>
        instance.onNotificationOpenedApp(handler),
      requestPermission: () => instance.requestPermission(),
    };
  } catch {
    return nullAdapter;
  }
}
