import './__mocks__/setup';
import { useWalletStore, partializeWalletState } from '../store/walletStore';
import {
  useTaskStore,
  partializeTaskState,
  sanitizePersistedTaskState,
  TASK_PAGE_SIZE,
} from '../store/taskStore';
import { useUserStore } from '../store/userStore';
import { useActivityStore } from '../store/activityStore';
import { Task } from '../types';

function makeTask(id: string, title = `Task ${id}`): Task {
  return {
    id,
    title,
    description: '',
    type: 'OTHER',
    rewardAmount: 5,
    lat: 0,
    lng: 0,
    status: 'open',
  };
}

function makeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
    'base64url',
  );
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.signature`;
}

describe('walletStore', () => {
  beforeEach(() => {
    useWalletStore.setState({
      isConnected: false,
      publicKey: null,
      balance: null,
      ecoBalance: null,
      usdcBalance: null,
    });
  });

  it('starts disconnected', () => {
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.publicKey).toBeNull();
    expect(state.balance).toBeNull();
  });

  it('connects with a public key', () => {
    const { connect } = useWalletStore.getState();
    connect('GCXXYZ...');
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.publicKey).toBe('GCXXYZ...');
  });

  it('sets balance', () => {
    const { setBalance } = useWalletStore.getState();
    setBalance('100.5');
    expect(useWalletStore.getState().balance).toBe('100.5');
  });

  it('sets ECO balance', () => {
    const { setEcoBalance } = useWalletStore.getState();
    setEcoBalance('500');
    expect(useWalletStore.getState().ecoBalance).toBe('500');
  });

  it('sets USDC balance', () => {
    const { setUsdcBalance } = useWalletStore.getState();
    setUsdcBalance('25.50');
    expect(useWalletStore.getState().usdcBalance).toBe('25.50');
  });

  it('disconnects and clears all state', () => {
    const { connect, setBalance, setEcoBalance, setUsdcBalance, disconnect } =
      useWalletStore.getState();
    connect('GCXXYZ...');
    setBalance('10');
    setEcoBalance('20');
    setUsdcBalance('5.00');
    disconnect();
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.publicKey).toBeNull();
    expect(state.balance).toBeNull();
    expect(state.ecoBalance).toBeNull();
    expect(state.usdcBalance).toBeNull();
  });

  it('partialize persists only identity fields, excluding live balances', () => {
    const partial = partializeWalletState({
      isConnected: true,
      status: 'connected',
      connectError: null,
      publicKey: 'GCXXYZ...',
      balance: '100.5',
      ecoBalance: '500',
      usdcBalance: '25.50',
      walletType: 'inapp' as const,
      beginConnect: () => {},
      connect: () => {},
      connectFailed: () => {},
      disconnect: () => {},
      setBalance: () => {},
      setEcoBalance: () => {},
      setUsdcBalance: () => {},
    });
    expect(partial).toEqual({
      isConnected: true,
      publicKey: 'GCXXYZ...',
      walletType: 'inapp',
    });
    expect(partial).not.toHaveProperty('balance');
    expect(partial).not.toHaveProperty('ecoBalance');
    expect(partial).not.toHaveProperty('usdcBalance');
    expect(partial).not.toHaveProperty('status');
    expect(partial).not.toHaveProperty('connectError');
  });

  it('rehydrated store starts with null balances (stale MMKV snapshot excluded)', () => {
    // Simulate what a legacy build persisted: identity PLUS stale balances.
    const legacyPersisted = {
      isConnected: true,
      publicKey: 'GCXXYZ...',
      walletType: 'inapp' as const,
      balance: '999',
      ecoBalance: '888',
      usdcBalance: '77.7',
    };

    // The new partialize drops the stale balance fields, so merging the
    // persisted payload back into the live store cannot restore them.
    const persisted = partializeWalletState({
      ...legacyPersisted,
      status: 'connected',
      connectError: null,
      beginConnect: () => {},
      connect: () => {},
      connectFailed: () => {},
      disconnect: () => {},
      setBalance: () => {},
      setEcoBalance: () => {},
      setUsdcBalance: () => {},
    });

    // Simulate cold-start rehydration: defaults + persisted slice only.
    useWalletStore.setState({
      isConnected: false,
      publicKey: null,
      balance: null,
      ecoBalance: null,
      usdcBalance: null,
    });
    useWalletStore.setState({ ...persisted });

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.publicKey).toBe('GCXXYZ...');
    expect(state.walletType).toBe('inapp');
    // Balances must be null on cold start — useStellarWallet re-fetches them.
    expect(state.balance).toBeNull();
    expect(state.ecoBalance).toBeNull();
    expect(state.usdcBalance).toBeNull();
  });
});

describe('taskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [],
      selectedTask: null,
      selectedAt: null,
      isLoading: false,
      error: null,
      page: 1,
      hasMore: true,
    });
  });

  it('starts with empty state', () => {
    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.page).toBe(1);
    expect(state.hasMore).toBe(true);
  });

  it('sets tasks', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Plant tree',
        description: 'Desc',
        type: 'TREE_PLANTING' as const,
        rewardAmount: 10,
        lat: 0,
        lng: 0,
        status: 'open',
      },
    ];
    useTaskStore.getState().setTasks(tasks);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useTaskStore.getState().tasks[0]!.title).toBe('Plant tree');
  });

  it('appends tasks', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'A',
        description: '',
        type: 'TREE_PLANTING' as const,
        rewardAmount: 10,
        lat: 0,
        lng: 0,
        status: 'open',
      },
    ];
    useTaskStore.getState().setTasks(tasks);
    useTaskStore.getState().appendTasks([
      {
        id: '2',
        title: 'B',
        description: '',
        type: 'TRASH_COLLECTION' as const,
        rewardAmount: 20,
        lat: 1,
        lng: 1,
        status: 'open',
      },
    ]);
    expect(useTaskStore.getState().tasks).toHaveLength(2);
  });

  it('selects a task and stamps selectedAt', () => {
    const task: Task = {
      id: '1',
      title: 'Task',
      description: '',
      type: 'OTHER' as const,
      rewardAmount: 5,
      lat: 0,
      lng: 0,
      status: 'open',
    };
    useTaskStore.getState().selectTask(task);
    expect(useTaskStore.getState().selectedTask?.id).toBe('1');
    expect(useTaskStore.getState().selectedAt).toEqual(expect.any(String));
  });

  it('clears selectedAt when deselecting', () => {
    const task: Task = {
      id: '1',
      title: 'Task',
      description: '',
      type: 'OTHER' as const,
      rewardAmount: 5,
      lat: 0,
      lng: 0,
      status: 'open',
    };
    useTaskStore.getState().selectTask(task);
    useTaskStore.getState().selectTask(null);
    expect(useTaskStore.getState().selectedTask).toBeNull();
    expect(useTaskStore.getState().selectedAt).toBeNull();
  });

  it('resets state', () => {
    const { setTasks, setLoading, setError, reset } = useTaskStore.getState();
    setTasks([
      {
        id: '1',
        title: 'X',
        description: '',
        type: 'OTHER',
        rewardAmount: 1,
        lat: 0,
        lng: 0,
        status: 'open',
      },
    ]);
    setLoading(true);
    setError('err');
    reset();
    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.page).toBe(1);
    expect(state.hasMore).toBe(true);
  });

  it('partialize keeps selection and pagination, excludes isLoading and error', () => {
    const task = makeTask('1');
    const partial = partializeTaskState({
      tasks: [task],
      selectedTask: task,
      selectedAt: '2026-01-01T12:00:00.000Z',
      page: 2,
      hasMore: false,
    });
    expect(partial).toEqual({
      tasks: [task],
      selectedTask: task,
      selectedAt: '2026-01-01T12:00:00.000Z',
      page: 2,
      hasMore: false,
    });
    expect(partial).not.toHaveProperty('isLoading');
    expect(partial).not.toHaveProperty('error');
  });

  it('restores selectedTask and selectedAt when the task is still present', () => {
    const task = makeTask('1');
    const restored = sanitizePersistedTaskState({
      tasks: [task],
      selectedTask: { ...task, title: 'Stale title' },
      selectedAt: '2026-01-01T12:00:00.000Z',
      page: 1,
      hasMore: false,
    });
    expect(restored.selectedTask).toEqual(task);
    expect(restored.selectedAt).toBe('2026-01-01T12:00:00.000Z');
  });

  it('clears selectedTask when its id is missing from tasks after rehydration', () => {
    const restored = sanitizePersistedTaskState({
      tasks: [makeTask('1')],
      selectedTask: makeTask('gone'),
      selectedAt: '2026-01-01T12:00:00.000Z',
      page: 1,
      hasMore: true,
    });
    expect(restored.selectedTask).toBeNull();
    expect(restored.selectedAt).toBeNull();
  });

  it('validates stale page/hasMore against the persisted task count', () => {
    const tasks = Array.from({ length: TASK_PAGE_SIZE + 5 }, (_, i) =>
      makeTask(String(i + 1)),
    );
    const restored = sanitizePersistedTaskState({
      tasks,
      selectedTask: null,
      selectedAt: null,
      page: 9,
      hasMore: true,
    });
    // 25 tasks => 2 pages; partial last page forces hasMore false.
    expect(restored.page).toBe(2);
    expect(restored.hasMore).toBe(false);
  });

  it('aligns page upward when more full pages of tasks are present than page claims', () => {
    const tasks = Array.from({ length: TASK_PAGE_SIZE * 2 }, (_, i) =>
      makeTask(String(i + 1)),
    );
    const restored = sanitizePersistedTaskState({
      tasks,
      selectedTask: null,
      selectedAt: null,
      page: 1,
      hasMore: true,
    });
    expect(restored.page).toBe(2);
    expect(restored.hasMore).toBe(true);
  });

  it('resets pagination when no tasks were persisted', () => {
    const restored = sanitizePersistedTaskState({
      tasks: [],
      selectedTask: makeTask('1'),
      selectedAt: '2026-01-01T12:00:00.000Z',
      page: 4,
      hasMore: false,
    });
    expect(restored).toEqual({
      tasks: [],
      selectedTask: null,
      selectedAt: null,
      page: 1,
      hasMore: true,
    });
  });

  it('applies sanitized persistence into the live store without restoring transients', () => {
    const task = makeTask('1');
    // Pollute transient fields as if a fetch were in flight before restart.
    useTaskStore.setState({ isLoading: true, error: 'network' });

    const partial = partializeTaskState({
      tasks: [task],
      selectedTask: task,
      selectedAt: '2026-01-01T12:00:00.000Z',
      page: 1,
      hasMore: false,
    });
    expect(partial).not.toHaveProperty('isLoading');
    expect(partial).not.toHaveProperty('error');

    // Simulate persist merge: defaults for transients + sanitized slice.
    useTaskStore.setState({
      isLoading: false,
      error: null,
      ...sanitizePersistedTaskState(partial),
    });

    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([task]);
    expect(state.selectedTask?.id).toBe('1');
    expect(state.selectedAt).toBe('2026-01-01T12:00:00.000Z');
    expect(state.page).toBe(1);
    expect(state.hasMore).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe('userStore', () => {
  beforeEach(() => {
    useUserStore.setState({ profile: null, token: null, tokenExpiresAt: null });
  });
  it('starts with no profile or token', () => {
    const state = useUserStore.getState();
    expect(state.profile).toBeNull();
    expect(state.token).toBeNull();
  });

  it('sets profile with stats', () => {
    useUserStore.getState().setProfile({
      id: 'u1',
      wallet: 'GCXXYZ',
      name: 'Alice',
      stats: { treesPlanted: 5, plasticCollected: 12, co2Reduced: 30 },
    });
    expect(useUserStore.getState().profile?.name).toBe('Alice');
    expect(useUserStore.getState().profile?.stats.treesPlanted).toBe(5);
  });

  it('sets token', () => {
    useUserStore.getState().setToken('jwt-abc');
    expect(useUserStore.getState().token).toBe('jwt-abc');
    expect(useUserStore.getState().tokenExpiresAt).toBeNull();
  });

  it('decodes token expiry from the JWT exp claim', () => {
    const token = makeJwt(1234567890);
    useUserStore.getState().setToken(token);
    expect(useUserStore.getState().tokenExpiresAt).toBe(1234567890 * 1000);
  });

  it('updates stats', () => {
    const { setProfile, updateStats } = useUserStore.getState();
    setProfile({
      id: 'u1',
      wallet: 'GCXXYZ',
      name: 'Alice',
      stats: { treesPlanted: 5, plasticCollected: 10, co2Reduced: 20 },
    });
    updateStats({ treesPlanted: 8 });
    const profile = useUserStore.getState().profile;
    expect(profile?.stats.treesPlanted).toBe(8);
    expect(profile?.stats.plasticCollected).toBe(10);
  });

  it('logs out and clears profile and token', () => {
    const { setProfile, setToken, logout } = useUserStore.getState();
    setProfile({
      id: 'u1',
      wallet: 'GCXXYZ',
      name: 'Alice',
      stats: { treesPlanted: 0, plasticCollected: 0, co2Reduced: 0 },
    });
    setToken(makeJwt(1234567890));
    logout();
    const state = useUserStore.getState();
    expect(state.profile).toBeNull();
    expect(state.token).toBeNull();
    expect(state.tokenExpiresAt).toBeNull();
  });
});

describe('activityStore', () => {
  beforeEach(() => {
    useActivityStore.setState({ activities: [] });
  });

  it('starts with an empty feed', () => {
    expect(useActivityStore.getState().activities).toEqual([]);
  });

  it('adds activities newest-first', () => {
    const { addActivity } = useActivityStore.getState();
    addActivity({
      id: '1',
      taskId: 't1',
      taskTitle: 'Plant tree',
      taskType: 'TREE_PLANTING',
      rewardAmount: 10,
      rewardToken: 'ECO',
      completedAt: '2026-01-01',
      status: 'confirmed',
    });
    addActivity({
      id: '2',
      taskId: 't2',
      taskTitle: 'Collect trash',
      taskType: 'TRASH_COLLECTION',
      rewardAmount: 5,
      rewardToken: 'ECO',
      completedAt: '2026-01-02',
      status: 'pending',
    });
    const activities = useActivityStore.getState().activities;
    expect(activities).toHaveLength(2);
    expect(activities[0]!.id).toBe('2');
  });

  it('caps the feed at 20 activities', () => {
    const { addActivity } = useActivityStore.getState();
    for (let i = 0; i < 25; i++) {
      addActivity({
        id: `a${i}`,
        taskId: 't',
        taskTitle: 'Task',
        taskType: 'OTHER',
        rewardAmount: 1,
        rewardToken: 'ECO',
        completedAt: '2026-01-01',
        status: 'confirmed',
      });
    }
    expect(useActivityStore.getState().activities).toHaveLength(20);
  });

  it('clears the feed', () => {
    useActivityStore.getState().addActivity({
      id: '1',
      taskId: 't',
      taskTitle: 'Task',
      taskType: 'OTHER',
      rewardAmount: 1,
      rewardToken: 'ECO',
      completedAt: '2026-01-01',
      status: 'confirmed',
    });
    useActivityStore.getState().clearActivities();
    expect(useActivityStore.getState().activities).toEqual([]);
  });

  it('updateActivityStatus patches the status of a single activity', () => {
    useActivityStore.getState().addActivity({
      id: 'a1',
      taskId: 't1',
      taskTitle: 'Plant tree',
      taskType: 'TREE_PLANTING',
      rewardAmount: 0,
      rewardToken: 'ECO',
      completedAt: '2026-01-01',
      status: 'pending',
    });
    useActivityStore.getState().updateActivityStatus('a1', 'confirmed', 10);
    const activity = useActivityStore
      .getState()
      .activities.find(a => a.id === 'a1');
    expect(activity?.status).toBe('confirmed');
    expect(activity?.rewardAmount).toBe(10);
  });

  it('updateActivityStatus does not mutate unrelated activities', () => {
    useActivityStore.getState().addActivity({
      id: 'a1',
      taskId: 't1',
      taskTitle: 'Task 1',
      taskType: 'OTHER',
      rewardAmount: 5,
      rewardToken: 'ECO',
      completedAt: '2026-01-01',
      status: 'pending',
    });
    useActivityStore.getState().addActivity({
      id: 'a2',
      taskId: 't2',
      taskTitle: 'Task 2',
      taskType: 'OTHER',
      rewardAmount: 3,
      rewardToken: 'ECO',
      completedAt: '2026-01-02',
      status: 'pending',
    });
    useActivityStore.getState().updateActivityStatus('a1', 'failed');
    const a2 = useActivityStore.getState().activities.find(a => a.id === 'a2');
    expect(a2?.status).toBe('pending');
  });

  it('updateActivityStatus to confirmed updates streaks', () => {
    useActivityStore.getState().addActivity({
      id: 'a1',
      taskId: 't1',
      taskTitle: 'Task',
      taskType: 'OTHER',
      rewardAmount: 0,
      rewardToken: 'ECO',
      completedAt: new Date().toISOString(),
      status: 'pending',
    });
    // Streak should be 0 while pending.
    expect(useActivityStore.getState().streak).toBe(0);
    useActivityStore.getState().updateActivityStatus('a1', 'confirmed');
    // Now it's confirmed, streak should become 1.
    expect(useActivityStore.getState().streak).toBe(1);
  });
});
