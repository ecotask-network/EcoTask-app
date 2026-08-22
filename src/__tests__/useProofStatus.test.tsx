/**
 * Tests for useProofStatus:
 *  - Resolves to 'confirmed' and fires a local notification
 *  - Resolves to 'failed' and does NOT fire a notification
 *  - Times out after 10 minutes, marks the activity 'failed', and fires a timeout notification
 *  - Pauses polling while offline and resumes on reconnect
 */

// Mock NetInfo before any imports that use it.
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Intercept notifications so we can assert they fired.
jest.mock('../services/notifications', () => ({
  scheduleLocalNotification: jest.fn(),
}));

// Shallow-mock the API — we replace fetchProofStatus per test.
jest.mock('../services/api', () => ({
  fetchProofStatus: jest.fn(),
}));

import './__mocks__/setup';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import * as api from '../services/api';
import * as notifications from '../services/notifications';
import { useProofStatus } from '../hooks/useProofStatus';
import { useActivityStore } from '../store/activityStore';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';

// ─── constants mirrored from the hook ────────────────────────────────────────
const INITIAL_INTERVAL_MS = 5_000;

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeActivity() {
  useActivityStore.getState().addActivity({
    id: 'act-1',
    taskId: 'task-1',
    taskTitle: 'Plant a tree',
    taskType: 'TREE_PLANTING',
    rewardAmount: 0,
    rewardToken: 'ECO',
    completedAt: new Date().toISOString(),
    status: 'pending',
    proofId: 'proof-1',
  });
}

/** Mounts useProofStatus in a minimal React component. */
function mountHook(
  proofId: string | null,
  opts: { activityId: string; taskTitle: string; rewardToken: string },
) {
  function TestComponent() {
    useProofStatus(proofId, opts);
    return null;
  }
  let tree: renderer.ReactTestRenderer;
  void act(() => {
    tree = renderer.create(<TestComponent />);
  });
  return {
    unmount: () => act(() => tree.unmount()),
  };
}

// ─── setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();

  // Default: online and initialised.
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
  (NetInfo.addEventListener as jest.Mock).mockImplementation(cb => {
    // Immediately call the listener to simulate "online" state.
    cb({ isConnected: true });
    return jest.fn();
  });

  useActivityStore.setState({ activities: [], streak: 0, bestStreak: 0 });
  makeActivity();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── tests ───────────────────────────────────────────────────────────────────

describe('useProofStatus', () => {
  it('updates activity to confirmed and fires a reward notification', async () => {
    (api.fetchProofStatus as jest.Mock).mockResolvedValue({
      proofId: 'proof-1',
      status: 'confirmed',
      rewardAmount: 10,
    });

    mountHook('proof-1', {
      activityId: 'act-1',
      taskTitle: 'Plant a tree',
      rewardToken: 'ECO',
    });

    // Advance past the initial interval so the first poll fires.
    await act(async () => {
      jest.advanceTimersByTime(INITIAL_INTERVAL_MS + 100);
      // Flush promises so the async fetchProofStatus resolves.
      await Promise.resolve();
      await Promise.resolve();
    });

    const activity = useActivityStore
      .getState()
      .activities.find(a => a.id === 'act-1');

    expect(activity?.status).toBe('confirmed');
    expect(activity?.rewardAmount).toBe(10);
    expect(notifications.scheduleLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Reward confirmed! 🎉',
        body: expect.stringContaining('10 ECO'),
      }),
    );
  });

  it('updates activity to failed and does NOT fire a reward notification', async () => {
    (api.fetchProofStatus as jest.Mock).mockResolvedValue({
      proofId: 'proof-1',
      status: 'failed',
    });

    mountHook('proof-1', {
      activityId: 'act-1',
      taskTitle: 'Plant a tree',
      rewardToken: 'ECO',
    });

    await act(async () => {
      jest.advanceTimersByTime(INITIAL_INTERVAL_MS + 100);
      await Promise.resolve();
      await Promise.resolve();
    });

    const activity = useActivityStore
      .getState()
      .activities.find(a => a.id === 'act-1');

    expect(activity?.status).toBe('failed');
    expect(notifications.scheduleLocalNotification).not.toHaveBeenCalled();
  });

  it('marks activity as failed after the 10-minute timeout', async () => {
    // Backend always returns pending — never resolves to a terminal state.
    (api.fetchProofStatus as jest.Mock).mockResolvedValue({
      proofId: 'proof-1',
      status: 'pending',
    });

    mountHook('proof-1', {
      activityId: 'act-1',
      taskTitle: 'Plant a tree',
      rewardToken: 'ECO',
    });

    // Run all pending timers and promises repeatedly until the 10-minute
    // timeout has been crossed. jest.runAllTimersAsync() advances timers
    // and drains microtasks in one call, which avoids the need to manually
    // interleave advanceTimersByTime with Promise.resolve flushes.
    //
    // We call it in a loop because each poll reschedules a new timer, and
    // runAllTimersAsync only runs timers that exist at the time of the call.
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        await jest.runAllTimersAsync();
      });
    }

    const activity = useActivityStore
      .getState()
      .activities.find(a => a.id === 'act-1');

    expect(activity?.status).toBe('failed');
    expect(notifications.scheduleLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Proof verification timed out',
        body: 'Proof verification timed out. Please check your submission status.',
        type: NOTIFICATION_TYPES.PROOF_TIMEOUT,
        data: expect.objectContaining({
          type: NOTIFICATION_TYPES.PROOF_TIMEOUT,
          proofId: 'proof-1',
          activityId: 'act-1',
          deepLink: 'ecotask://wallet',
        }),
      }),
    );
  });

  it('does not poll when proofId is null', async () => {
    mountHook(null, {
      activityId: 'act-1',
      taskTitle: 'Plant a tree',
      rewardToken: 'ECO',
    });

    await act(async () => {
      jest.advanceTimersByTime(INITIAL_INTERVAL_MS + 100);
      await Promise.resolve();
    });

    expect(api.fetchProofStatus).not.toHaveBeenCalled();
  });

  it('pauses polling while offline and resumes on reconnect', async () => {
    // Start offline — NetInfo.fetch resolves immediately as disconnected.
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
    let netInfoListener: ((state: { isConnected: boolean }) => void) | null =
      null;
    (NetInfo.addEventListener as jest.Mock).mockImplementation(cb => {
      cb({ isConnected: false });
      netInfoListener = cb;
      return jest.fn();
    });

    (api.fetchProofStatus as jest.Mock).mockResolvedValue({
      proofId: 'proof-1',
      status: 'confirmed',
      rewardAmount: 5,
    });

    mountHook('proof-1', {
      activityId: 'act-1',
      taskTitle: 'Plant a tree',
      rewardToken: 'ECO',
    });

    // Flush NetInfo.fetch so isInitialised=true, isConnected=false.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance past the first poll interval — API must NOT fire while offline.
    await act(async () => {
      jest.advanceTimersByTime(INITIAL_INTERVAL_MS + 100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.fetchProofStatus).not.toHaveBeenCalled();

    // Come back online: trigger the NetInfo listener inside act() so that
    // React flushes the state update and re-runs the useEffect in
    // useProofStatus that syncs isConnectedRef.current.
    await act(async () => {
      netInfoListener?.({ isConnected: true });
    });

    // The hook is still waiting on its current back-off timer (capped at
    // 60 s). Advance past it so the next poll fires now online.
    await act(async () => {
      jest.advanceTimersByTime(60_000 + 100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.fetchProofStatus).toHaveBeenCalledWith('proof-1');

    const activity = useActivityStore
      .getState()
      .activities.find(a => a.id === 'act-1');
    expect(activity?.status).toBe('confirmed');
  });

  it('stops polling after component unmounts', async () => {
    (api.fetchProofStatus as jest.Mock).mockResolvedValue({
      proofId: 'proof-1',
      status: 'pending',
    });

    const { unmount } = mountHook('proof-1', {
      activityId: 'act-1',
      taskTitle: 'Plant a tree',
      rewardToken: 'ECO',
    });

    void unmount();

    // After unmount, advancing timers should not trigger further API calls.
    await act(async () => {
      jest.advanceTimersByTime(INITIAL_INTERVAL_MS * 10);
      await Promise.resolve();
    });

    expect(api.fetchProofStatus).not.toHaveBeenCalled();
  });
});
