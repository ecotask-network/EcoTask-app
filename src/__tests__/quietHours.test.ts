import { isNowInQuietHours } from '../utils/quietHours';

describe('quiet hours', () => {
  test('crossover midnight window is handled', () => {
    // 22:00 -> 07:00
    const from = '22:00';
    const to = '07:00';

    const late = new Date('2020-01-01T23:00:00Z');
    const early = new Date('2020-01-01T06:00:00Z');
    const outside = new Date('2020-01-01T12:00:00Z');

    expect(isNowInQuietHours(from, to, late)).toBe(true);
    expect(isNowInQuietHours(from, to, early)).toBe(true);
    expect(isNowInQuietHours(from, to, outside)).toBe(false);
  });

  test('same-day window is handled', () => {
    const from = '09:00';
    const to = '17:00';

    const within = new Date('2020-01-01T10:00:00Z');
    const before = new Date('2020-01-01T08:00:00Z');

    expect(isNowInQuietHours(from, to, within)).toBe(true);
    expect(isNowInQuietHours(from, to, before)).toBe(false);
  });
});
