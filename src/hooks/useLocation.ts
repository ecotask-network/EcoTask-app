import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { haversineDistance } from '../utils/geoUtils';

interface Location {
  lat: number;
  lng: number;
}

const MOVEMENT_THRESHOLD_KM = 0.05; // 50 metres

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAcceptedRef = useRef<Location | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = Geolocation.watchPosition(
      pos => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        if (lastAcceptedRef.current !== null) {
          const distanceKm = haversineDistance(
            lastAcceptedRef.current.lat,
            lastAcceptedRef.current.lng,
            next.lat,
            next.lng,
          );
          if (distanceKm < MOVEMENT_THRESHOLD_KM) {
            return;
          }
        }

        lastAcceptedRef.current = next;
        setLocation(next);
        setError(null);
      },
      err => setError(err.message),
      {
        enableHighAccuracy: false,
        distanceFilter: 0,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }, []);

  const requestPermission = useCallback(async () => {
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
    } catch (err: any) {
      setError(err.message);
    }
  }, [startWatch]);

  useEffect(() => {
    requestPermission();

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [requestPermission]);

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
      err => {
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return { location, permissionGranted, error, refresh };
}
