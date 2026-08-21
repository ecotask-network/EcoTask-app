import './__mocks__/rn-modules';
import './__mocks__/setup';
import React from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import Geolocation from '@react-native-community/geolocation';
import { useLocation } from '../hooks/useLocation';

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
      act(() => {
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

    let watchCallback: ((pos: any) => void) | null = null;
    const watchPositionMock = jest
      .spyOn(Geolocation, 'watchPosition')
      .mockImplementation(((success: (pos: any) => void) => {
        watchCallback = success;
        return 123;
      }) as any);

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
    act(() => {
      if (watchCallback) {
        watchCallback({
          coords: { latitude: 37.7749, longitude: -122.4194 },
        });
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
    let getCallback: ((pos: any) => void) | null = null;
    const getCurrentPositionMock = jest
      .spyOn(Geolocation, 'getCurrentPosition')
      .mockImplementation(((success: (pos: any) => void) => {
        getCallback = success;
      }) as any);

    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (hookRef = r)} />);
    });

    act(() => {
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

    act(() => {
      if (getCallback) {
        getCallback({
          coords: { latitude: 40.7128, longitude: -74.006 },
        });
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
      .mockImplementation(() => {});
    jest.spyOn(Geolocation, 'watchPosition').mockReturnValue(456 as any);

    await act(async () => {
      instance = renderer.create(<HookHarness onRef={r => (hookRef = r)} />);
    });

    act(() => {
      instance?.unmount();
      instance = null;
    });

    expect(clearWatchMock).toHaveBeenCalledWith(456);
  });
});
