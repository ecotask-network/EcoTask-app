import './__mocks__/setup';

import { Alert } from 'react-native';
import api, { refreshAuthToken } from '../services/api';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import { getInAppSecret } from '../services/walletVault';
import { signChallengeXDR } from '../services/stellar';
import { decodeTokenExpiry } from '../utils/jwt';

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    STELLAR_NETWORK: 'testnet',
    BACKEND_URL: 'http://localhost:3000',
    ECO_TOKEN_ASSET_CODE: 'ECO',
    ECO_TOKEN_ISSUER: 'TESTISSUER',
  },
}));

jest.mock('../services/walletVault', () => ({
  getInAppSecret: jest.fn(),
  saveInAppSecret: jest.fn(),
  hasInAppSecret: jest.fn(),
  clearInAppSecret: jest.fn(),
}));

jest.mock('../services/stellar', () => ({
  signChallengeXDR: jest.fn(),
}));

const mockedGetInAppSecret = getInAppSecret as jest.Mock;
const mockedSignChallengeXDR = signChallengeXDR as jest.Mock;

const EXP = 2000000000; // deterministic far-future expiry (seconds)
const NEW_TOKEN = makeJwt(EXP);

function makeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
    'base64url',
  );
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.signature`;
}

interface MockAxiosConfig {
  url?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

interface MockAxiosError extends Error {
  config?: MockAxiosConfig;
  response?: {
    status: number;
    statusText: string;
    data: unknown;
    headers: Record<string, unknown>;
  };
}

function successResponse(data: unknown, config: MockAxiosConfig) {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
}

function unauthorizedError(config: MockAxiosConfig) {
  const error: MockAxiosError = new Error(
    'Request failed with status code 401',
  );
  error.config = config;
  error.response = {
    status: 401,
    statusText: 'Unauthorized',
    data: {},
    headers: {},
  };
  return Promise.reject(error);
}

function mockAuthEndpoints(adapter: jest.Mock): void {
  adapter.mockImplementation(async (config: MockAxiosConfig) => {
    if (config.url === '/auth/challenge') {
      return successResponse({ challenge: 'challenge-xdr' }, config);
    }
    if (config.url === '/auth/login') {
      return successResponse({ token: NEW_TOKEN, user: { id: 'u1' } }, config);
    }
    return successResponse({}, config);
  });
}

const adapter = jest.fn();
api.defaults.adapter = adapter as unknown as typeof api.defaults.adapter;

beforeEach(() => {
  useUserStore.setState({ profile: null, token: null, tokenExpiresAt: null });
  useWalletStore.setState({
    isConnected: false,
    publicKey: null,
    balance: null,
    ecoBalance: null,
  });
  mockedGetInAppSecret.mockReset();
  mockedSignChallengeXDR.mockReset();
  adapter.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('decodeTokenExpiry', () => {
  it('returns the exp claim as a millisecond timestamp', () => {
    expect(decodeTokenExpiry(NEW_TOKEN)).toBe(EXP * 1000);
  });

  it('returns null for malformed tokens', () => {
    expect(decodeTokenExpiry('not-a-jwt')).toBeNull();
    expect(decodeTokenExpiry('a.b.c')).toBeNull();
    expect(decodeTokenExpiry('a.b.c.d')).toBeNull();
  });
});

describe('refreshAuthToken', () => {
  beforeEach(() => {
    useWalletStore.getState().connect('GCKEY');
    mockedGetInAppSecret.mockReturnValue('Ssecret123');
    mockedSignChallengeXDR.mockReturnValue('signed-xdr');
    mockAuthEndpoints(adapter);
  });

  it('silently re-authenticates and stores the new token', async () => {
    const token = await refreshAuthToken();

    expect(token).toBe(NEW_TOKEN);
    expect(useUserStore.getState().token).toBe(NEW_TOKEN);
    expect(useUserStore.getState().tokenExpiresAt).toBe(EXP * 1000);
    expect(mockedGetInAppSecret).toHaveBeenCalledWith('GCKEY');
    expect(mockedSignChallengeXDR).toHaveBeenCalledWith(
      'challenge-xdr',
      'Ssecret123',
    );
  });

  it('deduplicates concurrent refresh calls into a single re-auth', async () => {
    const [first, second] = await Promise.all([
      refreshAuthToken(),
      refreshAuthToken(),
    ]);

    expect(first).toBe(NEW_TOKEN);
    expect(second).toBe(NEW_TOKEN);

    const loginCalls = adapter.mock.calls.filter(
      call => call[0].url === '/auth/login',
    );
    expect(loginCalls).toHaveLength(1);
  });
});

describe('request interceptor', () => {
  beforeEach(() => {
    useWalletStore.getState().connect('GCKEY');
    mockedGetInAppSecret.mockReturnValue('Ssecret123');
    mockedSignChallengeXDR.mockReturnValue('signed-xdr');
    mockAuthEndpoints(adapter);
  });

  it('refreshes before sending when the token is about to expire', async () => {
    // Already expired => triggers the pre-request refresh path.
    useUserStore
      .getState()
      .setToken(makeJwt(Math.floor(Date.now() / 1000) - 60));

    adapter.mockImplementationOnce(async (config: MockAxiosConfig) => {
      if (config.url === '/tasks') {
        expect(config.headers?.Authorization).toBe(`Bearer ${NEW_TOKEN}`);
      }
      return successResponse({ tasks: [] }, config);
    });

    await api.get('/tasks');

    const loginCalls = adapter.mock.calls.filter(
      call => call[0].url === '/auth/login',
    );
    expect(loginCalls).toHaveLength(1);
  });
});

describe('response interceptor', () => {
  it('alerts and logs out when re-auth fails on a 401', async () => {
    useWalletStore.getState().connect('GCKEY');
    useUserStore.getState().setToken(makeJwt(EXP));
    mockedGetInAppSecret.mockReturnValue(null); // no signing key => refresh fails
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    adapter.mockImplementation(async (config: MockAxiosConfig) => {
      if (config.url === '/auth/challenge') {
        return successResponse({ challenge: 'challenge-xdr' }, config);
      }
      if (config.url === '/tasks') {
        return unauthorizedError(config);
      }
      return successResponse({}, config);
    });

    await expect(api.get('/tasks')).rejects.toBeTruthy();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(useUserStore.getState().token).toBeNull();
    expect(useUserStore.getState().tokenExpiresAt).toBeNull();
    expect(useWalletStore.getState().isConnected).toBe(false);
  });

  it('retries the original request with the new token after a 401', async () => {
    useWalletStore.getState().connect('GCKEY');
    useUserStore.getState().setToken(makeJwt(EXP));
    mockedGetInAppSecret.mockReturnValue('Ssecret123');
    mockedSignChallengeXDR.mockReturnValue('signed-xdr');

    let taskRequests = 0;
    adapter.mockImplementation(async (config: MockAxiosConfig) => {
      if (config.url === '/auth/challenge') {
        return successResponse({ challenge: 'challenge-xdr' }, config);
      }
      if (config.url === '/auth/login') {
        return successResponse(
          { token: NEW_TOKEN, user: { id: 'u1' } },
          config,
        );
      }
      if (config.url === '/tasks') {
        taskRequests += 1;
        if (taskRequests === 1) {
          return unauthorizedError(config);
        }
        expect(config.headers?.Authorization).toBe(`Bearer ${NEW_TOKEN}`);
        return successResponse({ tasks: [{ id: 't1' }] }, config);
      }
      return successResponse({}, config);
    });

    const result = await api.get<{ tasks: { id: string }[] }>('/tasks');

    expect(result.data.tasks).toEqual([{ id: 't1' }]);
    expect(taskRequests).toBe(2);

    const loginCalls = adapter.mock.calls.filter(
      call => call[0].url === '/auth/login',
    );
    expect(loginCalls).toHaveLength(1);
  });
});
