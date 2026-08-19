import { useState, useEffect, useCallback } from 'react';
import { proofQueue } from './proofQueue';

/**
 * Hook for managing pending proofs (used by HomeScreen)
 * Only manages the queue count and sync - no submission state
 * 
 * @returns {Object} pendingCount, isSyncing, syncPendingProofs
 */
export function usePendingProofs() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Update pending count on mount and when storage changes
  useEffect(() => {
    const updateCount = () => {
      const count = proofQueue.getPendingCount();
      setPendingCount(count);
    };

    updateCount();

    // Listen for storage changes (e.g., from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pendingProofs') {
        updateCount();
      }
    };

    // Custom event for same-tab updates
    const handleProofUpdate = () => {
      updateCount();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('proofsUpdated', handleProofUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('proofsUpdated', handleProofUpdate);
    };
  }, []);

  /**
   * Sync all pending proofs
   */
  const syncPendingProofs = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await proofQueue.syncPendingProofs();
      
      // Update count after sync
      const newCount = proofQueue.getPendingCount();
      setPendingCount(newCount);
      
      // Dispatch event to update other components
      window.dispatchEvent(new Event('proofsUpdated'));

      return result;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return {
    pendingCount,
    isSyncing,
    syncPendingProofs,
    syncError,
  };
}
