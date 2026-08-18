import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const zustandMMKVStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

export type WalletType = 'freighter' | 'inapp' | 'lobstr';

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  balance: string | null;
  ecoBalance: string | null;
  walletType: WalletType | null;
  connect: (publicKey: string, walletType?: WalletType) => void;
  disconnect: () => void;
  setBalance: (balance: string) => void;
  setEcoBalance: (ecoBalance: string) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    set => ({
      isConnected: false,
      publicKey: null,
      balance: null,
      ecoBalance: null,
      walletType: null,
      connect: (publicKey, walletType = 'inapp') =>
        set({ isConnected: true, publicKey, walletType }),
      disconnect: () =>
        set({
          isConnected: false,
          publicKey: null,
          balance: null,
          ecoBalance: null,
          walletType: null,
        }),
      setBalance: balance => set({ balance }),
      setEcoBalance: ecoBalance => set({ ecoBalance }),
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
