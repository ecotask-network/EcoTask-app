import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {
  Circle,
  Marker,
  Region,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

import { useTaskFeed } from '../hooks/useTaskFeed';
import { useLocation } from '../hooks/useLocation';
import { Task, TASK_TYPE_CONFIG } from '../types';
import { colors, spacing } from '../utils/theme';
import { useTaskStackNavigation } from '../navigation/useAppNavigation';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLUSTER_THRESHOLD = 10;
const DEFAULT_DELTA = 0.5; // degrees — city-level zoom

// World-centre fallback when location is unavailable
const WORLD_REGION: Region = {
  latitude: 10,
  longitude: 20,
  latitudeDelta: 100,
  longitudeDelta: 100,
};

// Radius options mirrored from TaskListScreen
const RADIUS_OPTIONS = [10, 25, 50, 100];

// ─── Clustering helpers ────────────────────────────────────────────────────────

interface ClusterOrMarker {
  id: string;
  lat: number;
  lng: number;
  /** null → single task; non-null → cluster */
  count: number | null;
  tasks: Task[];
}

/**
 * Very lightweight grid-based clustering:
 *  – bin tasks by rounded lat/lng at the chosen precision
 *  – groups within ~10 km at city zoom collapse into one pin
 *  – activated only when visible task count exceeds CLUSTER_THRESHOLD
 */
function clusterTasks(tasks: Task[], precision: number): ClusterOrMarker[] {
  if (tasks.length <= CLUSTER_THRESHOLD) {
    return tasks.map(t => ({
      id: t.id,
      lat: t.lat,
      lng: t.lng,
      count: null,
      tasks: [t],
    }));
  }

  const factor = Math.pow(10, precision);

  const buckets = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = `${Math.round(task.lat * factor)}_${Math.round(task.lng * factor)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(task);
    } else {
      buckets.set(key, [task]);
    }
  }

  return Array.from(buckets.values()).map(group => {
    const centroidLat = group.reduce((s, t) => s + t.lat, 0) / group.length;
    const centroidLng = group.reduce((s, t) => s + t.lng, 0) / group.length;
    const representative = group[0]!;
    return {
      id:
        group.length === 1
          ? representative.id
          : `cluster_${centroidLat}_${centroidLng}`,
      lat: centroidLat,
      lng: centroidLng,
      count: group.length > 1 ? group.length : null,
      tasks: group,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const navigation = useTaskStackNavigation();
  const { location } = useLocation();
  const [radiusKm, setRadiusKm] = useState(50);
  const [region, setRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const pendingRegionRef = useRef<Region | null>(null);

  const debouncedSetRegion = useCallback((nextRegion: Region) => {
    pendingRegionRef.current = nextRegion;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= 300) {
      setRegion(nextRegion);
      lastUpdateRef.current = now;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    } else {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        if (pendingRegionRef.current) {
          setRegion(pendingRegionRef.current);
          lastUpdateRef.current = Date.now();
        }
      }, 300 - timeSinceLastUpdate);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const { tasks, isLoading, error, refresh } = useTaskFeed({
    ...(location
      ? { lat: location.lat, lng: location.lng, radius: radiusKm }
      : {}),
  });

  // Fly to user location once it becomes available
  useEffect(() => {
    if (location && mapRef.current) {
      const next: Region = {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      };
      mapRef.current.animateToRegion(next, 600);
    }
  }, [location]);

  const precision = useMemo(() => {
    const delta = region?.latitudeDelta ?? DEFAULT_DELTA;
    return delta > 10 ? 0 : delta > 1 ? 1 : 2;
  }, [region?.latitudeDelta]);

  const clustered = useMemo(
    () => clusterTasks(tasks, precision),
    [tasks, precision],
  );

  const handleCalloutPress = useCallback(
    (task: Task) => {
      navigation.navigate('TaskDetail', { taskId: task.id });
    },
    [navigation],
  );

  // Capture the initial region once at mount time so the map doesn't
  // re-centre every time location updates (the animateToRegion effect
  // handles subsequent fly-tos).
  const initialRegionRef = useRef<Region>(
    location
      ? {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        }
      : WORLD_REGION,
  );

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        testID="map-view"
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegionRef.current}
        onRegionChangeComplete={debouncedSetRegion}
        showsUserLocation={!!location}
        showsMyLocationButton={false}
      >
        {/* Radius circle */}
        {location && (
          <Circle
            testID="radius-circle"
            center={{ latitude: location.lat, longitude: location.lng }}
            radius={radiusKm * 1000}
            strokeColor="rgba(34,197,94,0.6)"
            fillColor="rgba(34,197,94,0.08)"
            strokeWidth={1.5}
          />
        )}

        {/* Task markers / cluster markers */}
        {clustered.map(item => {
          const isCluster = item.count !== null;
          const firstTask = item.tasks[0];
          const label = isCluster
            ? String(item.count)
            : firstTask
              ? (TASK_TYPE_CONFIG[firstTask.type]?.icon ?? '📍')
              : '📍';

          return (
            <Marker
              key={item.id}
              testID={isCluster ? `cluster-${item.id}` : `marker-${item.id}`}
              coordinate={{ latitude: item.lat, longitude: item.lng }}
              title={
                isCluster
                  ? `${item.count} tasks here`
                  : (firstTask?.title ?? '')
              }
              description={
                isCluster
                  ? 'Zoom in to see individual tasks'
                  : firstTask
                    ? `${firstTask.rewardAmount} ${firstTask.rewardToken ?? 'ECO'}`
                    : ''
              }
              onCalloutPress={() => {
                if (!isCluster && firstTask) {
                  handleCalloutPress(firstTask);
                }
              }}
            >
              <MarkerPin label={label} isCluster={isCluster} />
            </Marker>
          );
        })}
      </MapView>

      {/* ── Header ── */}
      <View style={styles.header} pointerEvents="box-none">
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>🗺️ Discover Tasks</Text>
          {isLoading && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginLeft: spacing.sm }}
            />
          )}
          {error != null && (
            <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Radius filter ── */}
      <View style={styles.radiusRow} pointerEvents="box-none">
        <View style={styles.radiusPill}>
          {RADIUS_OPTIONS.map(km => (
            <TouchableOpacity
              key={km}
              testID={`radius-btn-${km}`}
              onPress={() => setRadiusKm(km)}
              style={[
                styles.radiusOpt,
                radiusKm === km && styles.radiusOptActive,
              ]}
            >
              <Text
                style={[
                  styles.radiusOptText,
                  radiusKm === km && styles.radiusOptTextActive,
                ]}
              >
                {km}km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Re-centre button ── */}
      {location && (
        <TouchableOpacity
          testID="recenter-btn"
          style={styles.recenterBtn}
          onPress={() => {
            mapRef.current?.animateToRegion(
              {
                latitude: location.lat,
                longitude: location.lng,
                latitudeDelta: DEFAULT_DELTA,
                longitudeDelta: DEFAULT_DELTA,
              },
              400,
            );
          }}
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* ── No-location fallback notice ── */}
      {!location && (
        <View style={styles.noLocationBanner} pointerEvents="none">
          <Text style={styles.noLocationText}>
            📍 Enable location to see tasks near you
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Marker pin sub-component ─────────────────────────────────────────────────

interface MarkerPinProps {
  label: string;
  isCluster: boolean;
}

function MarkerPin({ label, isCluster }: MarkerPinProps) {
  return (
    <View style={[styles.pin, isCluster && styles.pinCluster]}>
      <Text style={[styles.pinLabel, isCluster && styles.pinLabelCluster]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header overlay
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  retryBtn: {
    marginLeft: spacing.sm,
  },
  retryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  // Radius filter row
  radiusRow: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 96 : 72,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  radiusPill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  radiusOpt: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 18,
  },
  radiusOptActive: {
    backgroundColor: colors.primary,
  },
  radiusOptText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  radiusOptTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  // Re-centre button
  recenterBtn: {
    position: 'absolute',
    right: spacing.lg,
    bottom: Platform.OS === 'ios' ? 152 : 128,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  recenterIcon: {
    fontSize: 22,
    color: colors.primary,
  },
  // No-location banner
  noLocationBanner: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 152 : 128,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  noLocationText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  // Marker pin
  pin: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 3,
    minWidth: 32,
    alignItems: 'center',
  },
  pinCluster: {
    backgroundColor: colors.primaryDark,
    minWidth: 38,
  },
  pinLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  pinLabelCluster: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
