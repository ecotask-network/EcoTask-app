import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Config from 'react-native-config';
import { useWalletStore } from '../store/walletStore';
import * as stellar from '../services/stellar';
import { saveInAppSecret, clearInAppSecret } from '../services/walletVault';

interface FreighterWindow {
  freighter?: {
    isConnected: () => Promise<boolean>;
    getPublicKey: () => Promise<string>;
    signTransaction: (xdr: string) => Promise<string>;
  };
}

export function useStellarWallet() {
  const {
    connect,
    disconnect,
    setBalance,
    setEcoBalance,
    publicKey,
    isConnected,
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

  const connectAccount = useCallback(
    async (key: string, secretKey?: string) => {
      if (secretKey) {
        saveInAppSecret(key, secretKey);
      }
      connect(key);
      const balance = await stellar.getBalance(key);
      setBalance(balance);
      await refreshEcoBalance(key);
    },
    [connect, setBalance, refreshEcoBalance],
  );

  const connectFreighter = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const freighter = (
        Platform.OS === 'web' ? (globalThis as any).window : ({} as FreighterWindow)
      ).freighter;
      if (!freighter) {
        throw new Error('Freighter extension not detected');
      }
      const connected = await freighter.isConnected();
      if (!connected) {
        throw new Error('Please unlock Freighter first');
      }
      const key = await freighter.getPublicKey();
      await connectAccount(key);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connectAccount]);

  const connectLobstr = useCallback(async () => {
    setError('Lobstr integration coming soon');
  }, []);

  const createInAppWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { publicKey: key, secretKey } =
        await stellar.createTestnetAccount();
      await connectAccount(key, secretKey);
      return { publicKey: key, secretKey };
    } catch (err: any) {
      setError(err.message);
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
        await connectAccount(key, trimmed);
        return { publicKey: key };
      } catch (err: any) {
        setError(err.message || 'Could not import wallet');
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
      refreshBalance();
      refreshEcoBalance();
    }
  }, [isConnected, publicKey, refreshBalance, refreshEcoBalance]);

  return {
    isConnecting,
    error,
    publicKey,
    isConnected,
    connectFreighter,
    connectLobstr,
    createInAppWallet,
    importWallet,
    disconnectWallet,
    refreshBalance,
    refreshEcoBalance,
  };
}
