import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { getPayments, StellarPayment } from '../services/stellar';

const storage = new MMKV();
const zustandMMKVStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

export const PAYMENTS_CACHE_TTL_MS = 60_000;

export type WalletType = 'freighter' | 'inapp' | 'lobstr';

/**
 * Fine-grained connection lifecycle:
 *  - 'disconnected': no wallet, or a connect attempt failed/was rolled back.
 *  - 'connecting'  : a connect attempt is in flight (key known, balances not
 *                    yet verified against Horizon). `isConnected` is still
 *                    false so the app must not show the main screens yet.
 *  - 'connected'   : balances were fetched successfully and the wallet is
 *                    usable. This is the only state where `isConnected` is
 *                    true.
 */
export type WalletStatus = 'disconnected' | 'connecting' | 'connected';

/** Balances verified before the wallet is marked as connected. */
export interface InitialBalances {
  balance: string | null;
  ecoBalance: string | null;
  usdcBalance: string | null;
}

interface WalletState {
  isConnected: boolean;
  status: WalletStatus;
  /** Last connection failure, surfaced by the UI instead of a zero-balance main screen. */
  connectError: string | null;
  publicKey: string | null;
  balance: string | null;
  ecoBalance: string | null;
  usdcBalance: string | null;
  walletType: WalletType | null;
  payments: StellarPayment[] | null;
  paymentsLastFetchedAt: number | null;
  /** Enter the intermediate 'connecting' state. Does NOT flip isConnected. */
  beginConnect: () => void;
  /**
   * Mark connected. Only called once balance data has been fetched, so a
   * connected wallet always has verified balances (never null/unknown).
   */
  connect: (
    publicKey: string,
    walletType?: WalletType,
    initialBalances?: InitialBalances,
  ) => void;
  /**
   * Roll back a failed connect attempt: clears every wallet field and
   * records why, so navigators render onboarding + an error instead of a
   * half-connected main app.
   */
  connectFailed: (error: string) => void;
  disconnect: () => void;
  setBalance: (balance: string) => void;
  setEcoBalance: (ecoBalance: string) => void;
  setUsdcBalance: (usdcBalance: string) => void;
  setPayments: (payments: StellarPayment[]) => void;
  refreshPayments: () => Promise<StellarPayment[] | null>;
}

const clearedWalletFields = {
  publicKey: null,
  balance: null,
  ecoBalance: null,
  usdcBalance: null,
  walletType: null,
  payments: null,
  paymentsLastFetchedAt: null,
} satisfies Pick<
  WalletState,
  | 'publicKey'
  | 'balance'
  | 'ecoBalance'
  | 'usdcBalance'
  | 'walletType'
  | 'payments'
  | 'paymentsLastFetchedAt'
>;

/**
 * Persisted slice of the wallet store. Only identity fields survive a
 * restart; live balances are excluded so a cold start never serves a stale
 * snapshot as current data (they are refreshed by useStellarWallet).
 */
export type WalletPersistedState = Pick<
  WalletState,
  'isConnected' | 'publicKey' | 'walletType'
>;

export const partializeWalletState = (
  state: WalletState,
): WalletPersistedState => ({
  isConnected: state.isConnected,
  publicKey: state.publicKey,
  walletType: state.walletType,
});

export const useWalletStore = create<WalletState>()(
  persist(
    set => ({
      isConnected: false,
      status: 'disconnected',
      connectError: null,
      publicKey: null,
      balance: null,
      ecoBalance: null,
      usdcBalance: null,
      walletType: null,
      payments: null,
      paymentsLastFetchedAt: null,
      beginConnect: () =>
        set({ status: 'connecting', isConnected: false, connectError: null }),
      connect: (publicKey, walletType = 'inapp', initialBalances) =>
        set({
          isConnected: true,
          status: 'connected',
          connectError: null,
          publicKey,
          walletType,
          // Applied atomically with isConnected so the wallet can never be
          // observed as connected with a stale/null balance. Explicit nulls
          // (asset not configured) reset any previous wallet's balances.
          ...(initialBalances ?? {}),
        }),
      connectFailed: (error: string) =>
        set({
          isConnected: false,
          status: 'disconnected',
          connectError: error,
          ...clearedWalletFields,
        }),
      disconnect: () =>
        set({
          isConnected: false,
          status: 'disconnected',
          connectError: null,
          ...clearedWalletFields,
        }),
      setBalance: balance => set({ balance }),
      setEcoBalance: ecoBalance => set({ ecoBalance }),
      setUsdcBalance: usdcBalance => set({ usdcBalance }),
      setPayments: payments =>
        set({ payments, paymentsLastFetchedAt: Date.now() }),
      refreshPayments: async () => {
        const { publicKey, payments, paymentsLastFetchedAt } =
          useWalletStore.getState();
        if (!publicKey) {
          return payments;
        }

        const now = Date.now();
        const isCacheStale =
          paymentsLastFetchedAt === null ||
          now - paymentsLastFetchedAt >= PAYMENTS_CACHE_TTL_MS;

        if (!isCacheStale) {
          return payments;
        }

        try {
          const freshPayments = await getPayments(publicKey);
          useWalletStore.setState({
            payments: freshPayments,
            paymentsLastFetchedAt: now,
          });
          return freshPayments;
        } catch {
          // Preserve the existing cache on network failure so the UI can
          // still show stale data rather than a blank screen.
          return payments;
        }
      },
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => zustandMMKVStorage),
      // Only durable data survives a restart. `status` and `connectError`
      // are transient: a crash mid-connect must not restore a stuck
      // 'connecting' status or a stale error banner.
      //
      // Balances (balance/ecoBalance/usdcBalance) are live data and MUST
      // NOT be persisted: a stale MMKV snapshot would be served as current
      // on cold start. They are re-fetched by useStellarWallet's useEffect
      // on rehydration. Keep this in sync when WalletState gains fields.
      partialize: partializeWalletState,
    },
  ),
);
