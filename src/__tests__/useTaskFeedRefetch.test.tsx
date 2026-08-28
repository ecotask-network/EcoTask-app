jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Shallow-mock the API — we control fetchTasks per test.
jest.mock('../services/api', () => ({
  fetchTasks: jest.fn(),
}));

jest.mock('../config/taskFeedCache', () => ({
  TASK_FEED_STALE_MS: 5 * 60 * 1000,
}));

import './__mocks__/setup';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import * as api from '../services/api';
import { useTaskFeed } from '../hooks/useTaskFeed';
import { useTaskStore } from '../store/taskStore';
import { Task } from '../types';

const EMPTY_PAGE = { tasks: [], totalPages: 0 };

type UseTaskFeedOptions = Parameters<typeof useTaskFeed>[0];
type UseTaskFeedResult = ReturnType<typeof useTaskFeed>;

function HookHarness({
  onRef,
  ...opts
}: { onRef: (hook: UseTaskFeedResult) => void } & UseTaskFeedOptions) {
  const hook = useTaskFeed(opts);
  React.useEffect(() => {
    onRef(hook);
  });
  return null;
}

function makeTask(id: string): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    type: 'OTHER',
    rewardAmount: 10,
    lat: 0,
    lng: 0,
    status: 'open',
  };
}

describe('useTaskFeed', () => {
  let instance: renderer.ReactTestRenderer | null = null;

  afterEach(() => {
    if (instance) {
      void act(() => instance?.unmount());
      instance = null;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // reset store to a clean, empty state between tests
    useTaskStore.setState({
      tasks: [],
      isLoading: false,
      error: null,
      page: 1,
      hasMore: true,
    });
    (api.fetchTasks as jest.Mock).mockResolvedValue(EMPTY_PAGE);
  });

  test('does NOT re-fetch on mount when warm cache is within TTL', async () => {
    // Simulate a previous session that already populated the store.
    useTaskStore.setState({
      tasks: [makeTask('existing-1'), makeTask('existing-2')],
      tasksLastFetchedAt: new Date().toISOString(),
    });

    let ref!: UseTaskFeedResult;
    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    // Give any pending effect work a chance to run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(api.fetchTasks).not.toHaveBeenCalled();
    expect(ref.tasks.length).toBe(2);
  });

  test('silently re-fetches on mount when warm cache is past TTL', async () => {
    useTaskStore.setState({
      tasks: [makeTask('existing-1'), makeTask('existing-2')],
      tasksLastFetchedAt: new Date(
        Date.now() - (5 * 60 * 1000 + 1000),
      ).toISOString(),
    });

    let ref!: UseTaskFeedResult;
    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.fetchTasks).toHaveBeenCalledTimes(1);
    // No loading skeleton during silent revalidation.
    expect(ref.isLoading).toBe(false);
    expect(ref.tasks.length).toBe(0);
  });

  test('preserves selectedTask during silent revalidation', async () => {
    const selected = makeTask('pinned');
    useTaskStore.setState({
      tasks: [makeTask('existing-1'), selected],
      selectedTask: selected,
      tasksLastFetchedAt: new Date(
        Date.now() - (5 * 60 * 1000 + 1000),
      ).toISOString(),
    });

    let ref!: UseTaskFeedResult;
    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.fetchTasks).toHaveBeenCalledTimes(1);
    expect(useTaskStore.getState().selectedTask).not.toBeNull();
    expect(useTaskStore.getState().selectedTask?.id).toBe('pinned');
  });

  test('re-fetches exactly once when the filter changes', async () => {
    await act(async () => {
      renderer.create(<HookHarness onRef={() => undefined} type="all" />);
    });

    // Initial mount fetch should have happened once.
    expect(api.fetchTasks).toHaveBeenCalledTimes(1);

    await act(async () => {
      (api.fetchTasks as jest.Mock).mockClear();
      // Changing the filter triggers exactly one re-fetch.
      renderer
        .create(<HookHarness onRef={() => undefined} type="all" />)
        .update(<HookHarness onRef={() => undefined} type="open" />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.fetchTasks).toHaveBeenCalledTimes(1);
    const params = (api.fetchTasks as jest.Mock).mock.calls[0][0];
    expect(params.type).toBe('open');
  });

  test('re-fetches after the location debounce when the location changes', async () => {
    jest.useFakeTimers();
    await act(async () => {
      instance = renderer.create(
        <HookHarness onRef={() => undefined} lat={1} lng={1} radius={5} />,
      );
    });

    // Mount fetch happens once (tasks empty).
    expect(api.fetchTasks).toHaveBeenCalledTimes(1);

    await act(async () => {
      (api.fetchTasks as jest.Mock).mockClear();
      instance = renderer.create(
        <HookHarness onRef={() => undefined} lat={1} lng={1} radius={5} />,
      );
      instance.update(
        <HookHarness onRef={() => undefined} lat={2} lng={2} radius={5} />,
      );
      jest.advanceTimersByTime(5000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.fetchTasks).toHaveBeenCalledTimes(1);
    const params = (api.fetchTasks as jest.Mock).mock.calls[0][0];
    expect(params.lat).toBe(2);
    expect(params.lng).toBe(2);
    jest.useRealTimers();
  });
});
