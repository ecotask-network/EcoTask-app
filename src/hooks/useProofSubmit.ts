import { useState, useCallback } from 'react';
import { submitProof } from '../services/api';
import { pinFile, pinJSON } from '../services/ipfs';
import { PendingProof } from '../types';
import { buildProofMetadata, proofFileName } from '../utils/proofMetadata';
import {
  enqueueProof,
  loadQueue,
  saveQueue,
  removeProofsForTask,
} from '../services/proofQueue';
import { useProofSyncStore } from '../store/proofSyncStore';
import { useNetworkStatus } from './useNetworkStatus';

export type ProofSubmitResult =
  | {
      status: 'success';
      result: Awaited<ReturnType<typeof submitProof>>;
    }
  | {
      status: 'queued';
      error: string;
    }
  | {
      status: 'failed';
      error: string;
    };

// Thrown by submitProofAttempt so callers can recover the CIDs that were
// already pinned to IPFS before the network submission failed, and avoid
// re-pinning them when the proof is retried from the offline queue.
class ProofUploadError extends Error {
  photoCid?: string;
  metadataCid?: string;

  constructor(message: string, photoCid?: string, metadataCid?: string) {
    super(message);
    this.name = 'ProofUploadError';
    this.photoCid = photoCid;
    this.metadataCid = metadataCid;
  }
}

export function useProofSubmit() {
  const { isInitialised } = useNetworkStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<
    'idle' | 'uploading' | 'verifying' | 'confirmed' | 'failed'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(() => loadQueue().length);

  const submitProofAttempt = useCallback(
    async (
      taskId: string,
      photoUri: string,
      capturedAt: string,
      opts?: {
        lat?: number;
        lng?: number;
        photoCid?: string;
        metadataCid?: string;
      },
    ) => {
      const formData = new FormData();
      formData.append('taskId', taskId);
      if (opts?.lat !== undefined) {
        formData.append('lat', String(opts.lat));
      }
      if (opts?.lng !== undefined) {
        formData.append('lng', String(opts.lng));
      }

      interface ReactNativeFilePart {
        uri: string;
        type: string;
        name: string;
      }
      formData.append('photos', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'proof.jpg',
      } as ReactNativeFilePart as unknown as Blob);

      // reuse provided CIDs when available
      let photoCid = opts?.photoCid;
      let metadataCid = opts?.metadataCid;

      if (!photoCid || !metadataCid) {
        try {
          if (!photoCid) {
            const photoRes = await pinFile(
              photoUri,
              proofFileName(taskId, capturedAt),
            );
            photoCid = photoRes.cid;
          }
          if (photoCid && !metadataCid) {
            const metadataRes = await pinJSON(
              buildProofMetadata({
                taskId,
                photoCid,
                lat: opts?.lat,
                lng: opts?.lng,
              }),
              proofFileName(taskId, capturedAt, 'json'),
            );
            metadataCid = metadataRes.cid;
          }
        } catch {
          // best-effort pinning; proceed to submit without cids if necessary
        }
      }

      if (photoCid) {
        formData.append('ipfsPhotoCid', photoCid);
      }
      if (metadataCid) {
        formData.append('ipfsMetadataCid', metadataCid);
      }

      try {
        return await submitProof(formData);
      } catch (err) {
        // attach the generated cids so callers can persist them
        throw new ProofUploadError(
          err instanceof Error ? err.message : 'Upload failed',
          photoCid,
          metadataCid,
        );
      }
    },
    [],
  );

  const submit = useCallback(
    async (
      taskId: string,
      photoUri: string,
      capturedAt: string,
      lat?: number,
      lng?: number,
    ): Promise<ProofSubmitResult> => {
      setIsSubmitting(true);
      setProgress('uploading');
      setError(null);

      try {
        setProgress('verifying');
        const result = await submitProofAttempt(taskId, photoUri, capturedAt, {
          lat,
          lng,
        });
        removeProofsForTask(taskId);
        setPendingCount(loadQueue().length);
        // Stay in 'verifying' — the caller mounts useProofStatus which drives
        // the transition to 'confirmed' or 'failed' once the backend responds.
        setProgress('verifying');
        if (result === undefined || result === null) {
          const message = 'Submission returned no result';
          setError(message);
          setProgress('failed');
          return { status: 'failed', error: message };
        }
        return { status: 'success', result };
      } catch (err) {
        const uploadError = err instanceof ProofUploadError ? err : undefined;
        const message = err instanceof Error ? err.message : 'Upload failed';
        try {
          enqueueProof({
            id: `${Date.now()}`,
            taskId,
            photoPath: photoUri,
            lat,
            lng,
            createdAt: new Date().toISOString(),
            capturedAt,
            photoCid: uploadError?.photoCid,
            metadataCid: uploadError?.metadataCid,
          });
          setPendingCount(loadQueue().length);
          const queuedMessage = `Upload failed, saved for later: ${message}`;
          setError(queuedMessage);
          setProgress('failed');
          return { status: 'queued', error: queuedMessage };
        } catch (queueError) {
          const failureMessage =
            queueError instanceof Error
              ? queueError.message
              : `Upload failed and could not be saved: ${message}`;
          setError(failureMessage);
          setProgress('failed');
          return { status: 'failed', error: failureMessage };
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [submitProofAttempt],
  );

  const syncPendingProofs = useCallback(async () => {
    // Real connectivity is unknown until useNetworkStatus resolves its
    // initial NetInfo.fetch(); syncing before then can fail silently
    // against a network we haven't actually confirmed is up.
    if (!isInitialised) {
      return;
    }

    // In-flight guard to prevent concurrent sync calls
    const syncStore = useProofSyncStore.getState();
    if (syncStore.isSyncing) {
      return;
    }

    const pending = loadQueue();
    if (pending.length === 0) {
      return;
    }

    syncStore.startSync();
    try {
      const remaining: PendingProof[] = [];
      for (const proof of pending) {
        try {
          await submitProofAttempt(
            proof.taskId,
            proof.photoPath,
            proof.capturedAt,
            {
              lat: proof.lat,
              lng: proof.lng,
              photoCid: proof.photoCid,
              metadataCid: proof.metadataCid,
            },
          );
        } catch (err) {
          const uploadError = err instanceof ProofUploadError ? err : undefined;
          remaining.push({
            ...proof,
            photoCid: uploadError?.photoCid || proof.photoCid,
            metadataCid: uploadError?.metadataCid || proof.metadataCid,
          });
        }
      }
      saveQueue(remaining);
      setPendingCount(remaining.length);
    } finally {
      syncStore.endSync();
    }
  }, [isInitialised, submitProofAttempt]);

  return {
    submit,
    syncPendingProofs,
    pendingCount,
    isSubmitting,
    progress,
    error,
  };
}
