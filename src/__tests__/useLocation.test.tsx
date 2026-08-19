import React from 'react';
import { create, act } from 'react-test-renderer';
import { useLocation } from '../hooks/useLocation';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { haversineDistance } from '../utils/geoUtils';

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('../utils/geoUtils', () => ({
  haversineDistance: jest.fn(),
}));

describe('useLocation hook', () => {
  let hookResult: ReturnType<typeof useLocation>;
  let component: any;

  function TestComponent() {
    hookResult = useLocation();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    (PermissionsAndroid.request as jest.Mock) = jest.fn();
    (Geolocation.watchPosition as jest.Mock) = jest.fn().mockReturnValue(123);
  });

  afterEach(() => {
    if (component) {
      act(() => {
        component.unmount();
      });
      component = null;
    }
  });

  const renderHook = async () => {
    await act(async () => {
      component = create(<TestComponent />);
    });
  };

  it('1. should request permission on mount (Android granted) and start watch', async () => {
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
      PermissionsAndroid.RESULTS.GRANTED,
    );

    await renderHook();

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    expect(hookResult.permissionGranted).toBe(true);
    expect(hookResult.error).toBeNull();
    expect(Geolocation.watchPosition).toHaveBeenCalled();
  });

  it('2. should set error when permission denied (Android)', async () => {
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
      PermissionsAndroid.RESULTS.DENIED,
    );

    await renderHook();

    expect(hookResult.permissionGranted).toBe(false);
    expect(hookResult.error).toBe('Location permission denied');
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it('3. should handle permission request error (Android)', async () => {
    (PermissionsAndroid.request as jest.Mock).mockRejectedValue(
      new Error('Permission error'),
    );

    await renderHook();

    expect(hookResult.permissionGranted).toBe(false);
    expect(hookResult.error).toBe('Permission error');
  });

  it('4. should skip PermissionsAndroid on iOS and just start watch', async () => {
    Platform.OS = 'ios';

    await renderHook();

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(hookResult.permissionGranted).toBe(true);
    expect(Geolocation.watchPosition).toHaveBeenCalled();
  });

  it('5. should start watchPosition and update location on success', async () => {
    Platform.OS = 'ios';
    (Geolocation.watchPosition as jest.Mock).mockImplementation(success => {
      success({ coords: { latitude: 10, longitude: 20 } });
      return 123;
    });

    await renderHook();

    expect(hookResult.location).toEqual({ lat: 10, lng: 20 });
    expect(hookResult.error).toBeNull();
  });

  it('6. should update location only if distance >= 50m (Haversine filter accepts)', async () => {
    Platform.OS = 'ios';
    let successCallback: any;
    (Geolocation.watchPosition as jest.Mock).mockImplementation(success => {
      successCallback = success;
      return 123;
    });
    (haversineDistance as jest.Mock).mockReturnValue(0.06); // 60m

    await renderHook();

    // First location
    act(() => {
      successCallback({ coords: { latitude: 10, longitude: 20 } });
    });
    expect(hookResult.location).toEqual({ lat: 10, lng: 20 });

    // Second location > 50m
    act(() => {
      successCallback({ coords: { latitude: 10.001, longitude: 20.001 } });
    });

    expect(haversineDistance).toHaveBeenCalledWith(10, 20, 10.001, 20.001);
    expect(hookResult.location).toEqual({ lat: 10.001, lng: 20.001 });
  });

  it('7. should not update location if distance < 50m (Haversine filter rejects)', async () => {
    Platform.OS = 'ios';
    let successCallback: any;
    (Geolocation.watchPosition as jest.Mock).mockImplementation(success => {
      successCallback = success;
      return 123;
    });
    (haversineDistance as jest.Mock).mockReturnValue(0.04); // 40m

    await renderHook();

    // First location
    act(() => {
      successCallback({ coords: { latitude: 10, longitude: 20 } });
    });
    expect(hookResult.location).toEqual({ lat: 10, lng: 20 });

    // Second location < 50m
    act(() => {
      successCallback({ coords: { latitude: 10.0001, longitude: 20.0001 } });
    });

    expect(hookResult.location).toEqual({ lat: 10, lng: 20 }); // unchanged
  });

  it('8. should set error if watchPosition fails', async () => {
    Platform.OS = 'ios';
    (Geolocation.watchPosition as jest.Mock).mockImplementation((_, error) => {
      error(new Error('Watch error'));
      return 123;
    });

    await renderHook();

    expect(hookResult.error).toBe('Watch error');
  });

  it('9. should call clearWatch on unmount', async () => {
    Platform.OS = 'ios';
    await renderHook();

    act(() => {
      component.unmount();
    });
    component = null;

    expect(Geolocation.clearWatch).toHaveBeenCalledWith(123);
  });

  it('10. should clear previous watch when startWatch is called again', async () => {
    Platform.OS = 'ios';
    await renderHook();

    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
    act(() => {
      component.unmount();
    });
    component = null;
    expect(Geolocation.clearWatch).toHaveBeenCalled();
  });

  it('11. refresh() should call getCurrentPosition with enableHighAccuracy', async () => {
    Platform.OS = 'ios';
    await renderHook();

    act(() => {
      hookResult.refresh();
    });

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });

  it('12. refresh() should update location on success', async () => {
    Platform.OS = 'ios';
    await renderHook();

    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      success => {
        success({ coords: { latitude: 30, longitude: 40 } });
      },
    );

    act(() => {
      hookResult.refresh();
    });

    expect(hookResult.location).toEqual({ lat: 30, lng: 40 });
    expect(hookResult.error).toBeNull();
  });

  it('13. refresh() should set error on failure', async () => {
    Platform.OS = 'ios';
    await renderHook();

    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      (_, error) => {
        error(new Error('Refresh error'));
      },
    );

    act(() => {
      hookResult.refresh();
    });

    expect(hookResult.error).toBe('Refresh error');
  });
});
