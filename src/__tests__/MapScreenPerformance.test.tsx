import React, {
  forwardRef as mockForwardRef,
  useImperativeHandle as mockUseImperativeHandle,
} from 'react';
import { View as MockView } from 'react-native';
import renderer, { act } from 'react-test-renderer';

interface MockMapViewRef {
  animateToRegion: (region: unknown, duration?: number) => void;
}

interface MockMarkerProps {
  children?: React.ReactNode;
  testID?: string;
  title?: string;
  description?: string;
  onCalloutPress?: () => void;
}

jest.mock('react-native-maps', () => {
  const MapView = mockForwardRef<
    MockMapViewRef,
    {
      children?: React.ReactNode;
      testID?: string;
      onRegionChangeComplete?: (region: unknown) => void;
    }
  >((props, ref) => {
    mockUseImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
    }));
    return (
      <MockView testID={props.testID ?? 'map-view'}>{props.children}</MockView>
    );
  });

  const Marker = ({
    children,
    testID,
    title,
    description,
    onCalloutPress,
  }: MockMarkerProps) => (
    <MockView testID={testID}>
      {children}
      <MockView
        testID={`callout-${testID}`}
        accessible
        accessibilityRole="button"
        onStartShouldSetResponder={() => {
          onCalloutPress?.();
          return false;
        }}
      />
      <MockView testID={`callout-title-${testID}`}>{title}</MockView>
      <MockView testID={`callout-desc-${testID}`}>{description}</MockView>
    </MockView>
  );

  const Circle = ({ testID }: { testID?: string }) => (
    <MockView testID={testID ?? 'circle'} />
  );

  return {
    __esModule: true,
    default: MapView,
    Marker,
    Circle,
    PROVIDER_GOOGLE: 'google',
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseLocation = jest.fn();
jest.mock('../hooks/useLocation', () => ({
  useLocation: () => mockUseLocation(),
}));

const mockUseTaskFeed = jest.fn();
jest.mock('../hooks/useTaskFeed', () => ({
  useTaskFeed: () => mockUseTaskFeed(),
}));

import { Task } from '../types';
import MapScreen from '../screens/MapScreen';

function makeTask(id: string, lat = 0, lng = 0): Task {
  return {
    id,
    title: `Task ${id}`,
    description: 'desc',
    type: 'TREE_PLANTING',
    rewardAmount: 10,
    rewardToken: 'ECO',
    lat,
    lng,
    status: 'open',
  };
}

function defaultFeed(tasks: Task[] = []) {
  mockUseTaskFeed.mockReturnValue({
    tasks,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  });
}

describe('MapScreen Performance - Clustering and Region Throttling', () => {
  const userLat = 51.5;
  const userLng = -0.1;
  let clusteredTasks: Task[];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockUseLocation.mockReturnValue({
      location: { lat: userLat, lng: userLng },
      permissionGranted: true,
      error: null,
      refresh: jest.fn(),
    });

    // Space tasks out by 0.02 degrees so they cluster at precision 0 but uncluster at precision 2
    clusteredTasks = Array.from({ length: 12 }, (_, i) =>
      makeTask(String(i), 51.5 + i * 0.02, -0.1 + i * 0.02),
    );
    defaultFeed(clusteredTasks);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throttles rapid region changes and applies the final change at the trailing edge', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<MapScreen />);
    });

    const mapView = tree!.root.findByProps({ testID: 'map-view' });

    const regionZoomedOut = {
      latitude: 51.5,
      longitude: -0.1,
      latitudeDelta: 20,
      longitudeDelta: 20,
    };

    act(() => {
      mapView.props.onRegionChangeComplete(regionZoomedOut);
    });

    let jsonStr = JSON.stringify(tree!.toJSON());
    expect(jsonStr).toContain('cluster-cluster_');
    expect(jsonStr).not.toContain('marker-0');

    const regionZoomedIn = {
      latitude: 51.5,
      longitude: -0.1,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    act(() => {
      jest.advanceTimersByTime(50);
      mapView.props.onRegionChangeComplete(regionZoomedIn);
    });

    jsonStr = JSON.stringify(tree!.toJSON());
    expect(jsonStr).toContain('cluster-cluster_');
    expect(jsonStr).not.toContain('marker-0');

    const regionZoomedInEvenMore = {
      latitude: 51.5,
      longitude: -0.1,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };

    act(() => {
      jest.advanceTimersByTime(100);
      mapView.props.onRegionChangeComplete(regionZoomedInEvenMore);
    });

    jsonStr = JSON.stringify(tree!.toJSON());
    expect(jsonStr).toContain('cluster-cluster_');
    expect(jsonStr).not.toContain('marker-0');

    act(() => {
      jest.advanceTimersByTime(150);
    });

    jsonStr = JSON.stringify(tree!.toJSON());
    expect(jsonStr).not.toContain('cluster-cluster_');
    expect(jsonStr).toContain('marker-0');
  });
});
