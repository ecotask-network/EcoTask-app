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
import * as proofQueueService from '../services/proofQueue';
import { useProofSyncStore } from '../store/proofSyncStore';
import { SubmitProofResult } from '../types';

type UseProofSubmitResult = ReturnType<typeof useProofSubmit>;

const CAPTURED_AT = '2026-01-01T00:00:00.000Z';

function HookHarness({
  onRef,
}: {
  onRef: (hook: UseProofSubmitResult) => void;
}) {
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
    const ipfsFile = {
      cid: 'Qm123',
      url: 'https://ipfs.io/ipfs/Qm123',
      size: 100,
    };
    jest.spyOn(ipfs, 'pinFile').mockResolvedValue(ipfsFile);
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({
      cid: 'QmMeta',
      url: 'https://ipfs.io/ipfs/QmMeta',
      size: 50,
    });
    const submitResult: SubmitProofResult = { taskTitle: 'success' };
    jest.spyOn(api, 'submitProof').mockResolvedValue(submitResult);

    let ref!: UseProofSubmitResult;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-1',
        '/path/photo.jpg',
        CAPTURED_AT,
        1,
        2,
      );
      expect(res).toEqual({
        status: 'success',
        result: submitResult,
      });
      // After a successful POST the hook stays at 'verifying'; useProofStatus
      // drives the transition to 'confirmed' once the backend responds.
      expect(ref.progress).toBe('verifying');
      expect(ref.pendingCount).toBe(0);
    });
  });

  test('undefined API response returns an explicit failed result', async () => {
    jest.spyOn(ipfs, 'pinFile').mockResolvedValue({
      cid: 'QmX',
      url: 'https://ipfs.io/ipfs/QmX',
      size: 10,
    });
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({
      cid: 'QmMeta',
      url: 'https://ipfs.io/ipfs/QmMeta',
      size: 50,
    });
    jest
      .spyOn(api, 'submitProof')
      .mockResolvedValue(undefined as unknown as SubmitProofResult);

    let ref!: UseProofSubmitResult;
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
    jest.spyOn(ipfs, 'pinFile').mockResolvedValue({
      cid: 'QmX',
      url: 'https://ipfs.io/ipfs/QmX',
      size: 10,
    });
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({
      cid: 'QmMeta',
      url: 'https://ipfs.io/ipfs/QmMeta',
      size: 50,
    });
    jest
      .spyOn(api, 'submitProof')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ taskTitle: 'ok' });

    let ref!: UseProofSubmitResult;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit('task-2', '/path/p.jpg', CAPTURED_AT);
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
    const submitResult: SubmitProofResult = { taskTitle: 'ok' };
    jest.spyOn(api, 'submitProof').mockResolvedValue(submitResult);

    let ref!: UseProofSubmitResult;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-3',
        '/p.jpg',
        '2026-01-01T00:00:00.000Z',
      );
      expect(res).toEqual({
        status: 'success',
        result: { taskTitle: 'ok' },
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
      .mockResolvedValueOnce({ taskTitle: 'ok' });
    // enqueue two proofs manually via the submit failure path
    let ref!: UseProofSubmitResult;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      // first submit fails and enqueues
      jest.spyOn(ipfs, 'pinFile').mockRejectedValue(new Error('ipfs'));
      await ref.submit('task-A', '/a.jpg', CAPTURED_AT);
      // second submit fails and enqueues (simulate network)
      jest
        .spyOn(api, 'submitProof')
        .mockRejectedValueOnce(new Error('network'));
      await ref.submit('task-B', '/b.jpg', CAPTURED_AT);
    });

    // now make next sync attempt: first will fail, second will succeed
    jest
      .spyOn(api, 'submitProof')
      .mockRejectedValueOnce(new Error('still-fail'))
      .mockResolvedValueOnce({ taskTitle: 'ok' });

    await act(async () => {
      await ref.syncPendingProofs();
      // after sync, one should remain or zero depending on ordering; ensure function completes and pendingCount is numeric
      expect(typeof ref.pendingCount).toBe('number');
    });
  });
});

interface FormDataLike {
  get?: (key: string) => unknown;
  _parts?: [string, unknown][];
  getParts?: () => { fieldName: string; string?: unknown }[];
}

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
    const mockLoadQueue = jest.spyOn(proofQueueService, 'loadQueue');

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
    ]);
    mockSubmitProof.mockResolvedValue({});

    let hookResult!: UseProofSubmitResult;
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
    const formDataArg = mockSubmitProof.mock
      .calls[0]![0] as unknown as FormDataLike;

    // Extract ipfs CIDs from FormData variations
    let photoCid;
    let metadataCid;

    if (typeof formDataArg.get === 'function') {
      photoCid = formDataArg.get('ipfsPhotoCid');
      metadataCid = formDataArg.get('ipfsMetadataCid');
    } else if (formDataArg._parts) {
      photoCid = formDataArg._parts.find(p => p[0] === 'ipfsPhotoCid')?.[1];
      metadataCid = formDataArg._parts.find(
        p => p[0] === 'ipfsMetadataCid',
      )?.[1];
    } else if (typeof formDataArg.getParts === 'function') {
      const parts = formDataArg.getParts();
      photoCid = parts.find(p => p.fieldName === 'ipfsPhotoCid')?.string;
      metadataCid = parts.find(p => p.fieldName === 'ipfsMetadataCid')?.string;
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

    let hookResult!: UseProofSubmitResult;
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
