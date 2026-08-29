/**
 * NotificationPreferencesScreen.test.tsx
 *
 * Tests:
 *  1. Initial rendering of header, master toggle, per-type toggles, quiet hours, and Done button
 *  2. Master toggle enables/disables all notifications (prefsStore.setAllEnabled)
 *  3. Per-type toggles persist to prefsStore (prefsStore.toggleType)
 *  4. Quiet-hours hours picker updates, validates HH:MM formatting, and handles midnight wrap (22:00 -> 23:00 -> 00:00)
 *  5. Asynchronous cancellation cleanup for scheduled notifications when toggling off
 *  6. Navigation goBack on Done button press
 */

import './__mocks__/setup';
import './__mocks__/rn-modules';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, Switch, TouchableOpacity } from 'react-native';

jest.mock('../navigation/useAppNavigation', () => ({
  useRootNavigation: jest.fn(),
}));

import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import usePrefsStore from '../store/prefsStore';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { useRootNavigation } from '../navigation/useAppNavigation';

const mockUseRootNavigation = useRootNavigation as jest.Mock;

function textValues(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).map(child =>
        typeof child === 'string' || typeof child === 'number'
          ? String(child)
          : '',
      ),
    )
    .filter(t => t.length > 0);
}

function buttonWithText(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(text => text.props.children === label),
    );
  if (!button) {
    throw new Error(`Could not find a button labelled "${label}"`);
  }
  return button;
}

function resetPrefsStore(
  overrides?: Partial<ReturnType<typeof usePrefsStore.getState>>,
) {
  const defaultPrefs: Record<string, boolean> = {};
  Object.values(NOTIFICATION_TYPES).forEach(t => {
    defaultPrefs[t] = true;
  });

  void act(() => {
    usePrefsStore.setState({
      allEnabled: true,
      notificationPrefs: defaultPrefs,
      quietHours: { from: '22:00', to: '07:00' },
      scheduledNotificationIds: {},
      ...overrides,
    });
  });
}

describe('NotificationPreferencesScreen', () => {
  let goBack: jest.Mock;
  let tree: renderer.ReactTestRenderer | null = null;

  function renderScreen() {
    void act(() => {
      tree = renderer.create(<NotificationPreferencesScreen />);
    });
    return tree!;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    goBack = jest.fn();
    mockUseRootNavigation.mockReturnValue({ goBack });
    resetPrefsStore();
  });

  afterEach(() => {
    if (tree) {
      void act(() => {
        tree?.unmount();
      });
      tree = null;
    }
  });

  describe('Initial Rendering', () => {
    it('renders the header title and all sections', () => {
      const currentTree = renderScreen();
      const texts = textValues(currentTree);

      expect(texts).toContain('Notification Preferences');
      expect(texts).toContain('All Notifications');
      expect(texts).toContain('Quiet Hours');
      expect(texts).toContain('to');
      expect(texts).toContain('Done');
    });

    it('renders all notification types in readable format', () => {
      const currentTree = renderScreen();
      const texts = textValues(currentTree);

      Object.values(NOTIFICATION_TYPES).forEach(type => {
        expect(texts).toContain(type.replace('_', ' '));
      });
    });

    it('initializes switches with default true values', () => {
      const currentTree = renderScreen();
      const switches = currentTree.root.findAllByType(Switch);

      // 1 master switch + 1 switch per NOTIFICATION_TYPES entry
      const expectedCount = 1 + Object.keys(NOTIFICATION_TYPES).length;
      expect(switches).toHaveLength(expectedCount);

      switches.forEach(sw => {
        expect(sw.props.value).toBe(true);
      });
    });

    it('displays initial quiet hours from and to values', () => {
      const currentTree = renderScreen();
      const texts = textValues(currentTree);

      expect(texts).toContain('22:00');
      expect(texts).toContain('07:00');
    });
  });

  describe('Master Switch (allEnabled)', () => {
    it('toggles master switch to false and updates prefsStore', () => {
      const currentTree = renderScreen();
      const switches = currentTree.root.findAllByType(Switch);
      const masterSwitch = switches[0]!;

      expect(masterSwitch.props.value).toBe(true);

      void act(() => {
        masterSwitch.props.onValueChange(false);
      });

      expect(usePrefsStore.getState().allEnabled).toBe(false);
    });

    it('toggles master switch to true when previously disabled', () => {
      resetPrefsStore({ allEnabled: false });

      const currentTree = renderScreen();
      const switches = currentTree.root.findAllByType(Switch);
      const masterSwitch = switches[0]!;

      expect(masterSwitch.props.value).toBe(false);

      void act(() => {
        masterSwitch.props.onValueChange(true);
      });

      expect(usePrefsStore.getState().allEnabled).toBe(true);
    });
  });

  describe('Per-Type Notification Toggles', () => {
    it('toggles a specific notification type to false', () => {
      const currentTree = renderScreen();
      const switches = currentTree.root.findAllByType(Switch);
      // Index 1 corresponds to the first NOTIFICATION_TYPES entry
      const types = Object.values(NOTIFICATION_TYPES);
      const targetType = types[0]!;
      const typeSwitch = switches[1]!;

      expect(typeSwitch.props.value).toBe(true);

      void act(() => {
        typeSwitch.props.onValueChange(false);
      });

      expect(usePrefsStore.getState().notificationPrefs[targetType]).toBe(
        false,
      );

      // Other types remain unchanged
      types.slice(1).forEach(otherType => {
        expect(usePrefsStore.getState().notificationPrefs[otherType]).toBe(
          true,
        );
      });
    });

    it('toggles a specific notification type from false back to true', () => {
      const types = Object.values(NOTIFICATION_TYPES);
      const targetType = NOTIFICATION_TYPES.STREAK_REMINDER;
      const initialPrefs: Record<string, boolean> = {};
      types.forEach(t => {
        initialPrefs[t] = t !== targetType;
      });

      resetPrefsStore({ notificationPrefs: initialPrefs });

      const currentTree = renderScreen();
      const streakIndex = types.indexOf(targetType);
      const switches = currentTree.root.findAllByType(Switch);
      const streakSwitch = switches[1 + streakIndex]!;

      expect(streakSwitch.props.value).toBe(false);

      void act(() => {
        streakSwitch.props.onValueChange(true);
      });

      expect(usePrefsStore.getState().notificationPrefs[targetType]).toBe(true);
    });

    it('clears scheduled notification IDs when disabling a type', async () => {
      const type = NOTIFICATION_TYPES.TASK_NEARBY;
      resetPrefsStore({
        scheduledNotificationIds: {
          [type]: ['sched-notif-1', 'sched-notif-2'],
        },
      });

      const currentTree = renderScreen();
      const typeIndex = Object.values(NOTIFICATION_TYPES).indexOf(type);
      const switches = currentTree.root.findAllByType(Switch);
      const typeSwitch = switches[1 + typeIndex]!;

      await act(async () => {
        typeSwitch.props.onValueChange(false);
        await Promise.resolve();
      });

      expect(usePrefsStore.getState().notificationPrefs[type]).toBe(false);
      expect(usePrefsStore.getState().scheduledNotificationIds[type]).toEqual(
        [],
      );
    });
  });

  describe('Quiet Hours Picker and Validation', () => {
    it('cycles "from" time forward by 1 hour when pressed', () => {
      const currentTree = renderScreen();
      const fromButton = buttonWithText(currentTree, '22:00');

      void act(() => {
        fromButton.props.onPress();
      });

      expect(usePrefsStore.getState().quietHours.from).toBe('23:00');
      expect(usePrefsStore.getState().quietHours.to).toBe('07:00');
    });

    it('wraps "from" time around midnight (23:00 -> 00:00)', () => {
      resetPrefsStore({ quietHours: { from: '23:00', to: '07:00' } });

      const currentTree = renderScreen();
      const fromButton = buttonWithText(currentTree, '23:00');

      void act(() => {
        fromButton.props.onPress();
      });

      expect(usePrefsStore.getState().quietHours.from).toBe('00:00');
      expect(usePrefsStore.getState().quietHours.to).toBe('07:00');
    });

    it('cycles "to" time forward by 1 hour when pressed', () => {
      const currentTree = renderScreen();
      const toButton = buttonWithText(currentTree, '07:00');

      void act(() => {
        toButton.props.onPress();
      });

      expect(usePrefsStore.getState().quietHours.from).toBe('22:00');
      expect(usePrefsStore.getState().quietHours.to).toBe('08:00');
    });

    it('wraps "to" time around midnight (23:00 -> 00:00)', () => {
      resetPrefsStore({ quietHours: { from: '22:00', to: '23:00' } });

      const currentTree = renderScreen();
      const toButton = buttonWithText(currentTree, '23:00');

      void act(() => {
        toButton.props.onPress();
      });

      expect(usePrefsStore.getState().quietHours.to).toBe('00:00');
    });

    it('handles identical from and to quiet hours', () => {
      resetPrefsStore({ quietHours: { from: '08:00', to: '08:00' } });

      const currentTree = renderScreen();
      const buttons = currentTree.root
        .findAllByType(TouchableOpacity)
        .filter(node =>
          node
            .findAllByType(Text)
            .some(text => text.props.children === '08:00'),
        );

      expect(buttons.length).toBe(2);

      // Press the first button ("from")
      void act(() => {
        buttons[0]!.props.onPress();
      });

      expect(usePrefsStore.getState().quietHours.from).toBe('09:00');
      expect(usePrefsStore.getState().quietHours.to).toBe('08:00');
    });

    it('pads single-digit hours with leading zeroes properly (00:00 to 09:00)', () => {
      resetPrefsStore({ quietHours: { from: '00:00', to: '08:00' } });

      const currentTree = renderScreen();
      const fromButton = buttonWithText(currentTree, '00:00');

      void act(() => {
        fromButton.props.onPress();
      });

      expect(usePrefsStore.getState().quietHours.from).toBe('01:00');
    });
  });

  describe('Navigation', () => {
    it('navigates back when Done button is pressed', () => {
      const currentTree = renderScreen();
      const doneButton = buttonWithText(currentTree, 'Done');

      void act(() => {
        doneButton.props.onPress();
      });

      expect(goBack).toHaveBeenCalledTimes(1);
    });
  });
});
