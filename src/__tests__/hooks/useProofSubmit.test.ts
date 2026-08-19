import { renderHook, act } from '@testing-library/react-hooks';
import { useProofSubmit } from '../../hooks/useProofSubmit';
import { proofQueue } from '../../hooks/proofQueue';

// Mock proofQueue
jest.mock('../../hooks/proofQueue', () => ({
  proofQueue: {
    getPendingCount: jest.fn(),
    addProof: jest.fn(),
    syncPendingProofs: jest.fn(),
  },
}));

describe('useProofSubmit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    (proofQueue.getPendingCount as jest.Mock).mockReturnValue(0);

    const { result } = renderHook(() => useProofSubmit());

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.progress).toEqual({ current: 0, total: 0 });
    expect(result.current.error).toBeNull();
    expect(result.current.pendingCount).toBe(0);
  });

  it('should submit a proof successfully', async () => {
    const mockProof = { proof: 'test proof' };
    const mockAddedProof = { id: 'proof_123', ...mockProof, timestamp: Date.now() };
    const mockSyncResult = { successful: 1, failed: 0 };

    (proofQueue.addProof as jest.Mock).mockReturnValue(mockAddedProof);
    (proofQueue.syncPendingProofs as jest.Mock).mockResolvedValue(mockSyncResult);
    (proofQueue.getPendingCount as jest.Mock).mockReturnValue(0);

    const { result } = renderHook(() => useProofSubmit());

    let submitResult: any;
    await act(async () => {
      submitResult = await result.current.submit(mockProof);
    });

    expect(submitResult).toEqual({
      success: true,
      proofId: mockAddedProof.id,
      syncResult: mockSyncResult,
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle submission errors', async () => {
    const mockProof = { proof: 'test proof' };
    const error = new Error('Submission failed');

    (proofQueue.addProof as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const { result } = renderHook(() => useProofSubmit());

    await act(async () => {
      await expect(result.current.submit(mockProof)).rejects.toThrow('Submission failed');
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe('Submission failed');
  });

  it('should handle sync errors during submission', async () => {
    const mockProof = { proof: 'test proof' };
    const mockAddedProof = { id: 'proof_123', ...mockProof, timestamp: Date.now() };
    const error = new Error('Sync failed');

    (proofQueue.addProof as jest.Mock).mockReturnValue(mockAddedProof);
    (proofQueue.syncPendingProofs as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useProofSubmit());

    await act(async () => {
      await expect(result.current.submit(mockProof)).rejects.toThrow('Sync failed');
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe('Sync failed');
  });

  it('should update progress during sync', async () => {
    const mockProof = { proof: 'test proof' };
    const mockAddedProof = { id: 'proof_123', ...mockProof, timestamp: Date.now() };

    (proofQueue.addProof as jest.Mock).mockReturnValue(mockAddedProof);
    (proofQueue.syncPendingProofs as jest.Mock).mockImplementation(
      async (onProgress?: (current: number, total: number) => void) => {
        if (onProgress) {
          onProgress(1, 2);
          onProgress(2, 2);
        }
        return { successful: 2, failed: 0 };
      }
    );
    (proofQueue.getPendingCount as jest.Mock).mockReturnValue(0);

    const { result } = renderHook(() => useProofSubmit());

    await act(async () => {
      await result.current.submit(mockProof);
    });

    expect(result.current.progress).toEqual({ current: 0, total: 0 });
  });
});
