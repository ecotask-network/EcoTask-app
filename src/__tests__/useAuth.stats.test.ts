import './__mocks__/setup';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import { getInAppSecret } from '../services/walletVault';
import { signChallengeXDR } from '../services/stellar';

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

function successResponse(data: unknown, config: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

interface MockAxiosConfig {
  url?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

const adapter = jest.fn();
api.defaults.adapter = adapter as unknown as typeof api.defaults.adapter;

function mockEndpoints({
  loginUser = { id: 'u1', name: 'Ada' },
  meResponse,
  meFails = false,
}: {
  loginUser?: { id: string; name?: string; bio?: string; avatarUrl?: string };
  meResponse?: unknown;
  meFails?: boolean;
} = {}) {
  adapter.mockImplementation(async (config: MockAxiosConfig) => {
    if (config.url === '/auth/challenge') {
      return successResponse({ challenge: 'challenge-xdr' }, config);
    }
    if (config.url === '/auth/login') {
      return successResponse({ token: 'tok.en.jwt', user: loginUser }, config);
    }
    if (config.url === '/auth/me') {
      if (meFails) {
        return Promise.reject(new Error('network error'));
      }
      return successResponse(meResponse, config);
    }
    return successResponse({}, config);
  });
}

function HookHarness({
  onRef,
}: {
  onRef: (ref: ReturnType<typeof useAuth>) => void;
}) {
  const hook = useAuth();
  React.useEffect(() => {
    onRef(hook);
  });
  return null;
}

describe('useAuth stat handling', () => {
  let instance: renderer.ReactTestRenderer | null = null;
  let hookRef: ReturnType<typeof useAuth>;

  beforeEach(() => {
    useUserStore.setState({ profile: null, token: null, tokenExpiresAt: null });
    useWalletStore.setState({
      isConnected: false,
      publicKey: null,
      balance: null,
      ecoBalance: null,
      walletType: null,
    });
    useWalletStore.getState().connect('GCKEY');
    mockedGetInAppSecret.mockReturnValue('Ssecret123');
    mockedSignChallengeXDR.mockReturnValue('signed-xdr');
    adapter.mockReset();

    act(() => {
      instance = renderer.create(
        React.createElement(HookHarness, {
          onRef: ref => {
            hookRef = ref;
          },
        }),
      );
    });
  });

  afterEach(() => {
    if (instance) {
      act(() => {
        instance?.unmount();
      });
      instance = null;
    }
    jest.restoreAllMocks();
  });

  it('authenticate() uses the server-provided stats, not hardcoded zeros', async () => {
    mockEndpoints({
      meResponse: {
        id: 'u1',
        wallet: 'GCKEY',
        name: 'Ada',
        stats: { treesPlanted: 5, plasticCollected: 12, co2Reduced: 30 },
      },
    });

    await act(async () => {
      await hookRef.authenticate('GCKEY');
    });

    expect(useUserStore.getState().profile?.stats).toEqual({
      treesPlanted: 5,
      plasticCollected: 12,
      co2Reduced: 30,
    });
    expect(useUserStore.getState().token).toBe('tok.en.jwt');
  });

  it('authenticate() reflects zero stats for a new user with no history', async () => {
    mockEndpoints({
      meResponse: {
        id: 'u1',
        wallet: 'GCKEY',
        stats: { treesPlanted: 0, plasticCollected: 0, co2Reduced: 0 },
      },
    });

    await act(async () => {
      await hookRef.authenticate('GCKEY');
    });

    expect(useUserStore.getState().profile?.stats).toEqual({
      treesPlanted: 0,
      plasticCollected: 0,
      co2Reduced: 0,
    });
  });

  it('authenticate() degrades to zero stats (without throwing) if the profile fetch fails', async () => {
    mockEndpoints({ meFails: true });

    let result: { token: string } | undefined;
    await act(async () => {
      result = await hookRef.authenticate('GCKEY');
    });

    expect(result?.token).toBe('tok.en.jwt');
    expect(useUserStore.getState().profile?.stats).toEqual({
      treesPlanted: 0,
      plasticCollected: 0,
      co2Reduced: 0,
    });
    // The token is still set so a later syncProfile()/retry can succeed.
    expect(useUserStore.getState().token).toBe('tok.en.jwt');
  });

  it('syncProfile() adopts freshly fetched server stats over stale local ones', async () => {
    act(() => {
      useUserStore.getState().setProfile({
        id: 'u1',
        wallet: 'GCKEY',
        stats: { treesPlanted: 1, plasticCollected: 1, co2Reduced: 1 },
      });
    });
    mockEndpoints({
      meResponse: {
        id: 'u1',
        wallet: 'GCKEY',
        stats: { treesPlanted: 9, plasticCollected: 9, co2Reduced: 9 },
      },
    });

    await act(async () => {
      await hookRef.syncProfile();
    });

    expect(useUserStore.getState().profile?.stats).toEqual({
      treesPlanted: 9,
      plasticCollected: 9,
      co2Reduced: 9,
    });
  });
});
