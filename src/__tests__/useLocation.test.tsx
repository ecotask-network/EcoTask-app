import './__mocks__/rn-modules';
import './__mocks__/setup';
import React from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import Geolocation from '@react-native-community/geolocation';
import { useLocation } from '../hooks/useLocation';

type GeolocationPosition = Parameters<
  Parameters<typeof Geolocation.watchPosition>[0]
>[0];

function makePosition(
  latitude: number,
  longitude: number,
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      altitude: null,
      accuracy: 0,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

function HookHarness({
  onRef,
}: {
  onRef: (ref: ReturnType<typeof useLocation>) => void;
}) {
  const hook = useLocation();
  React.useEffect(() => {
    onRef(hook);
  });
  return null;
}

describe('useLocation hook', () => {
  let instance: renderer.ReactTestRenderer | null = null;
  let hookRef: ReturnType<typeof useLocation>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (instance) {
      void act(() => {
        instance?.unmount();
      });
      instance = null;
    }
  });

  it('requests permission and starts watchPosition with distanceFilter: 50 on Android', async () => {
    Platform.OS = 'android';
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED!);

    let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
    const watchPositionMock = jest
      .spyOn(Geolocation, 'watchPosition')
      .mockImplementation(success => {
        watchCallback = success;
        return 123;
      });

    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (hookRef = r)} />);
    });

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    expect(watchPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        enableHighAccuracy: false,
        distanceFilter: 50,
      }),
    );

    expect(hookRef.permissionGranted).toBe(true);

    // Simulate position update
    void act(() => {
      if (watchCallback) {
        watchCallback(makePosition(37.7749, -122.4194));
      }
    });

    expect(hookRef.location).toEqual({
      lat: 37.7749,
      lng: -122.4194,
    });
    expect(hookRef.error).toBeNull();
  });

  it('handles permission denial gracefully on Android', async () => {
    Platform.OS = 'android';
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED!);

    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (hookRef = r)} />);
    });

    expect(hookRef.permissionGranted).toBe(false);
    expect(hookRef.error).toBe('Location permission denied');
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it('performs high-accuracy single fix on refresh()', async () => {
    Platform.OS = 'ios';
    let getCallback: ((pos: GeolocationPosition) => void) | null = null;
    const getCurrentPositionMock = jest
      .spyOn(Geolocation, 'getCurrentPosition')
      .mockImplementation(success => {
        getCallback = success;
      });

    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (hookRef = r)} />);
    });

    void act(() => {
      hookRef.refresh();
    });

    expect(getCurrentPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        enableHighAccuracy: true,
        timeout: 15000,
      }),
    );

    void act(() => {
      if (getCallback) {
        getCallback(makePosition(40.7128, -74.006));
      }
    });

    expect(hookRef.location).toEqual({
      lat: 40.7128,
      lng: -74.006,
    });
  });

  it('clears watchPosition on unmount', async () => {
    Platform.OS = 'ios';
    const clearWatchMock = jest
      .spyOn(Geolocation, 'clearWatch')
      .mockImplementation(() => undefined);
    jest.spyOn(Geolocation, 'watchPosition').mockReturnValue(456);

    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (hookRef = r)} />);
    });

    void act(() => {
      instance?.unmount();
      instance = null;
    });

    expect(clearWatchMock).toHaveBeenCalledWith(456);
  });
});
