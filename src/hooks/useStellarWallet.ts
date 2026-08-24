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

export function useStellarWallet() {
  const {
    connect,
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

  const refreshEcoBalance = useCallback(
    async (pk?: string) => {
      const key = pk || publicKey;
      const ecoCode = Config.ECO_TOKEN_ASSET_CODE;
      const ecoIssuer = Config.ECO_TOKEN_ISSUER;
      if (key && ecoCode && ecoIssuer) {
        const ecoBalance = await stellar.getTokenBalance(
          key,
          ecoCode,
          ecoIssuer,
        );
        setEcoBalance(ecoBalance);
      }
    },
    [publicKey, setEcoBalance],
  );

  const refreshUsdcBalance = useCallback(
    async (pk?: string) => {
      const key = pk || publicKey;
      const usdcIssuer = Config.USDC_ISSUER;
      if (key && usdcIssuer) {
        const usdcBalance = await stellar.getTokenBalance(
          key,
          'USDC',
          usdcIssuer,
        );
        setUsdcBalance(usdcBalance);
      }
    },
    [publicKey, setUsdcBalance],
  );

  const connectAccount = useCallback(
    async (
      key: string,
      secretKey?: string,
      type: 'freighter' | 'inapp' | 'lobstr' = 'inapp',
    ) => {
      if (secretKey) {
        saveInAppSecret(key, secretKey);
      }
      connect(key, type);
      const balance = await stellar.getBalance(key);
      setBalance(balance);
      await refreshEcoBalance(key);
      await refreshUsdcBalance(key);
    },
    [connect, setBalance, refreshEcoBalance, refreshUsdcBalance],
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

  const refreshBalance = useCallback(async () => {
    if (publicKey) {
      const balance = await stellar.getBalance(publicKey);
      setBalance(balance);
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
