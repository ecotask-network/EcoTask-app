import { isNowInQuietHours } from '../utils/quietHours';

describe('quiet hours', () => {
  test('crossover midnight window is handled (local time)', () => {
    // 22:00 -> 07:00
    const from = '22:00';
    const to = '07:00';

    const late = new Date(2020, 0, 1, 23, 0, 0);
    const early = new Date(2020, 0, 1, 6, 0, 0);
    const outside = new Date(2020, 0, 1, 12, 0, 0);

    expect(isNowInQuietHours(from, to, late)).toBe(true);
    expect(isNowInQuietHours(from, to, early)).toBe(true);
    expect(isNowInQuietHours(from, to, outside)).toBe(false);
  });

  test('same-day window is handled (local time)', () => {
    const from = '09:00';
    const to = '17:00';

    const within = new Date(2020, 0, 1, 10, 0, 0);
    const before = new Date(2020, 0, 1, 8, 0, 0);

    expect(isNowInQuietHours(from, to, within)).toBe(true);
    expect(isNowInQuietHours(from, to, before)).toBe(false);
  });
});

describe('quiet hours - timezone independence', () => {
  const originalTZ = process.env.TZ;

  const timezones = [
    'UTC', // UTC+0
    'Africa/Nairobi', // UTC+3
    'America/New_York', // UTC-5 (EST, in January)
  ];

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  test.each(timezones)(
    'quiet hours 22:00-07:00 suppress notifications at local midnight in %s',
    tz => {
      process.env.TZ = tz;

      // 00:00 local time, regardless of the process timezone.
      const midnightLocal = new Date(2020, 0, 1, 0, 0, 0);

      expect(isNowInQuietHours('22:00', '07:00', midnightLocal)).toBe(true);
    },
  );

  test.each(timezones)(
    'quiet hours 22:00-07:00 do not suppress notifications at local noon in %s',
    tz => {
      process.env.TZ = tz;

      // 12:00 local time, regardless of the process timezone.
      const noonLocal = new Date(2020, 0, 1, 12, 0, 0);

      expect(isNowInQuietHours('22:00', '07:00', noonLocal)).toBe(false);
    },
  );

  test.each(timezones)(
    'a given local wall-clock time yields the same result independent of process timezone (%s)',
    tz => {
      process.env.TZ = tz;

      const insideWindow = new Date(2020, 0, 1, 23, 30, 0); // 23:30 local
      const outsideWindow = new Date(2020, 0, 1, 12, 0, 0); // 12:00 local

      expect(isNowInQuietHours('22:00', '07:00', insideWindow)).toBe(true);
      expect(isNowInQuietHours('22:00', '07:00', outsideWindow)).toBe(false);
    },
  );
});
