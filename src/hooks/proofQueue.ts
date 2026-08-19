import { useState, useCallback } from 'react';

export interface ProofData {
  id: string;
  proof: string;
  timestamp: number;
}

export interface ProofSubmitResult {
  success: boolean;
  proofId: string;
  error?: string;
}

/**
 * Shared proof queue module
 * Used by both usePendingProofs and useProofSubmit
 */
export const proofQueue = {
  /**
   * Get all pending proofs
   */
  getPendingProofs: (): ProofData[] => {
    try {
      const stored = localStorage.getItem('pendingProofs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  /**
   * Add a proof to the queue
   */
  addProof: (proof: Omit<ProofData, 'id' | 'timestamp'>): ProofData => {
    const pending = proofQueue.getPendingProofs();
    const newProof: ProofData = {
      ...proof,
      id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    pending.push(newProof);
    localStorage.setItem('pendingProofs', JSON.stringify(pending));
    return newProof;
  },

  /**
   * Remove a proof from the queue
   */
  removeProof: (proofId: string): void => {
    const pending = proofQueue.getPendingProofs();
    const filtered = pending.filter((p) => p.id !== proofId);
    localStorage.setItem('pendingProofs', JSON.stringify(filtered));
  },

  /**
   * Clear all pending proofs
   */
  clearAll: (): void => {
    localStorage.removeItem('pendingProofs');
  },

  /**
   * Get the count of pending proofs
   */
  getPendingCount: (): number => {
    return proofQueue.getPendingProofs().length;
  },

  /**
   * Submit a single proof
   */
  submitProof: async (proof: ProofData): Promise<ProofSubmitResult> => {
    // Simulate API call
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.1) {
          reject(new Error('Network error'));
        } else {
          resolve({});
        }
      }, 1000);
    });

    return {
      success: true,
      proofId: proof.id,
    };
  },

  /**
   * Sync all pending proofs
   */
  syncPendingProofs: async (onProgress?: (completed: number, total: number) => void): Promise<{
    successful: number;
    failed: number;
  }> => {
    const pending = proofQueue.getPendingProofs();
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      const proof = pending[i];
      try {
        await proofQueue.submitProof(proof);
        proofQueue.removeProof(proof.id);
        successful++;
      } catch (error) {
        failed++;
        console.error(`Failed to submit proof ${proof.id}:`, error);
      }

      if (onProgress) {
        onProgress(i + 1, pending.length);
      }
    }

    return { successful, failed };
  },
};
