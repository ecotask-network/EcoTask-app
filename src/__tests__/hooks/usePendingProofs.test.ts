import { renderHook, act } from '@testing-library/react-hooks';
import { usePendingProofs } from '../../hooks/usePendingProofs';
import { proofQueue } from '../../hooks/proofQueue';

// Mock proofQueue
jest.mock('../../hooks/proofQueue', () => ({
  proofQueue: {
    getPendingCount: jest.fn(),
    syncPendingProofs: jest.fn(),
  },
}));

describe('usePendingProofs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with pending count', () => {
    (proofQueue.getPendingCount as jest.Mock).mockReturnValue(3);

    const { result } = renderHook(() => usePendingProofs());

    expect(result.current.pendingCount).toBe(3);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.syncError).toBeNull();
  });

  it('should sync pending proofs', async () => {
    const mockSyncResult = { successful: 2, failed: 0 };
    (proofQueue.syncPendingProofs as jest.Mock).mockResolvedValue(mockSyncResult);
    (proofQueue.getPendingCount as jest.Mock).mockReturnValue(0);

    const { result } = renderHook(() => usePendingProofs());

    await act(async () => {
      const syncResult = await result.current.syncPendingProofs();
      expect(syncResult).toEqual(mockSyncResult);
    });

    expect(result.current.isSyncing).toBe(false);
    expect(result.current.pendingCount).toBe(0);
  });

  it('should handle sync errors', async () => {
    const error = new Error('Sync failed');
    (proofQueue.syncPendingProofs as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => usePendingProofs());

    await act(async () => {
      await expect(result.current.syncPendingProofs()).rejects.toThrow('Sync failed');
    });

    expect(result.current.isSyncing).toBe(false);
    expect(result.current.syncError).toBe('Sync failed');
  });

  it('should not allow concurrent syncs', async () => {
    (proofQueue.syncPendingProofs as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const { result } = renderHook(() => usePendingProofs());

    // Start first sync
    let firstSyncPromise: Promise<any>;
    await act(async () => {
      firstSyncPromise = result.current.syncPendingProofs();
    });

    // Try to start second sync while first is in progress
    let secondSyncResult: any;
    await act(async () => {
      secondSyncResult = result.current.syncPendingProofs();
    });

    expect(secondSyncResult).toBeUndefined();
    expect(result.current.isSyncing).toBe(true);
  });
});
