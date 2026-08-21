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

function HookHarness({ onRef }: { onRef: (ref: any) => void }) {
  const hook = useProofSubmit();
  React.useEffect(() => {
    onRef(hook);
  }, [hook, onRef]);
  return null;
}

describe('useProofSubmit IPFS resilience', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    clearQueue();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('retries a failing pinFile once then succeeds without flagging ipfsPending', async () => {
    const pinFile = jest.spyOn(ipfs, 'pinFile');
    pinFile
      .mockRejectedValueOnce(new Error('ipfs transient'))
      .mockResolvedValueOnce({
        cid: 'QmRetry',
        url: 'https://ipfs.io/ipfs/QmRetry',
      } as any);
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({ cid: 'QmMeta' } as any);
    jest.spyOn(api, 'submitProof').mockResolvedValue({ success: true } as any);

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-retry',
        '/p.jpg',
        '2026-01-01T00:00:00.000Z',
      );
      // Submission succeeded and IPFS eventually pinned, so no ipfsPending flag.
      expect(res.status).toBe('success');
      expect((res as any).ipfsPending).toBeFalsy();
      expect(ref.ipfsPending).toBe(false);
    });

    // Initial attempt + 1 retry.
    expect(pinFile).toHaveBeenCalledTimes(2);
    // A warning should have been logged for the transient failure.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('IPFS pin attempt 1/2 failed for photo'),
      expect.anything(),
    );

    // The retried CID is what gets submitted.
    const formDataArg = (api.submitProof as jest.Mock).mock.calls[0][0] as any;
    const photoCid =
      typeof formDataArg.get === 'function'
        ? formDataArg.get('ipfsPhotoCid')
        : formDataArg._parts?.find((p: any) => p[0] === 'ipfsPhotoCid')?.[1];
    expect(photoCid).toBe('QmRetry');
  });

  test('after exhausting retries, flags ipfsPending and proceeds without CIDs', async () => {
    jest
      .spyOn(ipfs, 'pinFile')
      .mockRejectedValue(new Error('ipfs down for good'));
    jest
      .spyOn(ipfs, 'pinJSON')
      .mockRejectedValue(new Error('ipfs down for good'));
    const submitProof = jest
      .spyOn(api, 'submitProof')
      .mockResolvedValue({ ok: true } as any);

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-nopin',
        '/p.jpg',
        '2026-01-01T00:00:00.000Z',
      );
      expect(res.status).toBe('success');
      expect(res.ipfsPending).toBe(true);
      expect(ref.ipfsPending).toBe(true);
    });

    // 1 initial attempt + 1 retry.
    expect(ipfs.pinFile as jest.Mock).toHaveBeenCalledTimes(2);
    // Submission still proceeds (best-effort) without a photo CID.
    const formDataArg = (submitProof as jest.Mock).mock.calls[0][0] as any;
    const hasPhotoCid =
      typeof formDataArg.get === 'function'
        ? formDataArg.get('ipfsPhotoCid')
        : formDataArg._parts?.some((p: any) => p[0] === 'ipfsPhotoCid');
    expect(hasPhotoCid).toBeFalsy();
    // The final failure is logged with the underlying error details.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('IPFS pinning failed after 2 attempts for photo'),
      expect.anything(),
    );
  });

  test('stores a CID obtained from a retry attempt when the later upload fails', async () => {
    jest
      .spyOn(ipfs, 'pinFile')
      .mockRejectedValueOnce(new Error('ipfs transient'))
      .mockResolvedValueOnce({
        cid: 'QmFromRetry',
        url: 'https://ipfs.io/ipfs/QmFromRetry',
      } as any);
    jest.spyOn(ipfs, 'pinJSON').mockResolvedValue({ cid: 'QmMeta' } as any);
    // Upload itself fails so the proof is queued.
    jest.spyOn(api, 'submitProof').mockRejectedValue(new Error('network'));

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    await act(async () => {
      const res = await ref.submit(
        'task-queue-cid',
        '/p.jpg',
        '2026-01-01T00:00:00.000Z',
      );
      expect(res.status).toBe('queued');
    });

    const queued = loadQueue();
    expect(queued.length).toBe(1);
    // The CID obtained on the retry is persisted with the queued proof.
    expect(queued[0]?.photoCid).toBe('QmFromRetry');
  });
});
