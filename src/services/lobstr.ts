/**
 * Lobstr SEP-7 deep link integration.
 *
 * SEP-7 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 *
 * Auth flow (tx URI type):
 *   1. Build a `web+stellar:tx?xdr=<XDR>&callback=<callbackURI>&pubkey=<pubkey>`
 *      URI and open it — Lobstr takes the user through a signing UI.
 *   2. Lobstr redirects to
 *      `ecotask://lobstr/callback?xdr=<signedXDR>&id=<correlationId>`
 *      (when the `callback` param is a `url:ecotask://…` value).
 *   3. RootNavigator receives the deep link; the pending promise is resolved
 *      with the signed XDR so the caller can continue.
 *
 * Payment flow (pay URI type):
 *   A `web+stellar:pay?destination=…&amount=…&asset_code=…&…` URI is opened.
 *   Lobstr submits the transaction itself; no callback XDR is expected.
 */

import { Linking } from 'react-native';
import { STELLAR_NETWORK_PASSPHRASE } from './stellar';

/** The URI scheme this app registers (see AndroidManifest / Info.plist). */
export const ECOTASK_SCHEME = 'ecotask';

/** Path component Lobstr redirects to after signing. */
export const LOBSTR_CALLBACK_PATH = '/lobstr/callback';

/** Full deep-link base for auth callbacks. */
export const LOBSTR_CALLBACK_URI = `${ECOTASK_SCHEME}://${LOBSTR_CALLBACK_PATH.slice(1)}`;

/**
 * Maximum time we wait for the user to complete signing in Lobstr before the
 * pending promise is rejected. Covers the case where the user dismisses Lobstr
 * (presses Back, declines to sign, switches apps) with no callback ever firing.
 */
export const LOBSTR_SIGNING_TIMEOUT_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pending callback management
// ---------------------------------------------------------------------------

type CallbackResolve = (signedXDR: string) => void;
type CallbackReject = (reason: Error) => void;

interface PendingCall {
  resolve: CallbackResolve;
  reject: CallbackReject;
  timer: ReturnType<typeof setTimeout>;
}

const pendingCalls = new Map<string, PendingCall>();
let nextCorrelationId = 0;

/**
 * Generate an ID that is unique for every signing call in this module
 * instance. The sequence suffix also keeps calls unique when they start in
 * the same millisecond.
 */
function createCorrelationId(): string {
  nextCorrelationId += 1;
  return `${Date.now().toString(36)}-${nextCorrelationId.toString(36)}`;
}

/** Remove one pending call and clear only its timeout. */
function takePendingCall(id: string): PendingCall | undefined {
  const pending = pendingCalls.get(id);
  if (pending) {
    pendingCalls.delete(id);
    clearTimeout(pending.timer);
  }
  return pending;
}

function getCallbackParams(url: string): URLSearchParams {
  // URLSearchParams requires a query string; extract it manually to avoid
  // cross-platform URL parsing quirks in React Native's JS engine.
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    throw new Error('Lobstr callback URL is missing query parameters');
  }
  return new URLSearchParams(url.slice(queryIndex + 1));
}

/**
 * Called by RootNavigator when an incoming deep link matches the Lobstr
 * callback path.  Resolves or rejects the promise that was created in
 * `openLobstrForSigning`.
 */
export function resolveLobstrCallback(url: string): void {
  let id: string | null = null;
  try {
    id = getCallbackParams(url).get('id');
  } catch {
    // Without an ID, the callback cannot safely be associated with a call.
  }

  if (!id || !pendingCalls.has(id)) {
    return;
  }

  try {
    const callback = parseLobstrCallbackUrl(url);
    takePendingCall(callback.id)?.resolve(callback.xdr);
  } catch (err) {
    takePendingCall(id)?.reject(
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

/**
 * Cancel one pending Lobstr signing promise, or all calls when no ID is given.
 */
export function cancelLobstrCallback(id?: string): void {
  const cancellationError = new Error('Lobstr signing was cancelled');

  if (id !== undefined) {
    takePendingCall(id)?.reject(cancellationError);
    return;
  }

  const calls = Array.from(pendingCalls.values());
  pendingCalls.clear();
  calls.forEach(call => {
    clearTimeout(call.timer);
    call.reject(cancellationError);
  });
}

// ---------------------------------------------------------------------------
// URI construction
// ---------------------------------------------------------------------------

/**
 * Build a SEP-7 `tx` URI for transaction signing.
 *
 * @param xdr           Base64-encoded unsigned transaction XDR.
 * @param publicKey     Sender public key (populates `pubkey` field).
 * @param correlationId ID used to route the signed-XDR callback.
 * @returns             A `web+stellar:tx?…` URI string.
 */
export function buildSep7TxUri(
  xdr: string,
  publicKey: string,
  correlationId: string,
): string {
  const callbackParams = new URLSearchParams({ id: correlationId });
  const callbackUrl = `${LOBSTR_CALLBACK_URI}?${callbackParams.toString()}`;
  const params = new URLSearchParams({
    xdr,
    pubkey: publicKey,
    // `url:` prefix tells Lobstr the callback is a URL deep link.
    callback: `url:${callbackUrl}`,
    network_passphrase: STELLAR_NETWORK_PASSPHRASE,
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
 * Parse a Lobstr deep-link callback URL and extract its signed XDR and
 * correlation ID.
 *
 * Expected format:
 *   `ecotask://lobstr/callback?xdr=<signedXDR>&id=<correlationId>`
 *
 * @throws Error when the URL is malformed or a required param is absent.
 */
export function parseLobstrCallbackUrl(url: string): {
  xdr: string;
  id: string;
} {
  const params = getCallbackParams(url);
  const xdr = params.get('xdr');
  if (!xdr) {
    throw new Error('Lobstr callback URL is missing the signed XDR');
  }
  const id = params.get('id');
  if (!id) {
    throw new Error('Lobstr callback URL is missing the correlation ID');
  }
  return { xdr, id };
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
  const correlationId = createCorrelationId();

  // Register the pending call synchronously so that any call to
  // resolveLobstrCallback() or cancelLobstrCallback() — even one microtask
  // after this function is called — will find it populated.
  return new Promise<string>((resolve, reject) => {
    // Reject if the user never signs (e.g. they dismiss Lobstr). Without
    // this the promise hangs forever and the caller is stuck loading.
    const timer = setTimeout(() => {
      takePendingCall(correlationId)?.reject(
        new Error('Lobstr signing timed out'),
      );
    }, LOBSTR_SIGNING_TIMEOUT_MS);
    pendingCalls.set(correlationId, { resolve, reject, timer });

    // Kick off async work; on any failure, reject through the registered slot.
    isLobstrInstalled()
      .then(installed => {
        if (!installed) {
          throw new LobstrNotInstalledError();
        }
        return Linking.openURL(buildSep7TxUri(xdr, publicKey, correlationId));
      })
      .catch(err => {
        // Only reject if this call hasn't been consumed by a callback already.
        const failed = takePendingCall(correlationId);
        if (failed) {
          failed.reject(
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
