import './__mocks__/setup';
import { useWalletStore } from '../store/walletStore';
import { useTaskStore } from '../store/taskStore';
import { useUserStore } from '../store/userStore';
import { useActivityStore } from '../store/activityStore';

describe('walletStore', () => {
  beforeEach(() => {
    useWalletStore.setState({
      isConnected: false,
      publicKey: null,
      balance: null,
      ecoBalance: null,
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

  it('disconnects and clears all state', () => {
    const { connect, setBalance, setEcoBalance, disconnect } =
      useWalletStore.getState();
    connect('GCXXYZ...');
    setBalance('10');
    setEcoBalance('20');
    disconnect();
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.publicKey).toBeNull();
    expect(state.balance).toBeNull();
    expect(state.ecoBalance).toBeNull();
  });
});

describe('taskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [],
      selectedTask: null,
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
    const tasks = [
      {
        id: '1',
        title: 'Plant tree',
        description: 'Desc',
        type: 'TREE_PLANTING',
        rewardAmount: 10,
        lat: 0,
        lng: 0,
        status: 'open',
      },
    ];
    useTaskStore.getState().setTasks(tasks as any);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useTaskStore.getState().tasks[0].title).toBe('Plant tree');
  });

  it('appends tasks', () => {
    const tasks = [
      {
        id: '1',
        title: 'A',
        description: '',
        type: 'TREE_PLANTING',
        rewardAmount: 10,
        lat: 0,
        lng: 0,
        status: 'open',
      },
    ];
    useTaskStore.getState().setTasks(tasks as any);
    useTaskStore.getState().appendTasks([
      {
        id: '2',
        title: 'B',
        description: '',
        type: 'TRASH_COLLECTION',
        rewardAmount: 20,
        lat: 1,
        lng: 1,
        status: 'open',
      },
    ]);
    expect(useTaskStore.getState().tasks).toHaveLength(2);
  });

  it('selects a task', () => {
    const task = {
      id: '1',
      title: 'Task',
      description: '',
      type: 'OTHER',
      rewardAmount: 5,
      lat: 0,
      lng: 0,
      status: 'open',
    };
    useTaskStore.getState().selectTask(task as any);
    expect(useTaskStore.getState().selectedTask?.id).toBe('1');
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
});

describe('userStore', () => {
  beforeEach(() => {
    useUserStore.setState({ profile: null, token: null });
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
    setToken('jwt-abc');
    logout();
    const state = useUserStore.getState();
    expect(state.profile).toBeNull();
    expect(state.token).toBeNull();
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
    expect(activities[0].id).toBe('2');
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
});
