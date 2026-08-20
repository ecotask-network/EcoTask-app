import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useTaskStore } from '../store/taskStore';
import { fetchTasks } from '../services/api';
import { Task } from '../types';
import { TaskSortMode } from '../utils/sortTasks';
import { enrichTasksWithDistance } from '../utils/geoUtils';
import { normalizeTaskStatus } from '../utils/sortTasks';

const LOCATION_DEBOUNCE_MS = 5000;

interface UseTaskFeedOptions {
  type?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  sort?: TaskSortMode;
}

export function useTaskFeed(options: UseTaskFeedOptions = {}) {
  const { type, lat, lng, radius } = options;

  const {
    tasks,
    isLoading,
    error,
    page,
    hasMore,
    setTasks,
    appendTasks,
    setLoading,
    setError,
    setPage,
    setHasMore,
  } = useTaskStore();

  // Keep a ref to the latest tasks so the initial-load effect can decide
  // whether a fetch is actually needed without re-running on every store update.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const serverParams = useMemo(() => ({ type, radius }), [type, radius]);

  const hasLocation = lat !== undefined && lng !== undefined;
  const locationRef = useRef({ lat, lng });
  locationRef.current = { lat, lng };
  const lastFetchLocationRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );

  const loadTasks = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = {
          page: pageNum,
          limit: 20,
        };
        if (serverParams.type) {
          params.type = serverParams.type;
        }

        const loc = locationRef.current;
        const location =
          loc.lat !== undefined && loc.lng !== undefined
            ? { lat: loc.lat, lng: loc.lng }
            : null;
        if (location) {
          params.lat = location.lat;
          params.lng = location.lng;
          if (serverParams.radius !== undefined) {
            params.radius = serverParams.radius;
          }
          lastFetchLocationRef.current = location;
        } else {
          lastFetchLocationRef.current = null;
        }

        const result = await fetchTasks(params);

        const normalize = (list: Task[]): Task[] => {
          const withStatus = list.map(task => ({
            ...task,
            status: normalizeTaskStatus(task.status),
          }));
          return location
            ? enrichTasksWithDistance(withStatus, location.lat, location.lng)
            : withStatus;
        };

        if (pageNum === 1) {
          setTasks(normalize(result.tasks));
        } else {
          appendTasks(normalize(result.tasks));
        }
        setPage(pageNum);
        setHasMore(pageNum < result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    },
    [
      serverParams,
      setTasks,
      appendTasks,
      setLoading,
      setError,
      setPage,
      setHasMore,
    ],
  );

  const refresh = useCallback(() => loadTasks(1), [loadTasks]);
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      void loadTasks(page + 1);
    }
  }, [isLoading, hasMore, page, loadTasks]);

  // Initial load: runs exactly once on mount. Only fetch when the persisted
  // store has no tasks yet (tasks survive across sessions via MMKV), so we
  // don't burn a network request re-fetching data we already hold.
  useEffect(() => {
    if (tasksRef.current.length === 0) {
      void loadTasks(1);
    } else if (hasLocation) {
      // Tasks already present: record the current location as "already
      // fetched" so the debounced location effect doesn't immediately
      // re-fetch on mount.
      lastFetchLocationRef.current = { lat: lat as number, lng: lng as number };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter change: re-fetch exactly once whenever the filter (type/radius)
  // actually changes. The first run (mount) is skipped because the initial
  // load effect above already owns mount-time fetching.
  const skipFirstFilterRun = useRef(true);
  useEffect(() => {
    if (skipFirstFilterRun.current) {
      skipFirstFilterRun.current = false;
      return;
    }
    void loadTasks(1);
  }, [serverParams, loadTasks]);

  const currentLocation = useMemo(
    () => (hasLocation ? { lat: lat as number, lng: lng as number } : null),
    [hasLocation, lat, lng],
  );

  useEffect(() => {
    if (!currentLocation) {
      return;
    }
    const timer = setTimeout(() => {
      const last = lastFetchLocationRef.current;
      if (
        last &&
        last.lat === currentLocation.lat &&
        last.lng === currentLocation.lng
      ) {
        return;
      }
      void loadTasks(1);
    }, LOCATION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [currentLocation, loadTasks]);

  return { tasks, isLoading, error, hasMore, refresh, loadMore };
}
