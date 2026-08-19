import { mergeNotificationDefaults } from '../store/prefsStore';
import { NOTIFICATION_TYPES } from '../services/notifications';

describe('prefs defaults merge', () => {
  test('missing future type defaults to true', () => {
    const stored: Record<string, boolean> = {};
    // simulate stored only one existing type disabled
    const existingType = Object.values(NOTIFICATION_TYPES)[0];
    stored[existingType] = false;

    const merged = mergeNotificationDefaults(stored);

    Object.values(NOTIFICATION_TYPES).forEach(t => {
      if (t === existingType) {
        expect(merged[t]).toBe(false);
      } else {
        expect(merged[t]).toBe(true);
      }
    });
  });
});
