/**
 * SubmitProofScreen.test.tsx
 *
 * Covers the core proof submission flow:
 *  - camera permission, device availability and photo capture
 *  - successful submission (activity + stats + polling + notification)
 *  - offline / queued submission with error display
 *  - retake photo reset
 *  - empty state when no task id is present
 *  - location display and location errors
 *  - progress labels and submitting states
 */

// react-native-vision-camera must be mocked before the screen is imported.
const mockCameraTakePhoto = jest.fn();
const mockUseCameraPermission = jest.fn();
const mockUseCameraDevice = jest.fn();
const mockRequestPermission = jest.fn();

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  return {
    useCameraPermission: (...args: unknown[]) =>
      mockUseCameraPermission(...args),
    useCameraDevice: (...args: unknown[]) => mockUseCameraDevice(...args),
    Camera: React.forwardRef((props: any, ref: any) => {
      void props;
      React.useImperativeHandle(ref, () => ({
        takePhoto: mockCameraTakePhoto,
      }));
      return null;
    }),
  };
});

const mockRoute: { params: any } = {
  params: {
    taskId: 't1',
    taskTitle: 'Plant a tree',
    taskType: 'TREE_PLANTING',
    rewardAmount: 25,
    rewardToken: 'ECO',
  },
};
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => mockRoute),
  useNavigation: jest.fn(() => ({ goBack: mockGoBack })),
}));

const mockLocation: {
  location: { lat: number; lng: number } | null;
  permissionGranted: boolean;
  error: string | null;
  refresh: jest.Mock;
} = {
  location: { lat: 1.2345, lng: 6.789 },
  permissionGranted: true,
  error: null,
  refresh: jest.fn(),
};

jest.mock('../hooks/useLocation', () => ({
  useLocation: jest.fn(() => mockLocation),
}));

const mockProofSubmitHook: {
  submit: jest.Mock;
  syncPendingProofs: jest.Mock;
  pendingCount: number;
  isSubmitting: boolean;
  progress: string;
  error: string | null;
} = {
  submit: jest.fn(),
  syncPendingProofs: jest.fn(),
  pendingCount: 0,
  isSubmitting: false,
  progress: 'idle',
  error: null,
};

jest.mock('../hooks/useProofSubmit', () => ({
  useProofSubmit: jest.fn(() => mockProofSubmitHook),
}));

const mockUseProofStatus = jest.fn();

jest.mock('../hooks/useProofStatus', () => ({
  useProofStatus: (...args: unknown[]) => mockUseProofStatus(...args),
}));

jest.mock('../services/notifications', () => ({
  scheduleLocalNotification: jest.fn(),
  NOTIFICATION_TYPES: {
    REWARD_CONFIRMED: 'reward_confirmed',
  },
}));

import './__mocks__/setup';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert, Image, Text, TouchableOpacity } from 'react-native';
import SubmitProofScreen from '../screens/SubmitProofScreen';
import { useActivityStore } from '../store/activityStore';
import { useUserStore } from '../store/userStore';
import { scheduleLocalNotification } from '../services/notifications';

const BASE_PARAMS = {
  taskId: 't1',
  taskTitle: 'Plant a tree',
  taskType: 'TREE_PLANTING',
  rewardAmount: 25,
  rewardToken: 'ECO',
};

function textValues(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).filter((child: unknown): child is string => typeof child === 'string'),
    );
}

function buttonByLabel(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.findAllByType(TouchableOpacity).find(btn =>
    btn.findAllByType(Text).some(t => {
      const children = Array.isArray(t.props.children)
        ? t.props.children
        : [t.props.children];
      return children.includes(label);
    }),
  );
}

function renderScreen(): renderer.ReactTestRenderer {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<SubmitProofScreen />);
  });
  return tree;
}

async function pressButton(tree: renderer.ReactTestRenderer, label: string) {
  const btn = buttonByLabel(tree, label);
  expect(btn).toBeDefined();
  await act(async () => {
    await btn!.props.onPress();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockRoute.params = { ...BASE_PARAMS };
  mockCameraTakePhoto.mockReset().mockResolvedValue({ path: 'photo.jpg' });
  mockUseCameraPermission.mockReturnValue({
    hasPermission: true,
    requestPermission: mockRequestPermission,
  });
  mockUseCameraDevice.mockReturnValue({ id: 'back' });
  mockLocation.location = { lat: 1.2345, lng: 6.789 };
  mockLocation.error = null;
  mockProofSubmitHook.submit = jest.fn();
  mockProofSubmitHook.isSubmitting = false;
  mockProofSubmitHook.progress = 'idle';
  mockProofSubmitHook.error = null;
  useActivityStore.setState({ activities: [], streak: 0, bestStreak: 0 });
  useUserStore.setState({
    profile: {
      id: 'u1',
      wallet: 'GDQXXXX',
      stats: { treesPlanted: 0, plasticCollected: 0, co2Reduced: 0 },
    },
    token: null,
    tokenExpiresAt: null,
  });
});

describe('SubmitProofScreen', () => {
  let tree: renderer.ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => {
      tree?.unmount();
    });
    tree = null;
  });

  it('shows an empty state when no task id is provided', () => {
    mockRoute.params = { taskId: undefined };
    tree = renderScreen();

    const texts = textValues(tree);
    expect(texts).toContain('Select a task first');
    expect(texts).toContain('Browse available tasks');
    expect(buttonByLabel(tree, 'Take Photo')).toBeUndefined();
  });

  it('renders the submit UI with the camera and location when available', () => {
    tree = renderScreen();

    expect(textValues(tree)).toContain('Submit Proof');
    expect(buttonByLabel(tree, 'Take Photo')).toBeDefined();
    expect(textValues(tree)).toContain('1.2345, 6.7890');
  });

  it('prompts for camera permission and requests it again on tap', async () => {
    mockUseCameraPermission.mockReturnValue({
      hasPermission: false,
      requestPermission: mockRequestPermission,
    });
    tree = renderScreen();

    expect(textValues(tree)).toContain('Camera permission required');
    expect(buttonByLabel(tree, 'Grant Permission')).toBeDefined();
    expect(mockRequestPermission).toHaveBeenCalled();

    await pressButton(tree, 'Grant Permission');
    expect(mockRequestPermission).toHaveBeenCalledTimes(2);
  });

  it('shows a no-camera message when no back camera device exists', () => {
    mockUseCameraDevice.mockReturnValue(undefined);
    tree = renderScreen();

    expect(textValues(tree)).toContain('No camera available');
    expect(buttonByLabel(tree, 'Take Photo')).toBeDefined();
  });

  it('captures a photo and shows the preview with retake and submit actions', async () => {
    tree = renderScreen();
    await pressButton(tree, 'Take Photo');

    expect(mockCameraTakePhoto).toHaveBeenCalledWith({ flash: 'off' });
    const preview = tree.root.findAllByType(Image);
    expect(preview.length).toBeGreaterThan(0);
    expect(preview[0]!.props.source).toEqual({ uri: 'file://photo.jpg' });
    expect(buttonByLabel(tree, 'Retake')).toBeDefined();
    expect(buttonByLabel(tree, 'Submit Proof')).toBeDefined();
  });

  it('alerts the user when capture fails and stays on capture mode', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCameraTakePhoto.mockRejectedValueOnce(new Error('camera broken'));
    tree = renderScreen();
    await pressButton(tree, 'Take Photo');

    expect(alertSpy).toHaveBeenCalledWith('Camera Error', 'camera broken');
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(buttonByLabel(tree, 'Take Photo')).toBeDefined();
  });

  it('disables the take-photo button while submitting', () => {
    mockProofSubmitHook.isSubmitting = true;
    tree = renderScreen();

    const captureBtn = buttonByLabel(tree, '...');
    expect(captureBtn).toBeDefined();
    expect(captureBtn!.props.disabled).toBe(true);
  });

  it('shows a disabled submitting button while a captured proof uploads', async () => {
    tree = renderScreen();
    await pressButton(tree, 'Take Photo');

    mockProofSubmitHook.isSubmitting = true;
    act(() => {
      tree!.update(<SubmitProofScreen />);
    });

    const submitBtn = buttonByLabel(tree, 'Submitting...');
    expect(submitBtn).toBeDefined();
    expect(submitBtn!.props.disabled).toBe(true);
  });

  it('successful submission adds a pending activity, updates stats, starts polling, and defers the notification', async () => {
    tree = renderScreen();
    await pressButton(tree, 'Take Photo');

    mockProofSubmitHook.progress = 'verifying';
    mockProofSubmitHook.submit.mockResolvedValue({
      proofId: 'proof-1',
      taskTitle: 'Plant a tree',
      taskType: 'TREE_PLANTING',
      rewardAmount: 25,
      rewardToken: 'ECO',
    });

    await pressButton(tree, 'Submit Proof');

    expect(mockProofSubmitHook.submit).toHaveBeenCalledWith(
      't1',
      'file://photo.jpg',
      expect.any(String),
      1.2345,
      6.789,
    );

    const activities = useActivityStore.getState().activities;
    expect(activities).toHaveLength(1);
    const activity = activities[0]!;
    expect(activity).toEqual(
      expect.objectContaining({
        taskId: 't1',
        taskTitle: 'Plant a tree',
        taskType: 'TREE_PLANTING',
        rewardAmount: 25,
        rewardToken: 'ECO',
        status: 'pending',
        proofId: 'proof-1',
      }),
    );

    const stats = useUserStore.getState().profile?.stats;
    expect(stats?.treesPlanted).toBe(1);
    expect(stats?.co2Reduced).toBe(2);

    expect(mockUseProofStatus).toHaveBeenCalledWith(
      'proof-1',
      expect.objectContaining({
        activityId: activity.id,
        taskTitle: 'Plant a tree',
        rewardToken: 'ECO',
      }),
    );

    expect(scheduleLocalNotification).not.toHaveBeenCalled();
    expect(textValues(tree)).toContain('Verifying proof — reward pending...');
  });

  it('successful submission without a proofId confirms the activity and fires a reward notification', async () => {
    tree = renderScreen();
    await pressButton(tree, 'Take Photo');

    mockProofSubmitHook.progress = 'verifying';
    mockProofSubmitHook.submit.mockResolvedValue({ success: true });

    await pressButton(tree, 'Submit Proof');

    const activity = useActivityStore.getState().activities[0]!;
    expect(activity.status).toBe('confirmed');
    expect(activity.rewardAmount).toBe(25);

    const stats = useUserStore.getState().profile?.stats;
    expect(stats?.treesPlanted).toBe(1);

    expect(scheduleLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Reward confirmed! 🎉',
        body: 'You earned 25 ECO for "Plant a tree".',
        type: 'reward_confirmed',
        data: expect.objectContaining({
          activityId: activity.id,
          deepLink: 'ecotask://wallet',
        }),
      }),
    );

    expect(textValues(tree)).toContain('Verifying with network...');
  });

  it('offline submission queues a pending activity and shows the error', async () => {
    mockRoute.params = { taskId: 't1', taskType: 'OTHER', rewardToken: 'ECO' };
    tree = renderScreen();
    await pressButton(tree, 'Take Photo');

    mockProofSubmitHook.error = 'Network unreachable';
    act(() => {
      tree!.update(<SubmitProofScreen />);
    });
    mockProofSubmitHook.submit.mockResolvedValue(undefined);

    await pressButton(tree, 'Submit Proof');

    const activity = useActivityStore.getState().activities[0]!;
    expect(activity).toEqual(
      expect.objectContaining({
        taskId: 't1',
        taskType: 'OTHER',
        taskTitle: 'Task queued offline',
        rewardAmount: 0,
        rewardToken: 'ECO',
        status: 'pending',
      }),
    );
    expect(scheduleLocalNotification).not.toHaveBeenCalled();
    expect(textValues(tree)).toContain('Network unreachable');
  });

  it('retake clears the preview and returns to capture mode', async () => {
    tree = renderScreen();
    await pressButton(tree, 'Take Photo');

    expect(tree.root.findAllByType(Image).length).toBeGreaterThan(0);
    expect(buttonByLabel(tree, 'Submit Proof')).toBeDefined();

    await pressButton(tree, 'Retake');

    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(buttonByLabel(tree, 'Take Photo')).toBeDefined();
    expect(buttonByLabel(tree, 'Submit Proof')).toBeUndefined();
    expect(mockCameraTakePhoto).toHaveBeenCalledTimes(1);
  });

  it('shows a placeholder while the location is loading', () => {
    mockLocation.location = null;
    mockLocation.error = null;
    tree = renderScreen();

    expect(textValues(tree)).toContain('Getting location...');
  });

  it('shows the location error when location is unavailable', () => {
    mockLocation.location = null;
    mockLocation.error = 'Location permission denied';
    tree = renderScreen();

    expect(textValues(tree)).toContain('Location permission denied');
  });

  it('shows the uploading progress label', () => {
    mockProofSubmitHook.progress = 'uploading';
    tree = renderScreen();

    expect(textValues(tree)).toContain('Uploading proof...');
  });

  it('shows the failed progress label', () => {
    mockProofSubmitHook.progress = 'failed';
    tree = renderScreen();

    expect(textValues(tree)).toContain('Upload failed');
  });

  it('shows the confirmed progress label', () => {
    mockProofSubmitHook.progress = 'confirmed';
    tree = renderScreen();

    expect(textValues(tree)).toContain('Reward confirmed!');
  });

  it('navigates back from the header', async () => {
    tree = renderScreen();
    await pressButton(tree, 'Back');

    expect(mockGoBack).toHaveBeenCalled();
  });
});
