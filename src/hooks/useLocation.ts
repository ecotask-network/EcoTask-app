import { useState, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

interface Location {
  lat: number;
  lng: number;
}

const MOVEMENT_THRESHOLD_KM = 0.05; // 50 metres

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep last accepted position so we can apply the 50 m Haversine filter
  const lastAcceptedRef = useRef<Location | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    void requestPermission();

    return () => {
      // Acceptance: clear watcher on unmount
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestPermission() {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Location permission denied');
          return;
        }
      }
      setPermissionGranted(true);
      startWatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location error');
    }
  }

  function startWatch() {
    // Continuous watch – low power (enableHighAccuracy: false)
    watchIdRef.current = Geolocation.watchPosition(
      pos => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        // Only update state when movement > 50 m
        if (lastAcceptedRef.current !== null) {
          const distanceKm = haversineDistance(
            lastAcceptedRef.current.lat,
            lastAcceptedRef.current.lng,
            next.lat,
            next.lng,
          );
          if (distanceKm < MOVEMENT_THRESHOLD_KM) {
            return; // ignore small movement / GPS noise
          }
        }

        lastAcceptedRef.current = next;
        setLocation(next);
        setError(null);
      },
      err => setError(err.message),
      {
        enableHighAccuracy: false, // battery-friendly continuous watch
        distanceFilter: 0, // we do the 50 m filter ourselves
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }

  // On-demand high-accuracy single fix (acceptance criteria)
  function refresh() {
    Geolocation.getCurrentPosition(
      pos => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        lastAcceptedRef.current = next;
        setLocation(next);
        setError(null);
      },
      err => setError(err.message),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  // Return shape is unchanged
  return { location, permissionGranted, error, refresh };
}
