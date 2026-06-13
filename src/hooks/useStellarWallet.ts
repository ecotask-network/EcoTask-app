import { useState, useEffect, useCallback } from "react";
import { Platform, Alert } from "react-native";
import { useWalletStore } from "../store/walletStore";
import { useUserStore } from "../store/userStore";
import * as stellar from "../services/stellar";

interface FreighterWindow {
  freighter?: {
    isConnected: () => Promise<boolean>;
    getPublicKey: () => Promise<string>;
    signTransaction: (xdr: string) => Promise<string>;
  };
}

export function useStellarWallet() {
  const { connect, disconnect, setBalance, publicKey, isConnected } = useWalletStore();
  const { setToken } = useUserStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectFreighter = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const freighter = (Platform.OS === "web" ? window : ({} as FreighterWindow)).freighter;
      if (!freighter) {
        throw new Error("Freighter extension not detected");
      }
      const isConnected = await freighter.isConnected();
      if (!isConnected) {
        throw new Error("Please unlock Freighter first");
      }
      const key = await freighter.getPublicKey();
      connect(key);
      const balance = await stellar.getBalance(key);
      setBalance(balance);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connect, setBalance]);

  const connectLobstr = useCallback(async () => {
    setError("Lobstr integration coming soon");
  }, []);

  const createInAppWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { publicKey, secretKey } = await stellar.createTestnetAccount();
      connect(publicKey);
      const balance = await stellar.getBalance(publicKey);
      setBalance(balance);
      return { publicKey, secretKey };
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connect, setBalance]);

  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const refreshBalance = useCallback(async () => {
    if (publicKey) {
      const balance = await stellar.getBalance(publicKey);
      setBalance(balance);
    }
  }, [publicKey, setBalance]);

  useEffect(() => {
    if (isConnected && publicKey) {
      refreshBalance();
    }
  }, [isConnected, publicKey, refreshBalance]);

  return {
    isConnecting,
    error,
    publicKey,
    isConnected,
    connectFreighter,
    connectLobstr,
    createInAppWallet,
    disconnectWallet,
    refreshBalance,
  };
}
