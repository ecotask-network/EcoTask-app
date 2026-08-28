/**
 * Tests for the Lobstr SEP-7 deep-link service.
 *
 * Covers:
 *  - SEP-7 `tx` URI construction
 *  - SEP-7 `pay` URI construction
 *  - Callback URL parsing
 *  - `LobstrNotInstalledError` when Linking.canOpenURL returns false
 *  - `openLobstrForSigning` resolves when resolveLobstrCallback is called
 *  - Concurrent signing callbacks, cancellation, and timeouts stay isolated
 */

// Mock react-native's Linking module before any imports.
jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

// Mock react-native-config so the network passphrase can be controlled per test.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { STELLAR_NETWORK: 'testnet' },
}));

import { Linking } from 'react-native';
import {
  buildSep7TxUri,
  buildSep7PayUri,
  parseLobstrCallbackUrl,
  openLobstrForSigning,
  openLobstrForPayment,
  resolveLobstrCallback,
  cancelLobstrCallback,
  LobstrNotInstalledError,
  LOBSTR_CALLBACK_URI,
  ECOTASK_SCHEME,
  LOBSTR_SIGNING_TIMEOUT_MS,
} from '../services/lobstr';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockCanOpenURL = Linking.canOpenURL as jest.Mock;
const mockOpenURL = Linking.openURL as jest.Mock;

async function flushLobstrOpen(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function getOpenedCallbackUrl(callIndex = 0): string {
  const sep7Uri = mockOpenURL.mock.calls[callIndex]?.[0] as string | undefined;
  if (!sep7Uri) {
    throw new Error(`Missing Lobstr openURL call at index ${callIndex}`);
  }
  const query = sep7Uri.slice(sep7Uri.indexOf('?') + 1);
  const callback = new URLSearchParams(query).get('callback');
  if (!callback?.startsWith('url:')) {
    throw new Error('Missing SEP-7 URL callback');
  }
  return callback.slice('url:'.length);
}

function getCallbackId(callIndex = 0): string {
  const id = new URL(getOpenedCallbackUrl(callIndex)).searchParams.get('id');
  if (!id) {
    throw new Error('Missing Lobstr callback correlation ID');
  }
  return id;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: Lobstr is installed.
  mockCanOpenURL.mockResolvedValue(true);
  // Default: openURL resolves immediately.
  mockOpenURL.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('ECOTASK_SCHEME', () => {
  it('equals "ecotask"', () => {
    expect(ECOTASK_SCHEME).toBe('ecotask');
  });
});

describe('LOBSTR_CALLBACK_URI', () => {
  it('starts with the ecotask scheme', () => {
    expect(LOBSTR_CALLBACK_URI).toMatch(/^ecotask:\/\//);
  });
});

// ---------------------------------------------------------------------------
// buildSep7TxUri
// ---------------------------------------------------------------------------

describe('buildSep7TxUri', () => {
  const XDR = 'AAAAAQAAAA==';
  const PUBLIC_KEY = 'GBILLBOARDPUBLICKEY';
  const CORRELATION_ID = 'signing-call-1';

  it('starts with the web+stellar:tx prefix', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY, CORRELATION_ID);
    expect(uri).toMatch(/^web\+stellar:tx\?/);
  });

  it('includes the encoded xdr parameter', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY, CORRELATION_ID);
    expect(uri).toContain('xdr=');
    // The raw XDR value must appear URL-encoded in the URI.
    expect(decodeURIComponent(uri)).toContain(XDR);
  });

  it('includes the pubkey parameter', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY, CORRELATION_ID);
    expect(uri).toContain(`pubkey=${PUBLIC_KEY}`);
  });

  it('includes the correlation ID in the encoded callback URL', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY, CORRELATION_ID);
    const query = uri.slice(uri.indexOf('?') + 1);
    const callback = new URLSearchParams(query).get('callback');

    expect(callback).toBe(`url:${LOBSTR_CALLBACK_URI}?id=${CORRELATION_ID}`);
  });

  it('includes the testnet network passphrase', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY, CORRELATION_ID);
    // URLSearchParams encodes spaces as '+'; decode both forms.
    const decoded = decodeURIComponent(uri).replace(/\+/g, ' ');
    expect(decoded).toContain('Test SDF Network');
  });

  it('uses the public network passphrase when configured for mainnet', () => {
    // Reload the modules with the runtime config switched to mainnet so the
    // shared passphrase constant is recomputed.
    jest.resetModules();
    jest.doMock('react-native-config', () => ({
      __esModule: true,
      default: { STELLAR_NETWORK: 'mainnet' },
    }));
    const { buildSep7TxUri: buildMainnet } =
      jest.requireActual('../services/lobstr');
    const uri = buildMainnet(XDR, PUBLIC_KEY, CORRELATION_ID);
    const decoded = decodeURIComponent(uri).replace(/\+/g, ' ');
    expect(decoded).toContain('Public Global Stellar Network ; September 2015');
    expect(decoded).not.toContain('Test SDF Network');
  });
});

// ---------------------------------------------------------------------------
// buildSep7PayUri
// ---------------------------------------------------------------------------

describe('buildSep7PayUri', () => {
  const DEST = 'GDESTINATIONPUBLICKEY';
  const AMOUNT = '10.5';

  it('starts with the web+stellar:pay prefix', () => {
    const uri = buildSep7PayUri(DEST, AMOUNT);
    expect(uri).toMatch(/^web\+stellar:pay\?/);
  });

  it('includes destination and amount', () => {
    const uri = buildSep7PayUri(DEST, AMOUNT);
    expect(uri).toContain(`destination=${DEST}`);
    expect(uri).toContain(`amount=${AMOUNT}`);
  });

  it('includes asset_code and asset_issuer for a custom asset', () => {
    const asset = { code: 'ECO', issuer: 'GISSUER123' };
    const uri = buildSep7PayUri(DEST, AMOUNT, asset);
    expect(uri).toContain('asset_code=ECO');
    expect(uri).toContain('asset_issuer=GISSUER123');
  });

  it('omits asset fields when no asset is provided', () => {
    const uri = buildSep7PayUri(DEST, AMOUNT);
    expect(uri).not.toContain('asset_code');
    expect(uri).not.toContain('asset_issuer');
  });

  it('includes memo and memo_type when a memo is provided', () => {
    const uri = buildSep7PayUri(DEST, AMOUNT, undefined, 'task-42');
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain('memo=task-42');
    expect(decoded).toContain('memo_type=MEMO_TEXT');
  });
});

// ---------------------------------------------------------------------------
// parseLobstrCallbackUrl
// ---------------------------------------------------------------------------

describe('parseLobstrCallbackUrl', () => {
  it('extracts the signed XDR and ID from a valid callback URL', () => {
    const signedXDR = 'SIGNEDXDR==';
    const id = 'signing-call-1';
    const url = `ecotask://lobstr/callback?xdr=${encodeURIComponent(
      signedXDR,
    )}&id=${id}`;
    expect(parseLobstrCallbackUrl(url)).toEqual({ xdr: signedXDR, id });
  });

  it('throws when the URL has no query string', () => {
    expect(() => parseLobstrCallbackUrl('ecotask://lobstr/callback')).toThrow(
      'missing query parameters',
    );
  });

  it('throws when the xdr parameter is absent', () => {
    expect(() =>
      parseLobstrCallbackUrl('ecotask://lobstr/callback?id=signing-call-1'),
    ).toThrow('missing the signed XDR');
  });

  it('throws when the correlation ID is absent', () => {
    expect(() =>
      parseLobstrCallbackUrl('ecotask://lobstr/callback?xdr=SIGNED_XDR'),
    ).toThrow('missing the correlation ID');
  });

  it('handles XDR values containing "+" characters', () => {
    const signedXDR = 'ABC+DEF==';
    const id = 'signing-call-2';
    const url = `ecotask://lobstr/callback?xdr=${encodeURIComponent(
      signedXDR,
    )}&id=${id}`;
    expect(parseLobstrCallbackUrl(url)).toEqual({ xdr: signedXDR, id });
  });
});

// ---------------------------------------------------------------------------
// LobstrNotInstalledError
// ---------------------------------------------------------------------------

describe('LobstrNotInstalledError', () => {
  it('is an Error subclass', () => {
    expect(new LobstrNotInstalledError()).toBeInstanceOf(Error);
  });

  it('has name "LobstrNotInstalledError"', () => {
    expect(new LobstrNotInstalledError().name).toBe('LobstrNotInstalledError');
  });

  it('message mentions installation', () => {
    expect(new LobstrNotInstalledError().message).toMatch(/install/i);
  });
});

// ---------------------------------------------------------------------------
// openLobstrForSigning — not installed
// ---------------------------------------------------------------------------

describe('openLobstrForSigning — Lobstr not installed', () => {
  it('throws LobstrNotInstalledError when canOpenURL returns false', async () => {
    mockCanOpenURL.mockResolvedValue(false);
    await expect(
      openLobstrForSigning('XDR==', 'GPUBLICKEY'),
    ).rejects.toBeInstanceOf(LobstrNotInstalledError);
  });

  it('does not call Linking.openURL when Lobstr is not installed', async () => {
    mockCanOpenURL.mockResolvedValue(false);
    await expect(
      openLobstrForSigning('XDR==', 'GPUBLICKEY'),
    ).rejects.toBeInstanceOf(LobstrNotInstalledError);
    expect(mockOpenURL).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// openLobstrForSigning — callback flow
// ---------------------------------------------------------------------------

describe('openLobstrForSigning — callback flow', () => {
  it('opens a web+stellar:tx URI', async () => {
    const signedXDR = 'SIGNED_XDR_VALUE==';
    const promise = openLobstrForSigning('ORIGINAL_XDR==', 'GPUBLICKEY');
    await flushLobstrOpen();
    const id = getCallbackId();

    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=${encodeURIComponent(signedXDR)}&id=${id}`,
    );

    await expect(promise).resolves.toBe(signedXDR);
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL.mock.calls[0][0]).toMatch(/^web\+stellar:tx\?/);
  });

  it('rejects when the callback URL is malformed', async () => {
    const promise = openLobstrForSigning('XDR==', 'GPUBLICKEY');
    await flushLobstrOpen();
    const id = getCallbackId();

    resolveLobstrCallback(`ecotask://lobstr/callback?id=${id}`);

    await expect(promise).rejects.toThrow('missing the signed XDR');
  });

  it('routes two concurrent callbacks to their matching promises', async () => {
    const firstPromise = openLobstrForSigning('FIRST_XDR==', 'GFIRST');
    const secondPromise = openLobstrForSigning('SECOND_XDR==', 'GSECOND');
    await flushLobstrOpen();

    const firstId = getCallbackId(0);
    const secondId = getCallbackId(1);
    expect(firstId).not.toBe(secondId);

    const firstSettled = jest.fn();
    firstPromise.then(firstSettled, firstSettled);

    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=${encodeURIComponent(
        'SIGNED_SECOND_XDR==',
      )}&id=${secondId}`,
    );
    await expect(secondPromise).resolves.toBe('SIGNED_SECOND_XDR==');
    expect(firstSettled).not.toHaveBeenCalled();

    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=${encodeURIComponent(
        'SIGNED_FIRST_XDR==',
      )}&id=${firstId}`,
    );
    await expect(firstPromise).resolves.toBe('SIGNED_FIRST_XDR==');
  });
});

// ---------------------------------------------------------------------------
// cancelLobstrCallback
// ---------------------------------------------------------------------------

describe('cancelLobstrCallback', () => {
  it('rejects all pending signing promises when called without an ID', async () => {
    const firstPromise = openLobstrForSigning('FIRST_XDR==', 'GFIRST');
    const secondPromise = openLobstrForSigning('SECOND_XDR==', 'GSECOND');

    cancelLobstrCallback();
    await expect(firstPromise).rejects.toThrow('cancelled');
    await expect(secondPromise).rejects.toThrow('cancelled');
  });

  it('rejects only the pending call matching the given ID', async () => {
    const firstPromise = openLobstrForSigning('FIRST_XDR==', 'GFIRST');
    const secondPromise = openLobstrForSigning('SECOND_XDR==', 'GSECOND');
    await flushLobstrOpen();
    const firstId = getCallbackId(0);
    const secondId = getCallbackId(1);
    const secondSettled = jest.fn();
    secondPromise.then(secondSettled, secondSettled);

    cancelLobstrCallback(firstId);

    await expect(firstPromise).rejects.toThrow('cancelled');
    expect(secondSettled).not.toHaveBeenCalled();

    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=SIGNED_SECOND_XDR&id=${secondId}`,
    );
    await expect(secondPromise).resolves.toBe('SIGNED_SECOND_XDR');
  });

  it('is a no-op when there is no pending promise', () => {
    expect(() => cancelLobstrCallback()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// openLobstrForSigning — timeout
// ---------------------------------------------------------------------------

describe('openLobstrForSigning — timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects with "Lobstr signing timed out" after the timeout elapses', async () => {
    const promise = openLobstrForSigning('XDR==', 'GPUBLICKEY');

    // No callback ever arrives (user dismissed Lobstr). Advance past the
    // configured timeout window.
    jest.advanceTimersByTime(LOBSTR_SIGNING_TIMEOUT_MS);

    await expect(promise).rejects.toThrow('Lobstr signing timed out');
  });

  it('does not reject before the timeout elapses', async () => {
    const promise = openLobstrForSigning('XDR==', 'GPUBLICKEY');

    jest.advanceTimersByTime(LOBSTR_SIGNING_TIMEOUT_MS - 1000);

    // The promise should still be pending; give microtasks a chance to run
    // and assert it has neither resolved nor rejected.
    const settled = jest.fn();
    promise.then(settled, settled);
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();

    cancelLobstrCallback();
    await expect(promise).rejects.toThrow('cancelled');
  });

  it('clears the timeout when the callback resolves successfully', async () => {
    const promise = openLobstrForSigning('ORIGINAL_XDR==', 'GPUBLICKEY');
    await flushLobstrOpen();
    const id = getCallbackId();

    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=${encodeURIComponent(
        'SIGNED_XDR==',
      )}&id=${id}`,
    );
    await expect(promise).resolves.toBe('SIGNED_XDR==');

    // Even after advancing fully past the timeout, no error surfaces.
    jest.advanceTimersByTime(LOBSTR_SIGNING_TIMEOUT_MS);
    await Promise.resolve();
  });

  it('times out and cleans up only the matching pending call', async () => {
    const firstPromise = openLobstrForSigning('FIRST_XDR==', 'GFIRST');
    await flushLobstrOpen();

    jest.advanceTimersByTime(LOBSTR_SIGNING_TIMEOUT_MS / 2);

    const secondPromise = openLobstrForSigning('SECOND_XDR==', 'GSECOND');
    await flushLobstrOpen();
    const secondId = getCallbackId(1);
    const secondSettled = jest.fn();
    secondPromise.then(secondSettled, secondSettled);

    jest.advanceTimersByTime(LOBSTR_SIGNING_TIMEOUT_MS / 2);

    await expect(firstPromise).rejects.toThrow('Lobstr signing timed out');
    expect(secondSettled).not.toHaveBeenCalled();

    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=SIGNED_SECOND_XDR&id=${secondId}`,
    );
    await expect(secondPromise).resolves.toBe('SIGNED_SECOND_XDR');
  });

  it('clears the timeout when cancelLobstrCallback is called', async () => {
    const promise = openLobstrForSigning('XDR==', 'GPUBLICKEY');

    cancelLobstrCallback();
    await expect(promise).rejects.toThrow('cancelled');

    // Advancing past the timeout must not cause a second, spurious rejection.
    jest.advanceTimersByTime(LOBSTR_SIGNING_TIMEOUT_MS);
    await Promise.resolve();
  });
});

// ---------------------------------------------------------------------------
// openLobstrForPayment
// ---------------------------------------------------------------------------

describe('openLobstrForPayment', () => {
  it('opens a web+stellar:pay URI', async () => {
    await openLobstrForPayment('GDEST', '5.0');
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL.mock.calls[0][0]).toMatch(/^web\+stellar:pay\?/);
  });

  it('throws LobstrNotInstalledError when Lobstr is not installed', async () => {
    mockCanOpenURL.mockResolvedValue(false);
    await expect(openLobstrForPayment('GDEST', '5.0')).rejects.toBeInstanceOf(
      LobstrNotInstalledError,
    );
  });

  it('includes asset fields for a custom asset', async () => {
    await openLobstrForPayment('GDEST', '5.0', {
      code: 'ECO',
      issuer: 'GISSUER',
    });
    const uri = mockOpenURL.mock.calls[0][0] as string;
    expect(uri).toContain('asset_code=ECO');
  });
});
