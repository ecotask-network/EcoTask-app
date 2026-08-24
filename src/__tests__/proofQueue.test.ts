import './__mocks__/setup';
import { MMKV } from 'react-native-mmkv';
import {
  loadQueue,
  saveQueue,
  enqueueProof,
  removeProof,
  removeProofsForTask,
  hasPendingProof,
  clearQueue,
} from '../services/proofQueue';
import { PendingProof } from '../types';

describe('proofQueue', () => {
  const baseProof: PendingProof = {
    id: '1',
    taskId: 't1',
    photoPath: 'file:///tmp/proof.jpg',
    lat: 51.5,
    lng: -0.1,
    createdAt: '2026-01-01T00:00:00.000Z',
    capturedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    clearQueue();
  });

  it('loads an empty queue', () => {
    expect(loadQueue()).toEqual([]);
  });

  it('enqueues and persists a proof', () => {
    enqueueProof(baseProof);
    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: '1', taskId: 't1' });
  });

  it('enqueues multiple proofs for different tasks', () => {
    enqueueProof(baseProof);
    enqueueProof({ ...baseProof, id: '2', taskId: 't2' });
    expect(loadQueue()).toHaveLength(2);
  });

  it('deduplicates proofs for the same task', () => {
    enqueueProof(baseProof);
    enqueueProof({ ...baseProof, id: '2' });
    expect(loadQueue()).toHaveLength(1);
  });

  it('replaces an existing queued proof with a newer submission for the same task', () => {
    enqueueProof(baseProof);
    const retry = {
      ...baseProof,
      id: '2',
      createdAt: '2026-01-02T00:00:00.000Z',
      photoCid: 'new-photo-cid',
      metadataCid: 'new-meta-cid',
    };
    const queue = enqueueProof(retry);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.id).toBe('2');
    expect(queue[0]!.photoCid).toBe('new-photo-cid');
    expect(queue[0]!.metadataCid).toBe('new-meta-cid');
  });

  it('drops a true duplicate (same task, photo and timestamp) without replacing', () => {
    enqueueProof(baseProof);
    const duplicate = { ...baseProof, id: '2' };
    const queue = enqueueProof(duplicate);
    expect(queue).toHaveLength(1);
    // The original entry (id '1') is preserved; the identical resubmission
    // is deduplicated rather than replacing the queued proof.
    expect(queue[0]!.id).toBe('1');
  });

  it('reports whether a task already has a queued proof', () => {
    expect(hasPendingProof('t1')).toBe(false);
    enqueueProof(baseProof);
    expect(hasPendingProof('t1')).toBe(true);
    expect(hasPendingProof('t2')).toBe(false);
  });

  it('removes a single proof by id', () => {
    enqueueProof(baseProof);
    enqueueProof({ ...baseProof, id: '2', taskId: 't2' });
    const queue = removeProof('1');
    expect(queue).toHaveLength(1);
    expect(queue[0]!.taskId).toBe('t2');
  });

  it('removes all proofs for a task', () => {
    enqueueProof(baseProof);
    enqueueProof({ ...baseProof, id: '2', taskId: 't2' });
    const queue = removeProofsForTask('t1');
    expect(queue).toHaveLength(1);
    expect(queue[0]!.taskId).toBe('t2');
  });

  it('clears the queue', () => {
    enqueueProof(baseProof);
    clearQueue();
    expect(loadQueue()).toEqual([]);
  });

  it('round-trips the full queue via saveQueue', () => {
    saveQueue([
      baseProof,
      { ...baseProof, id: '2', photoPath: 'file:///x.jpg' },
    ]);
    const queue = loadQueue();
    expect(queue).toHaveLength(2);
    expect(queue[1]!.id).toBe('2');
  });

  it('returns an empty array when storage is corrupted', () => {
    const instance = new MMKV();
    instance.set('pending_proofs', 'not-json{');
    expect(loadQueue()).toEqual([]);
  });
});
