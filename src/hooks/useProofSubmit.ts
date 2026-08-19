import { useState, useCallback } from 'react';
import { proofQueue, ProofData } from './proofQueue';

/**
 * Full proof submission hook (used by SubmitProofScreen)
 * Manages the full submission flow: submit, progress, error, isSubmitting
 * 
 * @returns {Object} submit, progress, error, isSubmitting, pendingCount
 */
export function useProofSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Update pending count on mount
  const updateCount = useCallback(() => {
    const count = proofQueue.getPendingCount();
    setPendingCount(count);
  }, []);

  // Initial count and event listener
  useState(() => {
    updateCount();
    window.addEventListener('proofsUpdated', updateCount);
    return () => window.removeEventListener('proofsUpdated', updateCount);
  });

  /**
   * Submit a proof to the queue
   */
  const submit = useCallback(async (proof: Omit<ProofData, 'id' | 'timestamp'>) => {
    setIsSubmitting(true);
    setError(null);
    setProgress({ current: 0, total: 1 });

    try {
      // Add proof to queue
      const newProof = proofQueue.addProof(proof);
      setProgress({ current: 1, total: 1 });

      // Attempt to sync all pending proofs
      const syncResult = await proofQueue.syncPendingProofs((current, total) => {
        setProgress({ current, total });
      });

      // Update count
      updateCount();
      window.dispatchEvent(new Event('proofsUpdated'));

      return {
        success: true,
        proofId: newProof.id,
        syncResult,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSubmitting(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [updateCount]);

  /**
   * Sync all pending proofs
   */
  const syncPendingProofs = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await proofQueue.syncPendingProofs((current, total) => {
        setProgress({ current, total });
      });

      updateCount();
      window.dispatchEvent(new Event('proofsUpdated'));

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [updateCount]);

  return {
    submit,
    syncPendingProofs,
    progress,
    error,
    isSubmitting,
    pendingCount,
  };
}
