/**
 * useProofStatus
 *
 * Polls GET /proofs/:id/status with exponential back-off until the proof
 * reaches a terminal state ('confirmed' | 'failed') or a 10-minute timeout
 * elapses.
 *
 * Lifecycle guarantees:
 *  - Stops immediately on component unmount.
 *  - Pauses when the device goes offline; resumes automatically on reconnect.
 *  - Fires a local "Reward confirmed" notification on success.
 *  - Fires a local timeout notification if verification exceeds 10 minutes.
 *  - Updates the activity store so HomeScreen reflects the real status.
 */
import { useEffect, useRef, useCallback } from 'react';
import { fetchProofStatus, ProofVerificationStatus } from '../services/api';
import { scheduleLocalNotification } from '../services/notifications';
import { useActivityStore } from '../store/activityStore';
import { useNetworkStatus } from './useNetworkStatus';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';

// Polling configuration
const INITIAL_INTERVAL_MS = 5_000; // 5 s first poll
const MAX_INTERVAL_MS = 60_000; // 60 s ceiling
const BACKOFF_FACTOR = 1.5;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const TERMINAL_STATUSES: ReadonlySet<ProofVerificationStatus> = new Set([
  'confirmed',
  'failed',
]);

export interface UseProofStatusOptions {
  /** Activity id in the local store (used to update its status). */
  activityId: string;
  /** Title of the task – used in the reward notification body. */
  taskTitle: string;
  /** Expected token name – used in the notification body. */
  rewardToken: string;
}

/**
 * Mount this hook after a successful proof POST to drive status polling.
 * Pass `null` as `proofId` to keep it dormant (e.g. while the proofId is
 * not yet known or the activity is already confirmed/failed).
 */
export function useProofStatus(
  proofId: string | null,
  opts: UseProofStatusOptions,
): void {
  const { activityId, taskTitle, rewardToken } = opts;
  const { isConnected, isInitialised } = useNetworkStatus();
  const updateActivityStatus = useActivityStore(s => s.updateActivityStatus);

  // Persist mutable poll state across re-renders without causing them.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number>(0);
  const intervalRef = useRef<number>(INITIAL_INTERVAL_MS);
  const isRunningRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  // Keep latest values in refs so the closure inside schedulePoll stays fresh
  // without needing to be torn down and recreated on every render.
  const isConnectedRef = useRef<boolean>(isConnected);
  const isInitialisedRef = useRef<boolean>(isInitialised);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
  useEffect(() => {
    isInitialisedRef.current = isInitialised;
  }, [isInitialised]);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    isRunningRef.current = false;
    cancelTimer();
  }, [cancelTimer]);

  const schedulePoll = useCallback(
    (currentProofId: string, delayMs: number) => {
      cancelTimer();

      timerRef.current = setTimeout(() => {
        void (async () => {
          if (!mountedRef.current || !isRunningRef.current) {
            return;
          }

          // Pause while offline; reschedule with normal back-off once back.
          if (!isInitialisedRef.current || !isConnectedRef.current) {
            const nextInterval = Math.min(
              intervalRef.current * BACKOFF_FACTOR,
              MAX_INTERVAL_MS,
            );
            intervalRef.current = nextInterval;
            schedulePoll(currentProofId, nextInterval);
            return;
          }

          // Hard 10-minute timeout.
          if (Date.now() - startedAtRef.current >= TIMEOUT_MS) {
            updateActivityStatus(activityId, 'failed');
            void scheduleLocalNotification({
              title: 'Proof verification timed out',
              body: 'Proof verification timed out. Please check your submission status.',
              type: NOTIFICATION_TYPES.PROOF_TIMEOUT,
              data: {
                type: NOTIFICATION_TYPES.PROOF_TIMEOUT,
                proofId: currentProofId,
                activityId,
                deepLink: 'ecotask://wallet',
              },
            });
            stopPolling();
            return;
          }

          try {
            const response = await fetchProofStatus(currentProofId);

            if (!mountedRef.current || !isRunningRef.current) {
              return;
            }

            if (TERMINAL_STATUSES.has(response.status)) {
              updateActivityStatus(
                activityId,
                response.status,
                response.rewardAmount,
              );

              if (response.status === 'confirmed') {
                const amount = response.rewardAmount ?? 0;
                void scheduleLocalNotification({
                  title: 'Reward confirmed! 🎉',
                  body: `You earned ${amount} ${rewardToken} for "${taskTitle}".`,
                  type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
                  data: {
                    type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
                    proofId: currentProofId,
                    activityId,
                  },
                });
              }

              stopPolling();
              return;
            }

            // Still pending — schedule the next poll with back-off.
            const nextInterval = Math.min(
              intervalRef.current * BACKOFF_FACTOR,
              MAX_INTERVAL_MS,
            );
            intervalRef.current = nextInterval;
            schedulePoll(currentProofId, nextInterval);
          } catch {
            // Network or server error: back off and retry unless timed out.
            if (!mountedRef.current || !isRunningRef.current) {
              return;
            }
            const nextInterval = Math.min(
              intervalRef.current * BACKOFF_FACTOR,
              MAX_INTERVAL_MS,
            );
            intervalRef.current = nextInterval;
            schedulePoll(currentProofId, nextInterval);
          }
        })();
      }, delayMs);
    },

    [
      activityId,
      rewardToken,
      taskTitle,
      cancelTimer,
      stopPolling,
      updateActivityStatus,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!proofId) {
      return;
    }

    // Reset poll state for this proof.
    startedAtRef.current = Date.now();
    intervalRef.current = INITIAL_INTERVAL_MS;
    isRunningRef.current = true;

    schedulePoll(proofId, INITIAL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
    // schedulePoll and stopPolling are stable callbacks; proofId is the
    // only value that should restart the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofId]);
}
