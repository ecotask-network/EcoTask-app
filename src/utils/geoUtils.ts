const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

export function isWithinRadius(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusKm: number,
): boolean {
  return haversineDistance(userLat, userLng, targetLat, targetLng) <= radiusKm;
}

export function enrichTasksWithDistance<
  T extends {
    lat?: number;
    lng?: number;
    distance?: number;
  },
>(tasks: T[], userLat: number, userLng: number): (T & { distance?: number })[] {
  return tasks
    .map(task => {
      if (
        task.distance !== undefined ||
        task.lat === undefined ||
        task.lng === undefined
      ) {
        return task;
      }
      return {
        ...task,
        distance: haversineDistance(userLat, userLng, task.lat, task.lng),
      };
    })
    .sort(
      (a, b) =>
        (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE),
    );
}
