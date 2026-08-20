import { useState, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

interface Location {
  lat: number;
  lng: number;
}

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!,
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
    // Continuous watch – low power with native 50m distanceFilter
    watchIdRef.current = Geolocation.watchPosition(
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
      {
        enableHighAccuracy: false, // battery-friendly continuous watch
        distanceFilter: 50, // delegate 50m movement filtering to native GPS pipeline
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
