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
  pendingSigningIds,
  LobstrNotInstalledError,
  LOBSTR_CALLBACK_URI,
  ECOTASK_SCHEME,
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

// ---------------------------------------------------------------------------
// Concurrent signing requests / keyed callback registry (issue #130)
// ---------------------------------------------------------------------------

describe('concurrent signing requests (issue #130)', () => {
  const XDR = 'AAAAAQAAAA==';
  const KEY = 'GBILLBOARDPUBLICKEY';

  /**
   * Mark a promise as handled at creation so a later settleEntry can never
   * surface as an unhandled rejection between test statements.  Later
   * `await`/`rejects` assertions still observe the real outcome.
   */
  const tracked = <T>(p: Promise<T>): Promise<T> => {
    p.catch(() => {});
    return p;
  };

  afterEach(() => {
    // Drain anything a failed assertion may have left behind.  Entries
    // created via `tracked()` are already handled, so this is quiet.
    for (const id of pendingSigningIds()) {
      cancelLobstrCallback(id);
    }
    expect(pendingSigningIds()).toEqual([]);
  });

  it('embeds a correlation id in the callback URL when one is supplied', () => {
    const uri = buildSep7TxUri(XDR, KEY, { correlationId: 'auth-42' });
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain('ecotask://lobstr/callback?id=auth-42');
  });

  it('two concurrent requests each settle with their OWN signed XDR', async () => {
    const p1 = tracked(
      openLobstrForSigning('XDR-ONE', KEY, { correlationId: 'req-1' }),
    );
    const p2 = tracked(
      openLobstrForSigning('XDR-TWO', KEY, { correlationId: 'req-2' }),
    );

    // Callbacks arrive out of order, as deep links.
    resolveLobstrCallback('ecotask://lobstr/callback?id=req-2&xdr=SIGNED-TWO');
    resolveLobstrCallback('ecotask://lobstr/callback?id=req-1&xdr=SIGNED-ONE');

    await expect(p1).resolves.toBe('SIGNED-ONE');
    await expect(p2).resolves.toBe('SIGNED-TWO');
  });

  it('a second openLobstrForSigning no longer cancels the first', async () => {
    const p1 = tracked(
      openLobstrForSigning('XDR-ONE', KEY, { correlationId: 'req-1' }),
    );
    const p2 = tracked(
      openLobstrForSigning('XDR-TWO', KEY, { correlationId: 'req-2' }),
    );

    resolveLobstrCallback('ecotask://lobstr/callback?id=req-1&xdr=SIGNED-ONE');

    await expect(p1).resolves.toBe('SIGNED-ONE');
    // p2 still pending, unharmed.
    const remedy = p2.catch(e => e); // no unhandled-rejection leak
    expect(pendingSigningIds()).toContain('req-2');
    cancelLobstrCallback('req-2');
    expect(await remedy).toBeInstanceOf(Error);
  });

  it('legacy id-less callback routes to the sole pending request', async () => {
    const p = tracked(
      openLobstrForSigning('XDR', KEY, { correlationId: 'only-1' }),
    );
    resolveLobstrCallback('ecotask://lobstr/callback?xdr=SIGNED-LEGACY');
    await expect(p).resolves.toBe('SIGNED-LEGACY');
  });

  it('legacy id-less callback with MULTIPLE pending requests is ignored', async () => {
    const p1 = tracked(
      openLobstrForSigning('XDR-ONE', KEY, { correlationId: 'm-1' }),
    );
    const p2 = tracked(
      openLobstrForSigning('XDR-TWO', KEY, { correlationId: 'm-2' }),
    );
    resolveLobstrCallback('ecotask://lobstr/callback?xdr=SIGNED-UNKNOWN');
    // Neither settled with the wrong XDR; both stay pending.
    expect(pendingSigningIds().sort()).toEqual(['m-1', 'm-2']);
    cancelLobstrCallback('m-1');
    cancelLobstrCallback('m-2');
    expect(await p1.catch(e => e.message)).toBe('Lobstr signing was cancelled');
    expect(await p2.catch(e => e.message)).toBe('Lobstr signing was cancelled');
  });

  it('malformed callback URL rejects every pending request', async () => {
    const p1 = tracked(
      openLobstrForSigning('XDR-ONE', KEY, { correlationId: 'bad-1' }),
    );
    const p2 = tracked(
      openLobstrForSigning('XDR-TWO', KEY, { correlationId: 'bad-2' }),
    );
    resolveLobstrCallback('ecotask://lobstr/callback'); // no query at all
    await expect(p1).rejects.toThrow('missing query parameters');
    await expect(p2).rejects.toThrow('missing query parameters');
  });

  it('timeoutMs rejects only the timed-out request', async () => {
    jest.useFakeTimers();
    const p1 = tracked(
      openLobstrForSigning('XDR-ONE', KEY, {
        correlationId: 't-1',
        timeoutMs: 1000,
      }),
    );
    const p2 = tracked(
      openLobstrForSigning('XDR-TWO', KEY, { correlationId: 't-2' }),
    );
    jest.advanceTimersByTime(1500);
    await expect(p1).rejects.toThrow('timed out after 1000ms');
    expect(pendingSigningIds()).toEqual(['t-2']);
    resolveLobstrCallback('ecotask://lobstr/callback?id=t-2&xdr=SIGNED-TWO');
    await expect(p2).resolves.toBe('SIGNED-TWO');
    jest.useRealTimers();
  });

  it('callback for an unknown/already-settled id is a no-op', async () => {
    const p = tracked(
      openLobstrForSigning('XDR', KEY, { correlationId: 'u-1' }),
    );
    resolveLobstrCallback('ecotask://lobstr/callback?id=ghost&xdr=SIGNED-NOPE');
    expect(pendingSigningIds()).toEqual(['u-1']); // untouched
    resolveLobstrCallback('ecotask://lobstr/callback?id=u-1&xdr=SIGNED-REAL');
    resolveLobstrCallback('ecotask://lobstr/callback?id=u-1&xdr=SIGNED-DOUBLE');
    await expect(p).resolves.toBe('SIGNED-REAL'); // settled exactly once
  });
});
