import {
  isSelectionFresh,
  buildSubmitProofParams,
  SELECTION_FRESHNESS_MS,
} from '../utils/taskSelection';
import { Task } from '../types';

const task: Task = {
  id: 't1',
  title: 'Plant a tree',
  description: 'Plant a sapling in the park',
  type: 'TREE_PLANTING',
  rewardAmount: 25,
  rewardToken: 'ECO',
  lat: 1,
  lng: 2,
  status: 'open',
};

describe('isSelectionFresh', () => {
  const now = new Date('2026-08-17T12:00:00.000Z').getTime();

  it('is false when nothing is selected', () => {
    expect(isSelectionFresh(null, now)).toBe(false);
  });

  it('is true just after selection', () => {
    expect(isSelectionFresh(new Date(now).toISOString(), now)).toBe(true);
  });

  it('is true just under the 24h boundary', () => {
    const selectedAt = new Date(now - SELECTION_FRESHNESS_MS + 1000).toISOString();
    expect(isSelectionFresh(selectedAt, now)).toBe(true);
  });

  it('is false exactly at the 24h boundary', () => {
    const selectedAt = new Date(now - SELECTION_FRESHNESS_MS).toISOString();
    expect(isSelectionFresh(selectedAt, now)).toBe(false);
  });

  it('is false once older than 24h', () => {
    const selectedAt = new Date(now - SELECTION_FRESHNESS_MS - 1000).toISOString();
    expect(isSelectionFresh(selectedAt, now)).toBe(false);
  });

  it('is false for an unparseable timestamp', () => {
    expect(isSelectionFresh('not-a-date', now)).toBe(false);
  });
});

describe('buildSubmitProofParams', () => {
  it('maps a task onto SubmitProof route params', () => {
    expect(buildSubmitProofParams(task)).toEqual({
      taskId: 't1',
      taskTitle: 'Plant a tree',
      taskType: 'TREE_PLANTING',
      rewardAmount: 25,
      rewardToken: 'ECO',
    });
  });

  it('defaults rewardToken to ECO when missing', () => {
    const { rewardToken, ...rest } = task;
    expect(buildSubmitProofParams(rest as Task).rewardToken).toBe('ECO');
  });
});
