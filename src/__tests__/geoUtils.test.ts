import {
  haversineDistance,
  formatDistance,
  isWithinRadius,
  enrichTasksWithDistance,
} from '../utils/geoUtils';

describe('haversineDistance', () => {
  it('returns 0 for same coordinates', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  it('calculates distance between two known points', () => {
    // New York to London ~ 5570 km
    const dist = haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(5500);
    expect(dist).toBeLessThan(5700);
  });

  it('calculates short distance correctly', () => {
    // ~1.1 km apart
    const dist = haversineDistance(51.5, -0.1, 51.51, -0.1);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2);
  });
});

describe('formatDistance', () => {
  it('formats meters for sub-km distances', () => {
    expect(formatDistance(0.5)).toBe('500m');
  });

  it('formats km for longer distances', () => {
    expect(formatDistance(12.5)).toBe('12.5km');
  });

  it('formats exact 1 km', () => {
    expect(formatDistance(1)).toBe('1.0km');
  });
});

describe('isWithinRadius', () => {
  it('returns true when within radius', () => {
    expect(isWithinRadius(51.5, -0.1, 51.51, -0.1, 5)).toBe(true);
  });

  it('returns false when outside radius', () => {
    expect(isWithinRadius(51.5, -0.1, 52.0, 0.0, 1)).toBe(false);
  });
});

describe('enrichTasksWithDistance', () => {
  const baseTask = (id: string, lat: number, lng: number) => ({
    id,
    title: id,
    description: '',
    type: 'TREE_PLANTING' as const,
    rewardAmount: 10,
    lat,
    lng,
    status: 'open',
  });

  it('computes and sorts tasks nearest-first', () => {
    const tasks = [
      baseTask('far', 40.7128, -74.006),
      baseTask('near', 51.501, -0.1),
    ];
    const result = enrichTasksWithDistance(tasks, 51.5, -0.1);
    expect(result[0]!.id).toBe('near');
    expect(result[1]!.id).toBe('far');
    expect(result[0]!.distance).toBeLessThan(1);
    expect(result[1]!.distance).toBeGreaterThan(5000);
  });

  it('keeps an already-computed distance', () => {
    const tasks = [{ ...baseTask('a', 0, 0), distance: 5 }];
    const result = enrichTasksWithDistance(tasks, 51.5, -0.1);
    expect(result[0]!.distance).toBe(5);
  });

  it('handles tasks without coordinates', () => {
    const tasks = [{ ...baseTask('a', 0, 0), lat: undefined, lng: undefined }];
    const result = enrichTasksWithDistance(tasks, 51.5, -0.1);
    expect(result).toHaveLength(1);
    expect(result[0]!.distance).toBeUndefined();
  });
});
