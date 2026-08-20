import { isNowInQuietHours } from '../utils/quietHours';

/**
 * Note: Node.js Date.getHours() / getMinutes() use the process's timezone,
 * which is fixed at startup and cannot be changed at runtime in Jest workers.
 * Therefore we construct Date objects with LOCAL time strings (no 'Z' suffix)
 * to test the function's logic, regardless of the test runner's timezone.
 * 
 * The function uses local time (getHours/getMinutes), so the test data MUST
 * be expressed in the local timezone of the process running the tests.
 * By using ISO strings without timezone suffix (e.g. '2020-01-01T23:00:00'),
 * the Date is parsed as LOCAL time, making tests portable across timezones.
 */
describe('quiet hours (local time)', () => {
  test('crossover midnight window is handled', () => {
    // 22:00 -> 07:00
    const from = '22:00';
    const to = '07:00';

    // Local times (no 'Z' suffix)
    const late = new Date('2020-01-01T23:00:00');  // 23:00 local → in window
    const early = new Date('2020-01-01T06:00:00');  // 06:00 local → crossover in
    const outside = new Date('2020-01-01T12:00:00'); // 12:00 local → outside

    expect(isNowInQuietHours(from, to, late)).toBe(true);
    expect(isNowInQuietHours(from, to, early)).toBe(true);
    expect(isNowInQuietHours(from, to, outside)).toBe(false);
  });

  test('same-day window is handled', () => {
    const from = '09:00';
    const to = '17:00';

    // Local times
    const within = new Date('2020-01-01T10:00:00');  // 10:00 local → in window
    const before = new Date('2020-01-01T08:00:00');  // 08:00 local → outside

    expect(isNowInQuietHours(from, to, within)).toBe(true);
    expect(isNowInQuietHours(from, to, before)).toBe(false);
  });

  test('exact boundaries are respected', () => {
    const from = '22:00';
    const to = '07:00';

    // Edge cases
    const start = new Date('2020-01-01T22:00:00');   // 22:00 → in (inclusive start)
    const end = new Date('2020-01-01T07:00:00');     // 07:00 → out (exclusive end)
    const oneMinBefore = new Date('2020-01-01T06:59:00'); // 06:59 → in (crossover)

    expect(isNowInQuietHours(from, to, start)).toBe(true);
    expect(isNowInQuietHours(from, to, end)).toBe(false);
    expect(isNowInQuietHours(from, to, oneMinBefore)).toBe(true);
  });

  test('empty quiet hours (from === to) returns false', () => {
    const anyTime = new Date('2020-01-01T12:00:00');
    expect(isNowInQuietHours('00:00', '00:00', anyTime)).toBe(false);
    expect(isNowInQuietHours('22:00', '22:00', anyTime)).toBe(false);
  });

  test('Nairobi example from issue: local time behavior is consistent', () => {
    // The issue example: user in Nairobi (UTC+3) sets quiet hours 22:00-07:00
    // With local time, midnight local (00:00) is in the crossover window.
    // 
    // Previously with UTC time, 01:00 EAT (== 22:00 UTC previous day) would 
    // evaluate to 22:00 UTC — in the window (coincidentally correct).
    // But 04:00 EAT (== 01:00 UTC) would evaluate to 01:00 UTC — 
    // also in the crossover window (still correct for this specific case).
    // The real fix is: all comparisons use LOCAL time, so quiet hours reflect
    // the user's actual local time preference regardless of timezone.
    //
    // This test verifies the function's core logic works correctly.
    // Cross-timezone correctness is ensured by the function using getHours().
    
    const from = '22:00';
    const to = '07:00';

    // Local midnight — in window (crossover)
    const midnight = new Date('2020-01-01T00:00:00');
    expect(isNowInQuietHours(from, to, midnight)).toBe(true);

    // 01:00 local — in window (crossover)  
    const oneAm = new Date('2020-01-01T01:00:00');
    expect(isNowInQuietHours(from, to, oneAm)).toBe(true);

    // 04:00 local — in window (crossover)
    const fourAm = new Date('2020-01-01T04:00:00');
    expect(isNowInQuietHours(from, to, fourAm)).toBe(true);
  });

  test('same-day window boundary', () => {
    const from = '09:00';
    const to = '17:00';

    // Exactly at start — inclusive
    const start = new Date('2020-01-01T09:00:00');
    expect(isNowInQuietHours(from, to, start)).toBe(true);

    // Exactly at end — exclusive
    const end = new Date('2020-01-01T17:00:00');
    expect(isNowInQuietHours(from, to, end)).toBe(false);
  });
});