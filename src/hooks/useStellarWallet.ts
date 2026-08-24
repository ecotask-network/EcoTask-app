import { useState, useEffect, useCallback } from 'react';
import Config from 'react-native-config';
import { useWalletStore } from '../store/walletStore';
import * as stellar from '../services/stellar';
import { saveInAppSecret, clearInAppSecret } from '../services/walletVault';
import {
  isLobstrInstalled,
  openLobstrForSigning,
  LobstrNotInstalledError,
} from '../services/lobstr';

interface FreighterWindow {
  freighter?: {
    isConnected: () => Promise<boolean>;
    getPublicKey: () => Promise<string>;
    signTransaction: (xdr: string) => Promise<string>;
  };
}

// React Native has no DOM `window`; Freighter (browser extension) only
// exists when this code happens to run in a web context.
declare const window: FreighterWindow;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useStellarWallet() {
  const {
    connect,
    beginConnect,
    connectFailed,
    disconnect,
    setBalance,
    setEcoBalance,
    setUsdcBalance,
    publicKey,
    isConnected,
    walletType,
  } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Strict balance fetchers (reject on network failure) used by the connect
   * flow. The `refresh*` functions below deliberately swallow errors
   * because their call sites fire-and-forget (`void refresh…()`).
   */
  const fetchEcoBalanceStrict = useCallback(async (key: string) => {
    const ecoCode = Config.ECO_TOKEN_ASSET_CODE;
    const ecoIssuer = Config.ECO_TOKEN_ISSUER;
    if (!ecoCode || !ecoIssuer) {
      return null;
    }
    return stellar.getTokenBalance(key, ecoCode, ecoIssuer);
  }, []);

  const fetchUsdcBalanceStrict = useCallback(async (key: string) => {
    const usdcIssuer = Config.USDC_ISSUER;
    if (!usdcIssuer) {
      return null;
    }
    return stellar.getTokenBalance(key, 'USDC', usdcIssuer);
  }, []);

  const refreshEcoBalance = useCallback(
    async (pk?: string) => {
      const key = pk || publicKey;
      const ecoCode = Config.ECO_TOKEN_ASSET_CODE;
      const ecoIssuer = Config.ECO_TOKEN_ISSUER;
      if (key && ecoCode && ecoIssuer) {
        try {
          const ecoBalance = await stellar.getTokenBalance(
            key,
            ecoCode,
            ecoIssuer,
          );
          setEcoBalance(ecoBalance);
        } catch (err) {
          // A failed background refresh keeps the last known balance; it
          // must not produce an unhandled rejection.
          setError(toErrorMessage(err, 'Could not refresh ECO balance'));
        }
      }
    },
    [publicKey, setEcoBalance],
  );

  const refreshUsdcBalance = useCallback(
    async (pk?: string) => {
      const key = pk || publicKey;
      const usdcIssuer = Config.USDC_ISSUER;
      if (key && usdcIssuer) {
        try {
          const usdcBalance = await stellar.getTokenBalance(
            key,
            'USDC',
            usdcIssuer,
          );
          setUsdcBalance(usdcBalance);
        } catch (err) {
          setError(toErrorMessage(err, 'Could not refresh USDC balance'));
        }
      }
    },
    [publicKey, setUsdcBalance],
  );

  /**
   * Shared tail of every connect path (Freighter, Lobstr, in-app).
   *
   * Balance verification happens BEFORE the wallet is marked connected:
   * if Horizon cannot be reached, the store is rolled back to a clean
   * disconnected state (with `connectError` recorded) and the error is
   * rethrown so the calling path can surface it. The user stays on
   * onboarding and sees a meaningful message instead of landing in the
   * main app with a null/zero balance.
   */
  const connectAccount = useCallback(
    async (
      key: string,
      secretKey?: string,
      type: 'freighter' | 'inapp' | 'lobstr' = 'inapp',
    ) => {
      beginConnect();
      try {
        const balance = await stellar.getBalance(key);
        const ecoBalance = await fetchEcoBalanceStrict(key);
        const usdcBalance = await fetchUsdcBalanceStrict(key);

        // Only persist the secret once the account has been verified,
        // so a failed connect never leaves an orphaned secret in the vault.
        if (secretKey) {
          saveInAppSecret(key, secretKey);
        }

        // Connected state and verified balances land in the store
        // atomically — the app can never observe isConnected with an
        // unknown balance.
        connect(key, type, { balance, ecoBalance, usdcBalance });
      } catch (err) {
        const message = toErrorMessage(
          err,
          'Could not verify the wallet on Stellar',
        );
        // Roll back: no half-connected state survives a failed attempt.
        connectFailed(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [
      connect,
      beginConnect,
      connectFailed,
      fetchEcoBalanceStrict,
      fetchUsdcBalanceStrict,
    ],
  );

  const connectFreighter = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // `typeof window` is safe to reference even where no global `window`
      // is declared (native platforms); a direct `window` reference is not.
      const freighter =
        typeof window !== 'undefined' ? window.freighter : undefined;
      if (!freighter) {
        throw new Error('Freighter extension not detected');
      }
      const connected = await freighter.isConnected();
      if (!connected) {
        throw new Error('Please unlock Freighter first');
      }
      const key = await freighter.getPublicKey();
      await connectAccount(key, undefined, 'freighter');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect');
    } finally {
      setIsConnecting(false);
    }
  }, [connectAccount]);

  /**
   * Connect via Lobstr.
   *
   * Flow:
   *  1. Check Lobstr is installed; surface a clear error if not.
   *  2. Build a minimal SEP-7 `tx` auth challenge signed by a local ephemeral
   *     keypair.  The challenge is opened in Lobstr, which re-signs it with
   *     the user's real keypair and redirects back with the signed XDR.
   *  3. Parse the returned signed XDR to extract the user's public key from
   *     the transaction source field, then complete the connection.
   *     No secret key is ever persisted for a Lobstr wallet.
   */
  const connectLobstr = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const installed = await isLobstrInstalled();
      if (!installed) {
        throw new LobstrNotInstalledError();
      }

      const {
        Keypair,
        Networks,
        TransactionBuilder,
        Account,
        Operation,
        BASE_FEE,
      } = stellar;

      const NETWORK =
        Config.STELLAR_NETWORK === 'testnet'
          ? Networks.TESTNET
          : Networks.PUBLIC;

      // Generate an ephemeral keypair locally — no network call required.
      const ephemeral = Keypair.random();
      const challengeAccount = new Account(ephemeral.publicKey(), '0');

      const tx = new TransactionBuilder(challengeAccount, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK,
      })
        .addOperation(
          Operation.manageData({
            name: 'ecotask auth',
            value: Buffer.from(ephemeral.publicKey()),
          }),
        )
        .setTimeout(60)
        .build();

      // Opens Lobstr; suspends until the deep-link callback resolves.
      const signedXDR = await openLobstrForSigning(
        tx.toXDR(),
        ephemeral.publicKey(),
      );

      // Extract the user's real public key from the signed transaction source.
      const parsed = TransactionBuilder.fromXDR(signedXDR, NETWORK);
      const lobstrPublicKey =
        'source' in parsed ? parsed.source : parsed.feeSource;

      await connectAccount(lobstrPublicKey, undefined, 'lobstr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect');
    } finally {
      setIsConnecting(false);
    }
  }, [connectAccount]);

  const createInAppWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { publicKey: key, secretKey } =
        await stellar.createTestnetAccount();
      await connectAccount(key, secretKey, 'inapp');
      return { publicKey: key, secretKey };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [connectAccount]);

  const importWallet = useCallback(
    async (secretKey: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        const trimmed = secretKey.trim();
        if (!stellar.isValidSecretKey(trimmed)) {
          throw new Error('Invalid secret key');
        }
        const key = stellar.getPublicKeyFromSecret(trimmed);
        await connectAccount(key, trimmed, 'inapp');
        return { publicKey: key };
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not import wallet',
        );
        return undefined;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectAccount],
  );

  const disconnectWallet = useCallback(() => {
    if (publicKey) {
      clearInAppSecret(publicKey);
    }
    disconnect();
  }, [publicKey, disconnect]);

  /**
   * Refresh the native XLM balance.
   *
   * Resolves `true` on success and `false` on network/Horizon failure so
   * screens can surface an error without this function ever rejecting —
   * several call sites fire-and-forget (`void refreshBalance()`).
   * A failed refresh keeps the last known balance in the store.
   */
  const refreshBalance = useCallback(async (): Promise<boolean> => {
    if (!publicKey) {
      return true;
    }
    try {
      const balance = await stellar.getBalance(publicKey);
      setBalance(balance);
      setError(null);
      return true;
    } catch (err) {
      setError(toErrorMessage(err, 'Could not refresh balance'));
      return false;
    }
  }, [publicKey, setBalance]);

  useEffect(() => {
    if (isConnected && publicKey) {
      void refreshBalance();
      void refreshEcoBalance();
      void refreshUsdcBalance();
    }
  }, [
    isConnected,
    publicKey,
    refreshBalance,
    refreshEcoBalance,
    refreshUsdcBalance,
  ]);

  return {
    isConnecting,
    error,
    publicKey,
    isConnected,
    walletType,
    connectFreighter,
    connectLobstr,
    createInAppWallet,
    importWallet,
    disconnectWallet,
    refreshBalance,
    refreshEcoBalance,
    refreshUsdcBalance,
  };
}
