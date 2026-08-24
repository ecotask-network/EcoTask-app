/**
 * Tests for the wallet connect flow in useStellarWallet.
 *
 * Regression tests for the "connected with unknown balance" bug:
 * connect() used to run BEFORE the balance fetch, so a network failure
 * left `isConnected: true` (persisted) while the balance was null/zero.
 *
 * Covers, for every wallet path (Freighter, Lobstr, in-app create, import):
 *  - happy path: balances are verified first, then the store flips to
 *    connected atomically WITH those balances
 *  - balance fetch failure: store rolls back to a clean disconnected
 *    state, a meaningful connectError is recorded, and the secret key is
 *    NOT orphaned in the vault
 *  - partial failure (XLM ok, ECO fetch fails): still fully rolled back
 *  - 'connecting' intermediate state while the fetch is in flight
 *  - unfunded accounts connect with a '0' balance (zero is not failure)
 *  - later refresh failures keep the last known balance instead of
 *    rejecting into fire-and-forget call sites
 */

import './__mocks__/setup';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { useWalletStore } from '../store/walletStore';
import { getInAppSecret, clearInAppSecret } from '../services/walletVault';
import * as stellarMock from '../services/stellar';
import * as lobstrMock from '../services/lobstr';

// The root __mocks__/react-native-config.js (empty stub) takes precedence
// over mocks registered inside imported setup modules, so the asset config
// must be mocked directly in this file for the ECO/USDC fetch paths to run.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    STELLAR_NETWORK: 'testnet',
    BACKEND_URL: 'http://localhost:3000',
    ECO_TOKEN_ASSET_CODE: 'ECO',
    ECO_TOKEN_ISSUER: 'TESTISSUER',
    USDC_ISSUER: 'TESTUSDCISSUER',
  },
}));

jest.mock('../services/stellar', () => {
  class MockTransactionBuilder {
    addOperation() {
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return { toXDR: () => 'CHALLENGE_XDR' };
    }
    static fromXDR = jest.fn(() => ({ source: 'GLOBSTRUSERKEY' }));
  }
  return {
    getBalance: jest.fn(),
    getTokenBalance: jest.fn(),
    createTestnetAccount: jest.fn(),
    isValidSecretKey: jest.fn(),
    getPublicKeyFromSecret: jest.fn(),
    Keypair: {
      random: jest.fn(() => ({ publicKey: () => 'GCEPHEMERALKEY' })),
    },
    Networks: { TESTNET: 'Test SDF Network', PUBLIC: 'Public Global Network' },
    Account: class {
      key: string;
      sequence: string;
      constructor(key: string, sequence: string) {
        this.key = key;
        this.sequence = sequence;
      }
    },
    Operation: { manageData: jest.fn(() => ({})) },
    BASE_FEE: '100',
    TransactionBuilder: MockTransactionBuilder,
  };
});

jest.mock('../services/lobstr', () => {
  class LobstrNotInstalledError extends Error {
    constructor(message = 'Lobstr is not installed') {
      super(message);
      this.name = 'LobstrNotInstalledError';
    }
  }
  return {
    isLobstrInstalled: jest.fn(),
    openLobstrForSigning: jest.fn(),
    LobstrNotInstalledError,
  };
});

const getBalance = stellarMock.getBalance as jest.Mock;
const getTokenBalance = stellarMock.getTokenBalance as jest.Mock;
const createTestnetAccount = stellarMock.createTestnetAccount as jest.Mock;
const isValidSecretKey = stellarMock.isValidSecretKey as jest.Mock;
const getPublicKeyFromSecret = stellarMock.getPublicKeyFromSecret as jest.Mock;
const isLobstrInstalled = lobstrMock.isLobstrInstalled as jest.Mock;
const openLobstrForSigning = lobstrMock.openLobstrForSigning as jest.Mock;

const IN_APP_PK = 'GCINAPPKEY';
const IN_APP_SECRET = 'SINAPPSECRET';
const FREIGHTER_PK = 'GCFREIGHTERKEY';
const IMPORT_PK = 'GCIMPORTEDKEY';

type WalletHook = ReturnType<typeof useStellarWallet>;
let hook: WalletHook;

function Probe() {
  hook = useStellarWallet();
  return null;
}

function resetWalletStore() {
  useWalletStore.setState({
    isConnected: false,
    status: 'disconnected',
    connectError: null,
    publicKey: null,
    balance: null,
    ecoBalance: null,
    usdcBalance: null,
    walletType: null,
  });
}

function expectDisconnected() {
  const state = useWalletStore.getState();
  // Exactly what RootNavigator gates on — must stay false on failure.
  expect(state.isConnected).toBe(false);
  expect(state.status).toBe('disconnected');
  expect(state.publicKey).toBeNull();
  expect(state.balance).toBeNull();
  expect(state.ecoBalance).toBeNull();
  expect(state.usdcBalance).toBeNull();
  expect(state.walletType).toBeNull();
}

function expectConnected(
  publicKey: string,
  walletType: 'freighter' | 'inapp' | 'lobstr',
  balance: string,
  ecoBalance: string | null,
  usdcBalance: string | null = '25',
) {
  const state = useWalletStore.getState();
  expect(state.isConnected).toBe(true);
  expect(state.status).toBe('connected');
  expect(state.connectError).toBeNull();
  expect(state.publicKey).toBe(publicKey);
  expect(state.walletType).toBe(walletType);
  expect(state.balance).toBe(balance);
  expect(state.ecoBalance).toBe(ecoBalance);
  expect(state.usdcBalance).toBe(usdcBalance);
}

async function renderProbe() {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  // @ts-expect-error assigned inside act above
  return tree as renderer.ReactTestRenderer;
}

describe('useStellarWallet connect flow', () => {
  let tree: renderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    resetWalletStore();
    // The MMKV mock store persists across tests in a file — clear vault
    // entries so secret-hygiene assertions start from a clean slate.
    clearInAppSecret(IN_APP_PK);
    clearInAppSecret(IMPORT_PK);
    // Defaults: healthy network, funded account (idempotent for the
    // post-connect refresh effect).
    getBalance.mockResolvedValue('123.45');
    getTokenBalance.mockImplementation((_pk: string, assetCode: string) =>
      Promise.resolve(assetCode === 'USDC' ? '25' : '75'),
    );
    createTestnetAccount.mockResolvedValue({
      publicKey: IN_APP_PK,
      secretKey: IN_APP_SECRET,
    });
    isValidSecretKey.mockReturnValue(true);
    getPublicKeyFromSecret.mockReturnValue(IMPORT_PK);
    isLobstrInstalled.mockResolvedValue(true);
    openLobstrForSigning.mockResolvedValue('SIGNED_CHALLENGE_XDR');
  });

  afterEach(async () => {
    await act(async () => {
      tree?.unmount();
    });
    tree = null;
    delete (globalThis as { window?: unknown }).window;
  });

  describe('happy paths', () => {
    it('in-app wallet: verifies balances BEFORE marking connected, atomically', async () => {
      tree = await renderProbe();
      let wallet: { publicKey: string; secretKey: string } | undefined;
      await act(async () => {
        wallet = await hook.createInAppWallet();
      });

      expect(wallet).toEqual({
        publicKey: IN_APP_PK,
        secretKey: IN_APP_SECRET,
      });
      // getBalance ran before the store flipped to connected.
      expect(getBalance).toHaveBeenCalledWith(IN_APP_PK);
      expectConnected(IN_APP_PK, 'inapp', '123.45', '75', '25');
      // Secret only persisted after the balance was verified.
      expect(getInAppSecret(IN_APP_PK)).toBe(IN_APP_SECRET);
      expect(hook.error).toBeNull();
    });

    it('in-app wallet: unfunded account connects with a zero balance', async () => {
      getBalance.mockResolvedValue('0');
      getTokenBalance.mockResolvedValue('0');
      tree = await renderProbe();
      await act(async () => {
        await hook.createInAppWallet();
      });
      // A zero balance is a valid connected state ( NotFound at the
      // service layer resolves to '0') — zero must not be treated as
      // failure.
      expectConnected(IN_APP_PK, 'inapp', '0', '0', '0');
    });

    it('holds a "connecting" intermediate state until balances are verified', async () => {
      let resolveBalance!: (value: string) => void;
      getBalance.mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolveBalance = resolve;
          }),
      );

      tree = await renderProbe();
      let pending!: Promise<
        { publicKey: string; secretKey: string } | undefined
      >;
      await act(async () => {
        pending = hook.createInAppWallet();
      });

      // Fetch in flight: intermediate state, app NOT connected yet.
      expect(useWalletStore.getState().status).toBe('connecting');
      expect(useWalletStore.getState().isConnected).toBe(false);

      await act(async () => {
        resolveBalance('5');
        await pending;
      });

      expectConnected(IN_APP_PK, 'inapp', '5', '75', '25');
    });

    it('Freighter: connects successfully and records the wallet type', async () => {
      (globalThis as { window?: unknown }).window = {
        freighter: {
          isConnected: jest.fn().mockResolvedValue(true),
          getPublicKey: jest.fn().mockResolvedValue(FREIGHTER_PK),
          signTransaction: jest.fn(),
        },
      };
      tree = await renderProbe();
      await act(async () => {
        await hook.connectFreighter();
      });
      expectConnected(FREIGHTER_PK, 'freighter', '123.45', '75', '25');
      expect(hook.error).toBeNull();
    });

    it('Lobstr: connects successfully and extracts the key from the signed challenge', async () => {
      tree = await renderProbe();
      await act(async () => {
        await hook.connectLobstr();
      });
      expect(openLobstrForSigning).toHaveBeenCalled();
      expectConnected('GLOBSTRUSERKEY', 'lobstr', '123.45', '75', '25');
      expect(hook.error).toBeNull();
    });

    it('import: valid secret key connects and persists to the vault', async () => {
      tree = await renderProbe();
      let result: { publicKey: string } | undefined;
      await act(async () => {
        result = await hook.importWallet('  SVALIDIMPORTSECRET  ');
      });
      expect(result).toEqual({ publicKey: IMPORT_PK });
      // Secret is trimmed before validation/derivation.
      expect(isValidSecretKey).toHaveBeenCalledWith('SVALIDIMPORTSECRET');
      expectConnected(IMPORT_PK, 'inapp', '123.45', '75', '25');
      expect(getInAppSecret(IMPORT_PK)).toBe('SVALIDIMPORTSECRET');
      expect(hook.error).toBeNull();
    });
  });

  describe('balance fetch failure rolls back (all wallet paths)', () => {
    it('in-app create: wallet is NOT connected, error surfaces, secret not saved', async () => {
      getBalance.mockRejectedValue(new Error('Network request failed'));
      tree = await renderProbe();

      let wallet: { publicKey: string; secretKey: string } | undefined;
      await act(async () => {
        wallet = await hook.createInAppWallet();
      });

      expect(wallet).toBeUndefined();
      expectDisconnected();
      expect(useWalletStore.getState().connectError).toBe(
        'Network request failed',
      );
      expect(hook.error).toBe('Network request failed');
      // The freshly generated secret must not be orphaned in the vault.
      expect(getInAppSecret(IN_APP_PK)).toBeNull();
    });

    it('Freighter: wallet is NOT connected and the error surfaces', async () => {
      (globalThis as { window?: unknown }).window = {
        freighter: {
          isConnected: jest.fn().mockResolvedValue(true),
          getPublicKey: jest.fn().mockResolvedValue(FREIGHTER_PK),
          signTransaction: jest.fn(),
        },
      };
      getBalance.mockRejectedValue(new Error('Network request failed'));
      tree = await renderProbe();

      await act(async () => {
        await hook.connectFreighter();
      });

      expectDisconnected();
      expect(useWalletStore.getState().connectError).toBe(
        'Network request failed',
      );
      expect(hook.error).toBe('Network request failed');
    });

    it('Lobstr: wallet is NOT connected and the error surfaces', async () => {
      getBalance.mockRejectedValue(new Error('Network request failed'));
      tree = await renderProbe();

      await act(async () => {
        await hook.connectLobstr();
      });

      // The SEP-7 challenge was built and the pubkey extracted…
      expect(openLobstrForSigning).toHaveBeenCalled();
      expect(getBalance).toHaveBeenCalledWith('GLOBSTRUSERKEY');
      // …but the store was rolled back instead of left half-connected.
      expectDisconnected();
      expect(useWalletStore.getState().connectError).toBe(
        'Network request failed',
      );
      expect(hook.error).toBe('Network request failed');
    });

    it('import: wallet is NOT connected, error surfaces, secret not saved', async () => {
      getBalance.mockRejectedValue(new Error('Network request failed'));
      tree = await renderProbe();

      let result: { publicKey: string } | undefined;
      await act(async () => {
        result = await hook.importWallet('  SEXISTINGSECRET  ');
      });

      expect(result).toBeUndefined();
      expect(getPublicKeyFromSecret).toHaveBeenCalledWith('SEXISTINGSECRET');
      expectDisconnected();
      expect(useWalletStore.getState().connectError).toBe(
        'Network request failed',
      );
      expect(hook.error).toBe('Network request failed');
      expect(getInAppSecret(IMPORT_PK)).toBeNull();
    });

    it('partial failure (XLM ok, ECO fetch fails) still rolls back fully', async () => {
      getBalance.mockResolvedValue('10');
      getTokenBalance.mockRejectedValueOnce(new Error('Horizon timeout'));
      tree = await renderProbe();

      let wallet: { publicKey: string; secretKey: string } | undefined;
      await act(async () => {
        wallet = await hook.createInAppWallet();
      });

      expect(wallet).toBeUndefined();
      // Even though the XLM balance resolved, nothing may leak through.
      expectDisconnected();
      expect(useWalletStore.getState().connectError).toBe('Horizon timeout');
      expect(hook.error).toBe('Horizon timeout');
      expect(getInAppSecret(IN_APP_PK)).toBeNull();
    });

    it('partial failure (XLM ok, USDC fetch fails) still rolls back fully', async () => {
      getBalance.mockResolvedValue('10');
      // First token call (ECO) succeeds, second (USDC) fails.
      getTokenBalance
        .mockImplementationOnce(() => Promise.resolve('75'))
        .mockRejectedValueOnce(new Error('USDC horizon down'));
      tree = await renderProbe();

      let wallet: { publicKey: string; secretKey: string } | undefined;
      await act(async () => {
        wallet = await hook.createInAppWallet();
      });

      expect(wallet).toBeUndefined();
      expectDisconnected();
      expect(useWalletStore.getState().connectError).toBe('USDC horizon down');
      expect(hook.error).toBe('USDC horizon down');
      expect(getInAppSecret(IN_APP_PK)).toBeNull();
    });
  });

  describe('connection errors (per wallet path)', () => {
    it('Freighter: reports when the extension is not detected', async () => {
      delete (globalThis as { window?: unknown }).window;
      tree = await renderProbe();
      await act(async () => {
        await hook.connectFreighter();
      });
      expect(hook.error).toBe('Freighter extension not detected');
      expectDisconnected();
    });

    it('Freighter: asks the user to unlock the extension when not connected', async () => {
      (globalThis as { window?: unknown }).window = {
        freighter: {
          isConnected: jest.fn().mockResolvedValue(false),
          getPublicKey: jest.fn(),
          signTransaction: jest.fn(),
        },
      };
      tree = await renderProbe();
      await act(async () => {
        await hook.connectFreighter();
      });
      expect(hook.error).toBe('Please unlock Freighter first');
      expect(getBalance).not.toHaveBeenCalled();
      expectDisconnected();
    });

    it('Lobstr: surfaces a clear error when the app is not installed', async () => {
      isLobstrInstalled.mockResolvedValue(false);
      tree = await renderProbe();
      await act(async () => {
        await hook.connectLobstr();
      });
      expect(hook.error).toMatch(/Lobstr is not installed/i);
      expect(openLobstrForSigning).not.toHaveBeenCalled();
      expectDisconnected();
    });

    it('Lobstr: surfaces an error when signing is cancelled', async () => {
      openLobstrForSigning.mockRejectedValue(
        new Error('Lobstr signing was cancelled'),
      );
      tree = await renderProbe();
      await act(async () => {
        await hook.connectLobstr();
      });
      expect(hook.error).toBe('Lobstr signing was cancelled');
      expect(getBalance).not.toHaveBeenCalled();
      expectDisconnected();
    });

    it('import: invalid secret key is rejected without persisting', async () => {
      isValidSecretKey.mockReturnValue(false);
      tree = await renderProbe();
      let result: { publicKey: string } | undefined;
      await act(async () => {
        result = await hook.importWallet('SBADKEY');
      });
      expect(result).toBeUndefined();
      expect(hook.error).toBe('Invalid secret key');
      expect(getPublicKeyFromSecret).not.toHaveBeenCalled();
      expect(getBalance).not.toHaveBeenCalled();
      expectDisconnected();
      expect(getInAppSecret(IMPORT_PK)).toBeNull();
    });
  });

  describe('disconnectWallet', () => {
    it('clears the vault entry and resets the store', async () => {
      tree = await renderProbe();
      await act(async () => {
        await hook.createInAppWallet();
      });
      expect(getInAppSecret(IN_APP_PK)).toBe(IN_APP_SECRET);

      await act(async () => {
        hook.disconnectWallet();
      });
      expect(getInAppSecret(IN_APP_PK)).toBeNull();
      expectDisconnected();
    });
  });

  describe('refreshes after connect are fail-safe', () => {
    it('keeps the last known balance when a later refresh fails', async () => {
      tree = await renderProbe();
      await act(async () => {
        await hook.createInAppWallet();
      });
      expect(useWalletStore.getState().balance).toBe('123.45');

      // A later network blip during refresh must not reject into the
      // fire-and-forget call sites nor wipe the verified balance.
      getBalance.mockRejectedValue(new Error('offline blip'));
      await act(async () => {
        await hook.refreshBalance();
      });

      expect(useWalletStore.getState().balance).toBe('123.45');
      expect(useWalletStore.getState().isConnected).toBe(true);
      expect(hook.error).toBe('offline blip');
    });

    it('refreshBalance updates the store with a fresh balance', async () => {
      tree = await renderProbe();
      await act(async () => {
        await hook.createInAppWallet();
      });
      expect(useWalletStore.getState().balance).toBe('123.45');

      getBalance.mockResolvedValue('999.99');
      await act(async () => {
        await hook.refreshBalance();
      });
      expect(useWalletStore.getState().balance).toBe('999.99');
      expect(hook.error).toBeNull();
    });

    it('refreshEcoBalance and refreshUsdcBalance update their token balances', async () => {
      tree = await renderProbe();
      await act(async () => {
        await hook.createInAppWallet();
      });

      getTokenBalance.mockImplementation((_pk: string, assetCode: string) =>
        Promise.resolve(assetCode === 'USDC' ? '42' : '13'),
      );
      await act(async () => {
        await hook.refreshEcoBalance();
        await hook.refreshUsdcBalance();
      });
      expect(useWalletStore.getState().ecoBalance).toBe('13');
      expect(useWalletStore.getState().usdcBalance).toBe('42');
      expect(hook.error).toBeNull();
    });

    it('keeps the last known token balance when a token refresh fails', async () => {
      tree = await renderProbe();
      await act(async () => {
        await hook.createInAppWallet();
      });
      expect(useWalletStore.getState().ecoBalance).toBe('75');

      getTokenBalance.mockRejectedValue(new Error('token horizon down'));
      await act(async () => {
        await hook.refreshEcoBalance();
      });
      expect(useWalletStore.getState().ecoBalance).toBe('75');
      expect(hook.error).toBe('token horizon down');
    });
  });
});

describe('walletStore connection lifecycle', () => {
  beforeEach(() => {
    resetWalletStore();
  });

  it('starts disconnected with no connect error', () => {
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.status).toBe('disconnected');
    expect(state.connectError).toBeNull();
  });

  it('beginConnect enters an intermediate state without connecting', () => {
    useWalletStore.getState().beginConnect();
    const state = useWalletStore.getState();
    expect(state.status).toBe('connecting');
    expect(state.isConnected).toBe(false);
  });

  it('beginConnect clears a stale connectError on retry', () => {
    useWalletStore.getState().connectFailed('previous failure');
    useWalletStore.getState().beginConnect();
    expect(useWalletStore.getState().connectError).toBeNull();
  });

  it('connect stores verified balances atomically with isConnected', () => {
    useWalletStore.getState().connect('GCNEW', 'freighter', {
      balance: '9.9',
      ecoBalance: '3.3',
      usdcBalance: null,
    });
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.status).toBe('connected');
    expect(state.connectError).toBeNull();
    expect(state.publicKey).toBe('GCNEW');
    expect(state.walletType).toBe('freighter');
    expect(state.balance).toBe('9.9');
    expect(state.ecoBalance).toBe('3.3');
    expect(state.usdcBalance).toBeNull();
  });

  it('connect without balances keeps existing balances (back-compat)', () => {
    useWalletStore.getState().connect('GCOLD', 'inapp');
    useWalletStore.getState().setBalance('77');
    useWalletStore.getState().connect('GCOLD', 'inapp');
    expect(useWalletStore.getState().balance).toBe('77');
    expect(useWalletStore.getState().isConnected).toBe(true);
  });

  it('connecting a different wallet resets previous balances', () => {
    useWalletStore.getState().connect('GCFIRST', 'inapp', {
      balance: '1',
      ecoBalance: '2',
      usdcBalance: '3',
    });
    useWalletStore.getState().connect('GCSECOND', 'inapp', {
      balance: '10',
      ecoBalance: null,
      usdcBalance: null,
    });
    const state = useWalletStore.getState();
    expect(state.publicKey).toBe('GCSECOND');
    expect(state.balance).toBe('10');
    expect(state.ecoBalance).toBeNull();
    expect(state.usdcBalance).toBeNull();
  });

  it('connectFailed rolls every field back and records the error', () => {
    useWalletStore.getState().connect('GCNEW', 'inapp', {
      balance: '9.9',
      ecoBalance: '3.3',
      usdcBalance: null,
    });
    useWalletStore.getState().connectFailed('could not verify');
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.status).toBe('disconnected');
    expect(state.connectError).toBe('could not verify');
    expect(state.publicKey).toBeNull();
    expect(state.balance).toBeNull();
    expect(state.ecoBalance).toBeNull();
    expect(state.usdcBalance).toBeNull();
    expect(state.walletType).toBeNull();
  });

  it('disconnect clears the connectError too', () => {
    useWalletStore.getState().connectFailed('could not verify');
    useWalletStore.getState().disconnect();
    expect(useWalletStore.getState().connectError).toBeNull();
    expect(useWalletStore.getState().status).toBe('disconnected');
    expect(useWalletStore.getState().isConnected).toBe(false);
  });
});
