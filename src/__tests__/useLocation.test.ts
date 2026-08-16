import { renderHook, act } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { useLocation } from '../hooks/useLocation';

// Ensure mocks are loaded
jest.mock('@react-native-community/geolocation');

describe('useLocation', () => {
  let watchCallback: (pos: any) => void;
  let watchErrorCallback: (err: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the success/error callbacks passed to watchPosition
    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (success, error) => {
        watchCallback = success;
        watchErrorCallback = error;
        return 42; // fake watchId
      },
    );

    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      (success) => {
        success({
          coords: { latitude: 6.5244, longitude: 3.3792 },
        });
      },
    );
  });

  it('establishes watchPosition on mount and clears it on unmount', () => {
    const { unmount } = renderHook(() => useLocation());

    expect(Geolocation.watchPosition).toHaveBeenCalled();

    unmount();

    expect(Geolocation.clearWatch).toHaveBeenCalledWith(42);
  });

  it('updates location only when movement exceeds 50 metres', () => {
    const { result } = renderHook(() => useLocation());

    // First position (accepted)
    act(() => {
      watchCallback({
        coords: { latitude: 6.5244, longitude: 3.3792 },
      });
    });

    expect(result.current.location).toEqual({
      lat: 6.5244,
      lng: 3.3792,
    });

    // Second position \~10 m away (should be ignored)
    act(() => {
      watchCallback({
        coords: { latitude: 6.5245, longitude: 3.3792 },
      });
    });

    // Still the original location
    expect(result.current.location).toEqual({
      lat: 6.5244,
      lng: 3.3792,
    });

    // Third position \~100 m away (should be accepted)
    act(() => {
      watchCallback({
        coords: { latitude: 6.5253, longitude: 3.3792 },
      });
    });

    expect(result.current.location).toEqual({
      lat: 6.5253,
      lng: 3.3792,
    });
  });

  it('refresh() triggers a high-accuracy single fix', () => {
    const { result } = renderHook(() => useLocation());

    act(() => {
      result.current.refresh();
    });

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );
  });
});
