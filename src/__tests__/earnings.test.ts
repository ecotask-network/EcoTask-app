import {
  sumRewards,
  groupByTaskType,
  computeWeeklySeries,
} from '../utils/earnings';
import { Activity } from '../types';

const makeActivity = (
  id: string,
  taskType: Activity['taskType'],
  rewardAmount: number,
  completedAt: string,
  status: Activity['status'] = 'confirmed',
): Activity => ({
  id,
  taskId: id,
  taskTitle: 'Task',
  taskType,
  rewardAmount,
  rewardToken: 'ECO',
  completedAt,
  status,
});

describe('sumRewards', () => {
  it('sums confirmed and pending rewards separately', () => {
    const activities = [
      makeActivity('1', 'TREE_PLANTING', 10, '2026-08-01', 'confirmed'),
      makeActivity('2', 'TRASH_COLLECTION', 20, '2026-08-02', 'confirmed'),
      makeActivity('3', 'GARDENING', 5, '2026-08-03', 'pending'),
    ];
    expect(sumRewards(activities)).toEqual({
      total: 35,
      confirmed: 30,
      pending: 5,
    });
  });

  it('ignores failed activities', () => {
    const activities = [makeActivity('1', 'OTHER', 10, '2026-08-01', 'failed')];
    expect(sumRewards(activities)).toEqual({
      total: 0,
      confirmed: 0,
      pending: 0,
    });
  });

  it('returns zeros for an empty feed', () => {
    expect(sumRewards([])).toEqual({ total: 0, confirmed: 0, pending: 0 });
  });
});

describe('groupByTaskType', () => {
  it('groups confirmed activities by type sorted by earnings', () => {
    const activities = [
      makeActivity('1', 'TREE_PLANTING', 10, '2026-08-01'),
      makeActivity('2', 'TRASH_COLLECTION', 50, '2026-08-02'),
      makeActivity('3', 'TREE_PLANTING', 10, '2026-08-03'),
      makeActivity('4', 'GARDENING', 5, '2026-08-04', 'pending'),
    ];
    const groups = groupByTaskType(activities);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.type).toBe('TRASH_COLLECTION');
    expect(groups[0]!.count).toBe(1);
    expect(groups[0]!.total).toBe(50);
    expect(groups[1]!.type).toBe('TREE_PLANTING');
    expect(groups[1]!.count).toBe(2);
    expect(groups[1]!.total).toBe(20);
  });

  it('computes the share of each type', () => {
    const activities = [
      makeActivity('1', 'TREE_PLANTING', 25, '2026-08-01'),
      makeActivity('2', 'TRASH_COLLECTION', 75, '2026-08-02'),
    ];
    const groups = groupByTaskType(activities);
    expect(groups[0]!.share).toBeCloseTo(0.75);
    expect(groups[1]!.share).toBeCloseTo(0.25);
  });
});

describe('computeWeeklySeries', () => {
  const now = new Date(2026, 7, 11);

  it('buckets earnings into calendar weeks', () => {
    const activities = [
      makeActivity('today', 'OTHER', 10, '2026-08-11T10:00:00'),
      makeActivity('last-week', 'OTHER', 20, '2026-08-04T10:00:00'),
      makeActivity('old', 'OTHER', 30, '2026-07-21T10:00:00'),
    ];
    const series = computeWeeklySeries(activities, 4, now);
    expect(series).toHaveLength(4);
    expect(series[0]!.earned).toBe(30);
    expect(series[1]!.earned).toBe(0);
    expect(series[2]!.earned).toBe(20);
    expect(series[3]!.earned).toBe(10);
  });

  it('excludes pending activities', () => {
    const activities = [
      makeActivity('1', 'OTHER', 10, '2026-08-11T10:00:00', 'pending'),
    ];
    const series = computeWeeklySeries(activities, 1, now);
    expect(series[0]!.earned).toBe(0);
  });

  it('orders buckets oldest to newest', () => {
    const activities = [
      makeActivity('1', 'OTHER', 5, '2026-08-11T10:00:00'),
      makeActivity('2', 'OTHER', 5, '2026-08-04T10:00:00'),
    ];
    const series = computeWeeklySeries(activities, 2, now);
    expect(series[0]!.earned).toBe(5);
    expect(series[1]!.earned).toBe(5);
  });
});
