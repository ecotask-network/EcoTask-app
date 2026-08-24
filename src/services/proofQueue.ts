import { MMKV } from 'react-native-mmkv';
import { PendingProof } from '../types';

const storage = new MMKV({ id: 'proof-queue' });
const QUEUE_KEY = 'pending_proofs';

export function loadQueue(): PendingProof[] {
  try {
    const raw = storage.getString(QUEUE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue(proofs: PendingProof[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(proofs));
}

export function enqueueProof(proof: PendingProof): PendingProof[] {
  const queue = loadQueue();
  const idx = queue.findIndex(p => p.taskId === proof.taskId);
  if (idx === -1) {
    queue.push(proof);
    saveQueue(queue);
    return queue;
  }
  // A proof for this task is already queued. If the incoming submission is a
  // true duplicate (identical task, photo and timestamp), keep what's there so
  // we still deduplicate. Otherwise replace it, so a retry with fresh
  // photo/CIDs (e.g. after an offline failure) is not silently dropped.
  const existing = queue[idx];
  if (!existing) {
    queue.push(proof);
    saveQueue(queue);
    return queue;
  }
  const isTrueDuplicate =
    existing.createdAt === proof.createdAt &&
    existing.photoPath === proof.photoPath &&
    existing.photoCid === proof.photoCid &&
    existing.metadataCid === proof.metadataCid;
  if (isTrueDuplicate) {
    return queue;
  }
  queue[idx] = proof;
  saveQueue(queue);
  return queue;
}

export function removeProof(id: string): PendingProof[] {
  const queue = loadQueue().filter(p => p.id !== id);
  saveQueue(queue);
  return queue;
}

export function removeProofsForTask(taskId: string): PendingProof[] {
  const queue = loadQueue().filter(p => p.taskId !== taskId);
  saveQueue(queue);
  return queue;
}

export function hasPendingProof(taskId: string): boolean {
  return loadQueue().some(p => p.taskId === taskId);
}

export function clearQueue(): void {
  storage.delete(QUEUE_KEY);
}
