import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useTaskStore } from '../store/taskStore';
import { fetchTasks } from '../services/api';
import { Task } from '../types';
import { TaskSortMode } from '../utils/sortTasks';
import { enrichTasksWithDistance } from '../utils/geoUtils';

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

        const normalize = (list: Task[]) =>
          location
            ? enrichTasksWithDistance(list, location.lat, location.lng)
            : list;

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

  useEffect(() => {
    void loadTasks(1);
  }, [loadTasks]);

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
