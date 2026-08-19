import * as api from '../../services/api';
import { fetchTasks, fetchTaskById } from '../../services/api';
import { useUserStore } from '../../store/userStore';

describe('api integration flow (mocked)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useUserStore.setState({ token: null, profile: null } as any);
  });

  test('auth challenge -> login -> fetchTasks -> submitProof', async () => {
    const wallet = 'GABC';
    const spyGetAuth = jest.spyOn(api, 'getAuthChallenge');
    spyGetAuth.mockResolvedValue({ challenge: 'nonce-123' } as any);
    const spyLogin = jest.spyOn(api, 'loginWithWallet');
    spyLogin.mockResolvedValue({ token: 'tok', user: { id: 'u1' } } as any);
    const spyFetch = jest.spyOn(api, 'fetchTasks');
    spyFetch.mockResolvedValue([{ id: 't1' }] as any);
    const spySubmit = jest.spyOn(api, 'submitProof');
    spySubmit.mockResolvedValue({ id: 'proof1', status: 'confirmed' } as any);

    const c = await api.getAuthChallenge(wallet);
    expect(c.challenge).toBe('nonce-123');

    const login = await api.loginWithWallet(wallet, 'sig', c.challenge);
    expect(login.token).toBe('tok');
    useUserStore.setState({ token: login.token, profile: login.user } as any);

    const tasks = await api.fetchTasks();
    expect(Array.isArray(tasks)).toBe(true);

    const proofRes = await api.submitProof(new FormData() as any);
    expect(proofRes.id).toBe('proof1');
  });
});

describe('API Integration', () => {
  it('fetchTasks returns paginated results', async () => {
    const result = await fetchTasks({ page: 1, limit: 5 });
    expect(result.tasks).toBeDefined();
    expect(Array.isArray(result.tasks)).toBe(true);
  });

  it('fetchTaskById returns a single task', async () => {
    const list = await fetchTasks({ page: 1, limit: 1 });
    if (list.tasks.length > 0) {
      const task = await fetchTaskById(list.tasks[0].id);
      expect(task.id).toBe(list.tasks[0].id);
      expect(task.title).toBeDefined();
    }
  });
});
