/**
 * Tests for the Lobstr SEP-7 deep-link service.
 *
 * Covers:
 *  - SEP-7 `tx` URI construction
 *  - SEP-7 `pay` URI construction
 *  - Callback URL parsing
 *  - `LobstrNotInstalledError` when Linking.canOpenURL returns false
 *  - `openLobstrForSigning` resolves when resolveLobstrCallback is called
 *  - `cancelLobstrCallback` rejects the pending promise
 */

// Mock react-native's Linking module before any imports.
jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
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

  it('starts with the web+stellar:tx prefix', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY);
    expect(uri).toMatch(/^web\+stellar:tx\?/);
  });

  it('includes the encoded xdr parameter', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY);
    expect(uri).toContain('xdr=');
    // The raw XDR value must appear URL-encoded in the URI.
    expect(decodeURIComponent(uri)).toContain(XDR);
  });

  it('includes the pubkey parameter', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY);
    expect(uri).toContain(`pubkey=${PUBLIC_KEY}`);
  });

  it('includes a callback parameter pointing at the ecotask scheme', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY);
    // callback value is URL-encoded; decode to inspect
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain('ecotask://');
  });

  it('includes the testnet network passphrase', () => {
    const uri = buildSep7TxUri(XDR, PUBLIC_KEY);
    // URLSearchParams encodes spaces as '+'; decode both forms.
    const decoded = decodeURIComponent(uri).replace(/\+/g, ' ');
    expect(decoded).toContain('Test SDF Network');
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
  it('extracts the signed XDR from a valid callback URL', () => {
    const signedXDR = 'SIGNEDXDR==';
    const url = `ecotask://lobstr/callback?xdr=${encodeURIComponent(signedXDR)}`;
    expect(parseLobstrCallbackUrl(url)).toBe(signedXDR);
  });

  it('throws when the URL has no query string', () => {
    expect(() => parseLobstrCallbackUrl('ecotask://lobstr/callback')).toThrow(
      'missing query parameters',
    );
  });

  it('throws when the xdr parameter is absent', () => {
    expect(() =>
      parseLobstrCallbackUrl('ecotask://lobstr/callback?other=value'),
    ).toThrow('missing the signed XDR');
  });

  it('handles XDR values containing "+" characters', () => {
    const signedXDR = 'ABC+DEF==';
    const url = `ecotask://lobstr/callback?xdr=${encodeURIComponent(signedXDR)}`;
    expect(parseLobstrCallbackUrl(url)).toBe(signedXDR);
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

    // _pendingResolve is set synchronously in the Promise constructor, so
    // resolveLobstrCallback can be called immediately without any flush.
    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=${encodeURIComponent(signedXDR)}`,
    );

    await expect(promise).resolves.toBe(signedXDR);
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL.mock.calls[0][0]).toMatch(/^web\+stellar:tx\?/);
  });

  it('rejects when the callback URL is malformed', async () => {
    const promise = openLobstrForSigning('XDR==', 'GPUBLICKEY');

    resolveLobstrCallback('ecotask://lobstr/callback'); // no xdr param

    await expect(promise).rejects.toThrow('missing query parameters');
  });
});

// ---------------------------------------------------------------------------
// cancelLobstrCallback
// ---------------------------------------------------------------------------

describe('cancelLobstrCallback', () => {
  it('rejects the pending signing promise', async () => {
    const promise = openLobstrForSigning('XDR==', 'GPUBLICKEY');

    // _pendingReject is set synchronously, no flush needed.
    cancelLobstrCallback();
    await expect(promise).rejects.toThrow('cancelled');
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
  });

  it('clears the timeout when the callback resolves successfully', async () => {
    const promise = openLobstrForSigning('ORIGINAL_XDR==', 'GPUBLICKEY');

    resolveLobstrCallback(
      `ecotask://lobstr/callback?xdr=${encodeURIComponent('SIGNED_XDR==')}`,
    );
    await expect(promise).resolves.toBe('SIGNED_XDR==');

    // Even after advancing fully past the timeout, no error surfaces.
    jest.advanceTimersByTime(LOBSTR_SIGNING_TIMEOUT_MS);
    await Promise.resolve();
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
