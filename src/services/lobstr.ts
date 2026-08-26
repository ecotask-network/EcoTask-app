/**
 * Lobstr SEP-7 deep link integration.
 *
 * SEP-7 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 *
 * Auth flow (tx URI type):
 *   1. Build a `web+stellar:tx?xdr=<XDR>&callback=<callbackURI>&pubkey=<pubkey>`
 *      URI and open it — Lobstr takes the user through a signing UI.
 *   2. Lobstr redirects to `ecotask://lobstr/callback?xdr=<signedXDR>`
 *      (when the `callback` param is a `url:ecotask://…` value).
 *   3. RootNavigator receives the deep link; the pending promise is resolved
 *      with the signed XDR so the caller can continue.
 *
 * Payment flow (pay URI type):
 *   A `web+stellar:pay?destination=…&amount=…&asset_code=…&…` URI is opened.
 *   Lobstr submits the transaction itself; no callback XDR is expected.
 */

import { Linking } from 'react-native';

/** The URI scheme this app registers (see AndroidManifest / Info.plist). */
export const ECOTASK_SCHEME = 'ecotask';

/** Path component Lobstr redirects to after signing. */
export const LOBSTR_CALLBACK_PATH = '/lobstr/callback';

/** Full deep-link base for auth callbacks. */
export const LOBSTR_CALLBACK_URI = `${ECOTASK_SCHEME}://${LOBSTR_CALLBACK_PATH.slice(1)}`;

// ---------------------------------------------------------------------------
// Pending callback registry (issue #130)
// ---------------------------------------------------------------------------

type CallbackResolve = (signedXDR: string) => void;
type CallbackReject = (reason: Error) => void;

interface PendingEntry {
  resolve: CallbackResolve;
  reject: CallbackReject;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Keyed registry of in-flight signing requests.  A module-level singleton
 * pair (the previous design) let a second `openLobstrForSigning` call
 * silently clobber the first: the first caller never settled and, when the
 * callback eventually arrived, could be resolved with someone else's XDR.
 * Each call now gets a unique correlation id that is embedded in the SEP-7
 * callback URL and echoed back by Lobstr, so callbacks route to the right
 * caller even when auth + wallet-connect + payment sign concurrently.
 */
const _pending = new Map<string, PendingEntry>();

let _correlationCounter = 0;

function makeCorrelationId(): string {
  _correlationCounter += 1;
  return `lobstr-${Date.now().toString(36)}-${_correlationCounter}`;
}

/** IDs of currently pending signing requests (observability / tests). */
export function pendingSigningIds(): string[] {
  return [..._pending.keys()];
}

function settleEntry(
  id: string,
  outcome: 'resolve' | 'reject',
  value?: unknown,
): void {
  const entry = _pending.get(id);
  if (!entry) {
    return;
  }
  _pending.delete(id);
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  if (outcome === 'resolve') {
    entry.resolve(value as string);
  } else {
    entry.reject(
      value instanceof Error ? value : new Error(String(value ?? 'cancelled')),
    );
  }
}

function extractCallbackQuery(url: string): URLSearchParams {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    throw new Error('Lobstr callback URL is missing query parameters');
  }
  return new URLSearchParams(url.slice(queryIndex + 1));
}

/**
 * Called by RootNavigator when an incoming deep link matches the Lobstr
 * callback path.  Routes the signed XDR to the pending request identified
 * by the `id` correlation parameter embedded in the callback URL.
 *
 * Backward compatibility: a callback with no `id` (e.g. an in-flight link
 * created before this registry existed) is routed to the sole pending
 * request when exactly one exists; with several pending requests an
 * id-less callback cannot be attributed and is ignored — each request
 * still has its own timeout.  A malformed URL rejects every pending
 * request rather than leaving any of them hanging.
 */
export function resolveLobstrCallback(url: string): void {
  let params: URLSearchParams;
  try {
    params = extractCallbackQuery(url);
  } catch (err) {
    for (const id of [..._pending.keys()]) {
      settleEntry(
        id,
        'reject',
        err instanceof Error ? err : new Error(String(err)),
      );
    }
    return;
  }

  const signedXDR = params.get('xdr');
  const id = params.get('id');

  if (id != null) {
    const entry = _pending.get(id);
    if (!entry) {
      return; // unknown or already-settled correlation id: nothing to do
    }
    if (!signedXDR) {
      settleEntry(
        id,
        'reject',
        new Error('Lobstr callback URL is missing the signed XDR'),
      );
      return;
    }
    settleEntry(id, 'resolve', signedXDR);
    return;
  }

  // Legacy id-less callback.
  if (_pending.size === 1) {
    const [soleId] = [..._pending.keys()];
    if (soleId === undefined) {
      return; // unreachable given size === 1; satisfies the type checker
    }
    if (!signedXDR) {
      settleEntry(
        soleId,
        'reject',
        new Error('Lobstr callback URL is missing the signed XDR'),
      );
      return;
    }
    settleEntry(soleId, 'resolve', signedXDR);
  }
  // size 0 → nothing pending; size > 1 → ambiguous, intentionally ignored.
}

/**
 * Cancel pending Lobstr signing promise(s) (e.g., user navigated away).
 * With an id, cancels exactly that request; without, cancels all.
 */
export function cancelLobstrCallback(id?: string): void {
  const ids = id != null ? [id] : [..._pending.keys()];
  for (const entryId of ids) {
    settleEntry(entryId, 'reject', new Error('Lobstr signing was cancelled'));
  }
}

// ---------------------------------------------------------------------------
// URI construction
// ---------------------------------------------------------------------------

/**
 * Build a SEP-7 `tx` URI for transaction signing.
 *
 * @param xdr      Base64-encoded unsigned transaction XDR.
 * @param publicKey Sender public key (populates `pubkey` field).
 * @returns        A `web+stellar:tx?…` URI string.
 */
export function buildSep7TxUri(
  xdr: string,
  publicKey: string,
  options?: { correlationId?: string },
): string {
  // The correlation id rides as an extra query param on the callback URL;
  // Lobstr echoes the whole callback back unchanged, so the returning deep
  // link carries the id that identifies which request is being settled.
  const id = options?.correlationId ?? '';
  const callbackBase = id
    ? `${LOBSTR_CALLBACK_URI}?id=${encodeURIComponent(id)}`
    : LOBSTR_CALLBACK_URI;
  const params = new URLSearchParams({
    xdr,
    pubkey: publicKey,
    // `url:` prefix tells Lobstr the callback is a URL deep link.
    callback: `url:${callbackBase}`,
    network_passphrase: 'Test SDF Network ; September 2015',
  });
  return `web+stellar:tx?${params.toString()}`;
}

/**
 * Build a SEP-7 `pay` URI for a simple payment.
 *
 * @param destination Recipient Stellar public key.
 * @param amount      Amount as a string (e.g. "10.5").
 * @param asset       Optional custom asset; omit for XLM.
 * @param memo        Optional text memo.
 * @returns           A `web+stellar:pay?…` URI string.
 */
export function buildSep7PayUri(
  destination: string,
  amount: string,
  asset?: { code: string; issuer: string },
  memo?: string,
): string {
  const params = new URLSearchParams({ destination, amount });
  if (asset) {
    params.set('asset_code', asset.code);
    params.set('asset_issuer', asset.issuer);
  }
  if (memo) {
    params.set('memo', memo);
    params.set('memo_type', 'MEMO_TEXT');
  }
  return `web+stellar:pay?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Callback parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Lobstr deep-link callback URL and extract the signed XDR.
 *
 * Expected format:
 *   `ecotask://lobstr/callback?xdr=<signedXDR>`
 *
 * @throws Error when the URL is malformed or the `xdr` param is absent.
 */
export function parseLobstrCallbackUrl(url: string): string {
  // URLSearchParams requires a query string; extract it manually to avoid
  // cross-platform URL parsing quirks in React Native's JS engine.
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    throw new Error('Lobstr callback URL is missing query parameters');
  }
  const query = url.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  const xdr = params.get('xdr');
  if (!xdr) {
    throw new Error('Lobstr callback URL is missing the signed XDR');
  }
  return xdr;
}

// ---------------------------------------------------------------------------
// Deep-link launchers
// ---------------------------------------------------------------------------

const LOBSTR_SCHEME = 'lobstr://';

/**
 * Check whether Lobstr is installed on the device.
 */
export async function isLobstrInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL(LOBSTR_SCHEME);
  } catch {
    return false;
  }
}

/**
 * Open Lobstr for transaction signing and return a promise that resolves
 * with the signed XDR when Lobstr redirects back to the app.
 *
 * Throws `LobstrNotInstalledError` when Lobstr is not available.
 *
 * @param xdr       Unsigned transaction XDR.
 * @param publicKey Sender public key.
 */
export interface OpenLobstrForSigningOptions {
  /** Explicit correlation id (defaults to a generated one). */
  correlationId?: string;
  /**
   * Reject the request automatically after this many milliseconds if no
   * callback arrives.  Recommended wherever the caller cannot guarantee
   * a one-in-flight-at-a-time flow.
   */
  timeoutMs?: number;
}

export function openLobstrForSigning(
  xdr: string,
  publicKey: string,
  options?: OpenLobstrForSigningOptions,
): Promise<string> {
  const id = options?.correlationId ?? makeCorrelationId();

  return new Promise<string>((resolve, reject) => {
    // Register synchronously: a callback for this id must find its entry
    // even if it arrives one microtask after this call.  Pre-existing
    // requests are NOT cancelled — each request owns its lifecycle.
    const entry: PendingEntry = { resolve, reject };
    if (options?.timeoutMs != null && options.timeoutMs > 0) {
      entry.timer = setTimeout(() => {
        settleEntry(
          id,
          'reject',
          new Error(`Lobstr signing timed out after ${options.timeoutMs}ms`),
        );
      }, options.timeoutMs);
    }
    _pending.set(id, entry);

    // Kick off async work; on failure, reject only THIS entry.
    isLobstrInstalled()
      .then(installed => {
        if (!installed) {
          throw new LobstrNotInstalledError();
        }
        return Linking.openURL(
          buildSep7TxUri(xdr, publicKey, { correlationId: id }),
        );
      })
      .catch(err => {
        settleEntry(
          id,
          'reject',
          err instanceof LobstrNotInstalledError
            ? err
            : new Error(
                `Could not open Lobstr for signing: ${err?.message ?? err}`,
              ),
        );
      });
  });
}

/**
 * Open Lobstr for a simple payment (pay URI).  Lobstr handles submission;
 * this function resolves when the URI is opened, not when the tx is confirmed.
 *
 * Throws `LobstrNotInstalledError` when Lobstr is not available.
 */
export async function openLobstrForPayment(
  destination: string,
  amount: string,
  asset?: { code: string; issuer: string },
): Promise<void> {
  const installed = await isLobstrInstalled();
  if (!installed) {
    throw new LobstrNotInstalledError();
  }
  const uri = buildSep7PayUri(destination, amount, asset);
  await Linking.openURL(uri);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when Lobstr is not installed on the device. */
export class LobstrNotInstalledError extends Error {
  constructor() {
    super(
      'Lobstr is not installed. Please install it from the Play Store or App Store.',
    );
    this.name = 'LobstrNotInstalledError';
  }
}
