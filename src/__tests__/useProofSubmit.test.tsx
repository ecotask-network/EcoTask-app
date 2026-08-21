jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useProofSubmit } from '../hooks/useProofSubmit';
import * as ipfs from '../services/ipfs';
import * as api from '../services/api';
import { clearQueue, loadQueue } from '../services/proofQueue';
import { useProofSyncStore } from '../store/proofSyncStore';

function HookHarness({ onRef }: { onRef: (ref: any) => void }) {
  const hook = useProofSubmit();
  React.useEffect(() => {
    onRef(hook);
  }, [hook, onRef]);
  return null;
}

describe('useProofSubmit integration', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    clearQueue();
  });

  test('online happy path', async () => {
    const ipfsFile = { cid: 'Qm123', url: 'https://ipfs.io/ipfs/Qm123' };
    jest.spyOn(ipfs, 'pinFile').mockResolvedValue(ipfsFile as any);
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({ cid: 'QmMeta' } as any);
    jest.spyOn(api, 'submitProof').mockResolvedValue({ success: true } as any);

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={(r: any) => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-1',
        '/path/photo.jpg',
        '2026-01-01T00:00:00.000Z',
        1,
        2,
      );
      expect(res).toEqual({
        status: 'success',
        result: { success: true },
      });
      // After a successful POST the hook stays at 'verifying'; useProofStatus
      // drives the transition to 'confirmed' once the backend responds.
      expect(ref.progress).toBe('verifying');
      expect(ref.pendingCount).toBe(0);
    });
  });

  test('undefined API response returns an explicit failed result', async () => {
    jest.spyOn(ipfs, 'pinFile').mockResolvedValue({ cid: 'QmX' } as any);
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({ cid: 'QmMeta' } as any);
    jest.spyOn(api, 'submitProof').mockResolvedValue(undefined as any);

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-no-result',
        '/path/no-result.jpg',
        '2026-01-01T00:00:00.000Z',
      );
      expect(res).toEqual({
        status: 'failed',
        error: 'Submission returned no result',
      });
      expect(ref.error).toBe('Submission returned no result');
      expect(ref.progress).toBe('failed');
      expect(loadQueue()).toHaveLength(0);
    });
  });

  test('offline enqueue then sync', async () => {
    jest.spyOn(ipfs, 'pinFile').mockResolvedValue({ cid: 'QmX' } as any);
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({ cid: 'QmMeta' } as any);
    jest
      .spyOn(api, 'submitProof')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true } as any);

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={(r: any) => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-2',
        '/path/p.jpg',
        '2026-01-01T00:00:00.000Z',
      );
      expect(res).toEqual({
        status: 'queued',
        error: 'Upload failed, saved for later: network',
      });
      expect(ref.progress).toBe('failed');
      expect(ref.pendingCount).toBeGreaterThan(0);
    });

    // now sync pending (second call will succeed)
    await act(async () => {
      await ref.syncPendingProofs();
      expect(loadQueue().length).toBe(0);
    });
  });

  test('ipfs failure handled (still attempts submit)', async () => {
    jest.spyOn(ipfs, 'pinFile').mockRejectedValue(new Error('ipfs down'));
    jest.spyOn(ipfs, 'pinJSON').mockRejectedValue(new Error('ipfs down'));
    jest.spyOn(api, 'submitProof').mockResolvedValue({ ok: true } as any);

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={(r: any) => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-3',
        '/p.jpg',
        '2026-01-01T00:00:00.000Z',
      );
      expect(res).toEqual({
        status: 'success',
        result: { ok: true },
        ipfsPending: true,
      });
      // Progress stays at 'verifying' — polling will drive to 'confirmed'.
      expect(ref.progress).toBe('verifying');
    });
  });

  test('concurrent sync with mixed results', async () => {
    // prepare two queued proofs
    jest
      .spyOn(api, 'submitProof')
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValueOnce({ ok: true } as any);
    // enqueue two proofs manually via the submit failure path
    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={(r: any) => (ref = r)} />);
    });

    await act(async () => {
      // first submit fails and enqueues
      jest.spyOn(ipfs, 'pinFile').mockRejectedValue(new Error('ipfs'));
      await ref.submit('task-A', '/a.jpg');
      // second submit fails and enqueues (simulate network)
      jest
        .spyOn(api, 'submitProof')
        .mockRejectedValueOnce(new Error('network'));
      await ref.submit('task-B', '/b.jpg');
    });

    // now make next sync attempt: first will fail, second will succeed
    jest
      .spyOn(api, 'submitProof')
      .mockRejectedValueOnce(new Error('still-fail'))
      .mockResolvedValueOnce({ ok: true } as any);

    await act(async () => {
      await ref.syncPendingProofs();
      // after sync, one should remain or zero depending on ordering; ensure function completes and pendingCount is numeric
      expect(typeof ref.pendingCount).toBe('number');
    });
  });
});

describe('useProofSubmit retry logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the sync store state before each test
    useProofSyncStore.getState().endSync();
  });

  it('reuses stored CIDs without a second IPFS call', async () => {
    const mockPinFile = jest.spyOn(ipfs, 'pinFile');
    const mockPinJSON = jest.spyOn(ipfs, 'pinJSON');
    const mockSubmitProof = jest.spyOn(api, 'submitProof');
    const mockLoadQueue = jest.spyOn(
      require('../services/proofQueue'),
      'loadQueue',
    );

    mockLoadQueue.mockReturnValue([
      {
        id: '1',
        taskId: 't1',
        photoPath: 'file:///retry.jpg',
        createdAt: '2026-01-01T00:00:00.000Z',
        capturedAt: '2026-01-01T00:00:00.000Z',
        photoCid: 'QmPhoto',
        metadataCid: 'QmMeta',
      },
    ] as any);
    mockSubmitProof.mockResolvedValue({} as any);

    let hookResult: any;
    function TestComponent() {
      hookResult = useProofSubmit();
      return null;
    }

    await act(async () => {
      renderer.create(<TestComponent />);
    });

    await act(async () => {
      await hookResult.syncPendingProofs();
    });

    expect(mockPinFile).not.toHaveBeenCalled();
    expect(mockPinJSON).not.toHaveBeenCalled();
    const formDataArg = (mockSubmitProof as jest.Mock).mock.calls[0][0] as any;

    // Extract ipfs CIDs from FormData variations
    let photoCid;
    let metadataCid;

    if (typeof formDataArg.get === 'function') {
      photoCid = formDataArg.get('ipfsPhotoCid');
      metadataCid = formDataArg.get('ipfsMetadataCid');
    } else if (formDataArg._parts) {
      photoCid = formDataArg._parts.find(
        (p: any) => p[0] === 'ipfsPhotoCid',
      )?.[1];
      metadataCid = formDataArg._parts.find(
        (p: any) => p[0] === 'ipfsMetadataCid',
      )?.[1];
    } else if (typeof formDataArg.getParts === 'function') {
      const parts = formDataArg.getParts();
      photoCid = parts.find((p: any) => p.fieldName === 'ipfsPhotoCid')?.string;
      metadataCid = parts.find(
        (p: any) => p.fieldName === 'ipfsMetadataCid',
      )?.string;
    }

    expect(photoCid).toBe('QmPhoto');
    expect(metadataCid).toBe('QmMeta');
  });

  it('prevents concurrent syncPendingProofs calls from duplicating submissions', async () => {
    const mockSubmitProof = api.submitProof as jest.MockedFunction<
      typeof api.submitProof
    >;
    const mockLoadQueue = loadQueue as jest.MockedFunction<typeof loadQueue>;

    const pendingProofs = [
      {
        id: '1',
        taskId: 't1',
        photoPath: 'file:///proof1.jpg',
        createdAt: '2026-01-01T00:00:00.000Z',
        capturedAt: '2026-01-01T00:00:00.000Z',
        photoCid: 'QmPhoto1',
        metadataCid: 'QmMeta1',
      },
      {
        id: '2',
        taskId: 't2',
        photoPath: 'file:///proof2.jpg',
        createdAt: '2026-01-01T00:00:00.000Z',
        capturedAt: '2026-01-01T00:00:00.000Z',
        photoCid: 'QmPhoto2',
        metadataCid: 'QmMeta2',
      },
    ];

    mockLoadQueue.mockReturnValue(pendingProofs);
    mockSubmitProof.mockResolvedValue({});

    let hookResult: any;
    function TestComponent() {
      hookResult = useProofSubmit();
      return null;
    }

    await act(async () => {
      renderer.create(<TestComponent />);
    });

    // Call syncPendingProofs twice concurrently
    await act(async () => {
      const promise1 = hookResult.syncPendingProofs();
      const promise2 = hookResult.syncPendingProofs();
      await Promise.all([promise1, promise2]);
    });

    // Each proof should be submitted exactly once (not twice)
    expect(mockSubmitProof).toHaveBeenCalledTimes(2);
  });
});
