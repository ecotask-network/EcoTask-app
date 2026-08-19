import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { haversineDistance } from '../utils/geoUtils';

interface Location {
  lat: number;
  lng: number;
}

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<Location | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    clearWatch();

    watchIdRef.current = Geolocation.watchPosition(
      pos => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;

        if (lastLocationRef.current) {
          const dist = haversineDistance(
            lastLocationRef.current.lat,
            lastLocationRef.current.lng,
            newLat,
            newLng
          );
          // Only update if distance is >= 50m (0.05km)
          if (dist < 0.05) {
            return;
          }
        }

        const newLoc = { lat: newLat, lng: newLng };
        lastLocationRef.current = newLoc;
        setLocation(newLoc);
        setError(null);
      },
      err => {
        setError(err.message);
      },
      { enableHighAccuracy: true, distanceFilter: 0 }
    );
  }, [clearWatch]);

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
      clearWatch();
    };
  }, [requestPermission, clearWatch]);

  const refresh = useCallback(() => {
    Geolocation.getCurrentPosition(
      pos => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        lastLocationRef.current = newLoc;
        setLocation(newLoc);
        setError(null);
      },
      err => {
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  return { location, permissionGranted, error, refresh };
}
