import { create } from 'zustand';

interface ProofSyncState {
  isSyncing: boolean;
  startSync: () => void;
  endSync: () => void;
}

export const useProofSyncStore = create<ProofSyncState>(set => ({
  isSyncing: false,
  startSync: () => set({ isSyncing: true }),
  endSync: () => set({ isSyncing: false }),
}));
