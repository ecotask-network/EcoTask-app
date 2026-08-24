export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isNowInQuietHours(
  from: string,
  to: string,
  now = new Date(),
): boolean {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const f = parseTimeToMinutes(from);
  const tt = parseTimeToMinutes(to);

  if (f === tt) {
    return false; // empty quiet hours
  }

  if (f < tt) {
    // same day window
    return nowMin >= f && nowMin < tt;
  }

  // crossover: e.g., 22:00 -> 07:00
  return nowMin >= f || nowMin < tt;
}

export default { parseTimeToMinutes, isNowInQuietHours };
