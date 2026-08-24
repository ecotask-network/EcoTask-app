import type { NavigationContainerRef } from '@react-navigation/native';
import type { DeepLinkTarget, RootStackParamList } from './types';

/**
 * Deep-link parsing and dispatch.
 *
 * Kept out of `RootNavigator` so it can be tested without mounting the
 * navigator, which would drag in the native modules every screen imports.
 */

/**
 * Parse a deep-link string such as "ecotask://tasks" or
 * "ecotask://task/abc123" into a navigation target.
 *
 * Returns a discriminated union rather than `{ screen, params? }`: the latter
 * cannot express that `taskId` belongs to `TaskDetail` and nothing else, so
 * `{ screen: 'TaskDetail' }` with no params would type-check and then fail at
 * runtime.
 */
export function parseDeepLink(link: string | undefined): DeepLinkTarget | null {
  if (!link) {
    return null;
  }
  try {
    const url = new URL(link);
    // For a custom scheme, `//` introduces an authority, so WHATWG parsing
    // splits "ecotask://task/abc123" into host "task" and pathname "/abc123".
    // The host is therefore the first path segment, not a separate concept —
    // joining them is what makes multi-segment links resolve. Reading
    // `pathname` alone yielded "abc123" here, so the "task/" branch below was
    // unreachable and TaskDetail deep links resolved to null.
    const path = `${url.host}${url.pathname}`
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
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

/**
 * Dispatch a parsed deep link onto the navigator.
 *
 * Switching on `target.screen` is what makes this type-safe: inside each case
 * TypeScript has narrowed the union, so `navigate` receives exactly the params
 * that screen declares. A single `navigate(target.screen, target.params)`
 * cannot type-check against a union of param types — which is why the original
 * needed `as any`. The switch is exhaustive, so adding a `DeepLinkTarget`
 * variant without handling it here is a compile error rather than a link that
 * silently does nothing.
 */
export function navigateToTarget(
  nav: NavigationContainerRef<RootStackParamList>,
  target: DeepLinkTarget,
): void {
  switch (target.screen) {
    case 'TaskDetail':
      nav.navigate('TaskDetail', target.params);
      return;
    case 'NotificationPreferences':
      nav.navigate('NotificationPreferences');
      return;
    case 'Main':
      nav.navigate('Main');
      return;
  }
}
