import React from 'react';
import renderer from 'react-test-renderer';
import './__mocks__/setup';
import { useTaskFeed } from '../hooks/useTaskFeed';
import { useTaskStore } from '../store/taskStore';
import { TaskSortMode } from '../utils/sortTasks';
import { Task } from '../types';

jest.mock('../services/api', () => ({
  fetchTasks: jest.fn(),
}));

import { fetchTasks } from '../services/api';

const mockFetchTasks = fetchTasks as jest.MockedFunction<typeof fetchTasks>;

interface FeedOptions {
  type?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  sort?: TaskSortMode;
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
    distance: 5,
  };
}

let feedRef: ReturnType<typeof useTaskFeed>;

function Harness({ options }: { options: FeedOptions }) {
  feedRef = useTaskFeed(options);
  return null;
}

function createHarness(options: FeedOptions) {
  return React.createElement(Harness, { options });
}

async function flush() {
  await renderer.act(async () => undefined);
}

describe('useTaskFeed', () => {
  let tree: renderer.ReactTestRenderer | null = null;

  function renderFeed(options: FeedOptions) {
    void renderer.act(() => {
      tree = renderer.create(createHarness(options));
    });
  }

  function updateFeed(options: FeedOptions) {
    void renderer.act(() => {
      tree?.update(createHarness(options));
    });
  }

  function unmountFeed() {
    void renderer.act(() => {
      tree?.unmount();
      tree = null;
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchTasks.mockReset();
    mockFetchTasks.mockResolvedValue({
      tasks: [makeTask('1'), makeTask('2')],
      totalPages: 1,
    });
    useTaskStore.setState({
      tasks: [],
      selectedTask: null,
      isLoading: false,
      error: null,
      page: 1,
      hasMore: true,
    });
  });

  afterEach(() => {
    unmountFeed();
    jest.useRealTimers();
  });

  it('fetches page 1 once on mount', async () => {
    renderFeed({ type: 'TREE_PLANTING' });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);
    expect(mockFetchTasks).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, type: 'TREE_PLANTING' }),
    );
  });

  it('does not refetch when only the sort mode changes', async () => {
    renderFeed({ sort: 'distance' });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    updateFeed({ sort: 'reward' });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    updateFeed({ sort: 'difficulty' });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);
  });

  it('fires exactly one reset request when the type filter changes', async () => {
    renderFeed({ type: 'TREE_PLANTING' });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    updateFeed({ type: 'OCEAN_CLEANUP' });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(2);
    expect(mockFetchTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, type: 'OCEAN_CLEANUP' }),
    );
  });

  it('fires exactly one reset request when the radius changes', async () => {
    renderFeed({ lat: 1, lng: 2, radius: 50 });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    updateFeed({ lat: 1, lng: 2, radius: 25 });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(2);
    expect(mockFetchTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ radius: 25 }),
    );
  });

  it('debounces GPS updates more frequent than 5 seconds', async () => {
    renderFeed({});
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    updateFeed({ lat: 40.0, lng: -74.0 });
    await flush();
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    await renderer.act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    updateFeed({ lat: 40.001, lng: -74.001 });
    await flush();
    await renderer.act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    await renderer.act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockFetchTasks).toHaveBeenCalledTimes(2);
    expect(mockFetchTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ lat: 40.001, lng: -74.001 }),
    );
  });

  it('dedups overlapping ids when loading more', async () => {
    mockFetchTasks
      .mockResolvedValueOnce({ tasks: [makeTask('1')], totalPages: 2 })
      .mockResolvedValueOnce({
        tasks: [makeTask('1'), makeTask('2')],
        totalPages: 2,
      });

    renderFeed({});
    await flush();
    expect(useTaskStore.getState().tasks).toHaveLength(1);

    void renderer.act(() => {
      feedRef.loadMore();
    });
    await flush();

    const tasks = useTaskStore.getState().tasks;
    expect(tasks).toHaveLength(2);
    expect(tasks.filter(t => t.id === '1')).toHaveLength(1);
  });
});
