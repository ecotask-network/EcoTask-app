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
      /** true when IPFS pinning failed after retries but the submission still proceeded. */
      ipfsPending?: boolean;
    }
  | {
      status: 'queued';
      error: string;
      /** true when IPFS pinning failed after retries. */
      ipfsPending?: boolean;
    }
  | {
      status: 'failed';
      error: string;
      /** true when IPFS pinning failed after retries. */
      ipfsPending?: boolean;
    };

// IPFS pinning resilience: retry a failed pin a small number of times with
// exponential backoff before falling through (best-effort submission).
const IPFS_MAX_ATTEMPTS = 2; // 1 initial attempt + 1 retry
const IPFS_RETRY_BACKOFF_MS = 150;

async function pinWithRetry<T>(
  pin: () => Promise<T>,
  label: string,
  taskId: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= IPFS_MAX_ATTEMPTS; attempt++) {
    try {
      return await pin();
    } catch (err) {
      lastError = err;
      console.warn(
        `[useProofSubmit] IPFS pin attempt ${attempt}/${IPFS_MAX_ATTEMPTS} failed for ${label} (task ${taskId}):`,
        err,
      );
      if (attempt < IPFS_MAX_ATTEMPTS) {
        await new Promise(resolve =>
          setTimeout(resolve, IPFS_RETRY_BACKOFF_MS * attempt),
        );
      }
    }
  }
  console.warn(
    `[useProofSubmit] IPFS pinning failed after ${IPFS_MAX_ATTEMPTS} attempts for ${label} (task ${taskId}); submission will proceed without a CID.`,
    lastError,
  );
  throw lastError;
}

/**
 * Attempt to pin the proof photo + metadata to IPFS, retrying each pin a small
 * number of times. Returns the obtained CIDs (if any) and whether pinning
 * ultimately failed (so the caller can inform the user / flag the submission).
 */
async function pinProofAssets(
  taskId: string,
  photoUri: string,
  opts?: {
    lat?: number;
    lng?: number;
    photoCid?: string;
    metadataCid?: string;
  },
): Promise<{ photoCid?: string; metadataCid?: string; ipfsPending: boolean }> {
  let photoCid = opts?.photoCid;
  let metadataCid = opts?.metadataCid;
  let ipfsPending = false;

  if (!photoCid || !metadataCid) {
    try {
      if (!photoCid) {
        const photoRes = await pinWithRetry(
          () => pinFile(photoUri, proofFileName(taskId)),
          'photo',
          taskId,
        );
        photoCid = photoRes.cid;
      }
      if (photoCid && !metadataCid) {
        const metaPhotoCid = photoCid;
        const metadataRes = await pinWithRetry(
          () =>
            pinJSON(
              buildProofMetadata({
                taskId,
                photoCid: metaPhotoCid,
                lat: opts?.lat,
                lng: opts?.lng,
              }),
              proofFileName(taskId, undefined, 'json'),
            ),
          'metadata',
          taskId,
        );
        metadataCid = metadataRes.cid;
      }
    } catch (err) {
      ipfsPending = true;
      console.warn(
        `[useProofSubmit] IPFS pinning failed for task ${taskId}; submitting without CIDs.`,
        err,
      );
    }
  }

  return { photoCid, metadataCid, ipfsPending };
}

export function useProofSubmit() {
  const { isInitialised } = useNetworkStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<
    'idle' | 'uploading' | 'verifying' | 'confirmed' | 'failed'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [ipfsPending, setIpfsPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => loadQueue().length);

  const submitProofAttempt = useCallback(
    async (
      taskId: string,
      photoUri: string,
      opts?: {
        lat?: number;
        lng?: number;
        photoCid?: string;
        metadataCid?: string;
      },
    ): Promise<{
      result: Awaited<ReturnType<typeof submitProof>>;
      ipfsPending: boolean;
    }> => {
      const { photoCid, metadataCid, ipfsPending } = await pinProofAssets(
        taskId,
        photoUri,
        opts,
      );

      const formData = new FormData();
      formData.append('taskId', taskId);
      if (opts?.lat !== undefined) {
        formData.append('lat', String(opts.lat));
      }
      if (opts?.lng !== undefined) {
        formData.append('lng', String(opts.lng));
      }

      formData.append('photos', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'proof.jpg',
      } as any);

      if (photoCid) {
        formData.append('ipfsPhotoCid', photoCid);
      }
      if (metadataCid) {
        formData.append('ipfsMetadataCid', metadataCid);
      }

      try {
        const result = await submitProof(formData);
        return { result, ipfsPending };
      } catch (err) {
        // attach the generated cids so callers can persist them
        (err as any).photoCid = photoCid;
        (err as any).metadataCid = metadataCid;
        (err as any).ipfsPending = ipfsPending;
        throw err;
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
      setIpfsPending(false);

      try {
        setProgress('verifying');
        const { result, ipfsPending: attemptIpfsPending } =
          await submitProofAttempt(taskId, photoUri, { lat, lng });
        if (attemptIpfsPending) {
          setIpfsPending(true);
        }
        removeProofsForTask(taskId);
        setPendingCount(loadQueue().length);
        // Stay in 'verifying' — the caller mounts useProofStatus which drives
        // the transition to 'confirmed' or 'failed' once the backend responds.
        setProgress('verifying');
        if (result === undefined || result === null) {
          const message = 'Submission returned no result';
          setError(message);
          setProgress('failed');
          return {
            status: 'failed',
            error: message,
            ...(attemptIpfsPending ? { ipfsPending: true } : {}),
          };
        }
        return {
          status: 'success',
          result,
          ...(attemptIpfsPending ? { ipfsPending: true } : {}),
        };
      } catch (err) {
        const message = (err as any)?.message || 'Upload failed';
        const ipfsPending = (err as any)?.ipfsPending || false;
        try {
          enqueueProof({
            id: `${Date.now()}`,
            taskId,
            photoPath: photoUri,
            lat,
            lng,
            createdAt: new Date().toISOString(),
            capturedAt,
            photoCid: (err as any)?.photoCid,
            metadataCid: (err as any)?.metadataCid,
          });
          if (ipfsPending) {
            setIpfsPending(true);
          }
          setPendingCount(loadQueue().length);
          const queuedMessage = `Upload failed, saved for later: ${message}`;
          setError(queuedMessage);
          setProgress('failed');
          return {
            status: 'queued',
            error: queuedMessage,
            ...(ipfsPending ? { ipfsPending: true } : {}),
          };
        } catch (queueError) {
          const failureMessage =
            (queueError as any)?.message ||
            `Upload failed and could not be saved: ${message}`;
          setError(failureMessage);
          setProgress('failed');
          return {
            status: 'failed',
            error: failureMessage,
            ...(ipfsPending ? { ipfsPending: true } : {}),
          };
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
          await submitProofAttempt(proof.taskId, proof.photoPath, {
            lat: (proof as any).lat,
            lng: (proof as any).lng,
            photoCid: (proof as any).photoCid,
            metadataCid: (proof as any).metadataCid,
          });
        } catch (err) {
          remaining.push({
            ...proof,
            photoCid: (err as any)?.photoCid || (proof as any).photoCid,
            metadataCid:
              (err as any)?.metadataCid || (proof as any).metadataCid,
          } as PendingProof);
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
    ipfsPending,
  };
}
