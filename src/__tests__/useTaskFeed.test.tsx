jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Shallow-mock the API — we control fetchTasks per test.
jest.mock('../services/api', () => ({
  fetchTasks: jest.fn(),
}));

import './__mocks__/setup';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import * as api from '../services/api';
import { useTaskFeed } from '../hooks/useTaskFeed';
import { useTaskStore } from '../store/taskStore';

const EMPTY_PAGE = { tasks: [], totalPages: 0 };

function HookHarness({ onRef, ...opts }: any) {
  const hook = useTaskFeed(opts);
  React.useEffect(() => {
    onRef(hook);
  });
  return null;
}

describe('useTaskFeed', () => {
  let instance: any;

  afterEach(() => {
    if (instance) {
      act(() => instance.unmount());
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

  test('does NOT re-fetch on mount when tasks are already in the store', async () => {
    // Simulate a previous session that already populated the store.
    useTaskStore.setState({
      tasks: [{ id: 'existing-1' } as any, { id: 'existing-2' } as any],
    });

    let ref: any;
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

  test('re-fetches exactly once when the filter changes', async () => {
    await act(async () => {
      renderer.create(<HookHarness onRef={() => {}} type="all" />);
    });

    // Initial mount fetch should have happened once.
    expect(api.fetchTasks).toHaveBeenCalledTimes(1);

    await act(async () => {
      (api.fetchTasks as jest.Mock).mockClear();
      // Changing the filter triggers exactly one re-fetch.
      renderer
        .create(<HookHarness onRef={() => {}} type="all" />)
        .update(<HookHarness onRef={() => {}} type="open" />);
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
        <HookHarness onRef={() => {}} lat={1} lng={1} radius={5} />,
      );
    });

    // Mount fetch happens once (tasks empty).
    expect(api.fetchTasks).toHaveBeenCalledTimes(1);

    await act(async () => {
      (api.fetchTasks as jest.Mock).mockClear();
      instance = renderer
        .create(<HookHarness onRef={() => {}} lat={1} lng={1} radius={5} />)
        .update(<HookHarness onRef={() => {}} lat={2} lng={2} radius={5} />);
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
