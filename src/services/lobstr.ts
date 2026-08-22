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
// Pending callback management
// ---------------------------------------------------------------------------

type CallbackResolve = (signedXDR: string) => void;
type CallbackReject = (reason: Error) => void;

let _pendingResolve: CallbackResolve | null = null;
let _pendingReject: CallbackReject | null = null;

/**
 * Called by RootNavigator when an incoming deep link matches the Lobstr
 * callback path.  Resolves or rejects the promise that was created in
 * `openLobstrForSigning`.
 */
export function resolveLobstrCallback(url: string): void {
  if (!_pendingResolve || !_pendingReject) {
    return;
  }
  try {
    const signedXDR = parseLobstrCallbackUrl(url);
    _pendingResolve(signedXDR);
  } catch (err) {
    _pendingReject(err instanceof Error ? err : new Error(String(err)));
  } finally {
    _pendingResolve = null;
    _pendingReject = null;
  }
}

/**
 * Cancel any pending Lobstr signing promise (e.g., user navigated away).
 */
export function cancelLobstrCallback(): void {
  if (_pendingReject) {
    _pendingReject(new Error('Lobstr signing was cancelled'));
    _pendingResolve = null;
    _pendingReject = null;
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
export function buildSep7TxUri(xdr: string, publicKey: string): string {
  const params = new URLSearchParams({
    xdr,
    pubkey: publicKey,
    // `url:` prefix tells Lobstr the callback is a URL deep link.
    callback: `url:${LOBSTR_CALLBACK_URI}`,
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
export function openLobstrForSigning(
  xdr: string,
  publicKey: string,
): Promise<string> {
  // Cancel any previous pending callback before registering a new one.
  cancelLobstrCallback();

  // Register the resolve/reject slots synchronously so that any call to
  // resolveLobstrCallback() or cancelLobstrCallback() — even one microtask
  // after this function is called — will find them populated.
  return new Promise<string>((resolve, reject) => {
    _pendingResolve = resolve;
    _pendingReject = reject;

    // Kick off async work; on any failure, reject through the registered slot.
    isLobstrInstalled()
      .then(installed => {
        if (!installed) {
          throw new LobstrNotInstalledError();
        }
        return Linking.openURL(buildSep7TxUri(xdr, publicKey));
      })
      .catch(err => {
        // Only reject if the slot hasn't been consumed by a callback already.
        if (_pendingReject) {
          _pendingResolve = null;
          _pendingReject = null;
          reject(
            err instanceof LobstrNotInstalledError
              ? err
              : new Error(
                  `Could not open Lobstr for signing: ${err?.message ?? err}`,
                ),
          );
        }
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
