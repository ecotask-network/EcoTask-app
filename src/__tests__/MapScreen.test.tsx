/**
 * MapScreen.test.tsx
 *
 * Tests:
 *  1. renders without location (world-view fallback + banner)
 *  2. renders task markers when tasks are provided
 *  3. renders a radius circle when location is available
 *  4. cluster marker appears when > 10 distinct tasks are provided
 *  5. callout press on a single-task marker navigates to TaskDetail
 */

import React, {
  forwardRef as mockForwardRef,
  useImperativeHandle as mockUseImperativeHandle,
} from 'react';
import { View as MockView } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

// react-native-maps has native code; swap every export for a plain View/mock.
// (`mock`-prefixed imports rather than plain ones: jest.mock factories may
// only reference out-of-scope variables whose name starts with "mock".)
jest.mock('react-native-maps', () => {
  const MapView = mockForwardRef<
    MockMapViewRef,
    { children?: React.ReactNode; testID?: string }
  >((props, ref) => {
    // Expose animateToRegion on the ref so the component doesn't crash
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
      {/* Simulate a "callout press" button so tests can trigger it */}
      <MockView
        testID={`callout-${testID}`}
        accessible
        accessibilityRole="button"
        // Store the handler so tests can invoke it directly
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

// Navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// useLocation
const mockUseLocation = jest.fn();
jest.mock('../hooks/useLocation', () => ({
  useLocation: () => mockUseLocation(),
}));

// useTaskFeed
const mockUseTaskFeed = jest.fn();
jest.mock('../hooks/useTaskFeed', () => ({
  useTaskFeed: () => mockUseTaskFeed(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { Task } from '../types';

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

// ─── Import component (after mocks) ──────────────────────────────────────────

import MapScreen from '../screens/MapScreen';

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MapScreen — no location', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      location: null,
      permissionGranted: false,
      error: null,
      refresh: jest.fn(),
    });
    defaultFeed([]);
  });

  it('renders the map view', () => {
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });
    const json = tree!.toJSON();
    expect(json).toBeTruthy();
  });

  it('shows the no-location banner', () => {
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Enable location to see tasks near you');
  });

  it('does NOT render a radius circle', () => {
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).not.toContain('"radius-circle"');
  });
});

describe('MapScreen — with location and tasks', () => {
  const userLat = 51.5;
  const userLng = -0.1;

  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      location: { lat: userLat, lng: userLng },
      permissionGranted: true,
      error: null,
      refresh: jest.fn(),
    });
  });

  it('renders a radius circle matching the active filter', () => {
    defaultFeed([]);
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('"radius-circle"');
  });

  it('renders one marker per task when count <= 10', () => {
    const tasks = [makeTask('a', 51.5, -0.1), makeTask('b', 51.6, -0.2)];
    defaultFeed(tasks);
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('"marker-a"');
    expect(json).toContain('"marker-b"');
  });

  it('does NOT show the no-location banner', () => {
    defaultFeed([]);
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).not.toContain('Enable location');
  });

  it('clusters markers when more than 10 tasks are visible', () => {
    // 12 tasks at the same coarse grid bucket → should collapse to 1 cluster
    const clusteredTasks = Array.from({ length: 12 }, (_, i) =>
      makeTask(String(i), 51.5 + i * 0.0001, -0.1 + i * 0.0001),
    );
    defaultFeed(clusteredTasks);
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });
    const json = JSON.stringify(tree!.toJSON());
    // Individual marker IDs (0–11) should NOT appear; cluster IDs should
    expect(json).not.toContain('"marker-0"');
    // testID for clusters is "cluster-cluster_<lat>_<lng>"
    expect(json).toContain('"cluster-cluster_');
  });

  it('navigates to TaskDetail when callout is pressed on a single-task marker', () => {
    const task = makeTask('task-1', 51.5, -0.1);
    defaultFeed([task]);
    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(<MapScreen />);
    });

    // Find the Marker component and invoke onCalloutPress directly
    const markerNode = tree!.root.findAll(
      n => n.props.testID === 'marker-task-1',
    );
    expect(markerNode.length).toBeGreaterThan(0);
    void act(() => {
      markerNode[0]!.props.onCalloutPress?.();
    });

    expect(mockNavigate).toHaveBeenCalledWith('TaskDetail', {
      taskId: 'task-1',
    });
  });
});
