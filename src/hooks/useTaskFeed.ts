import { useEffect, useCallback, useMemo } from 'react';
import { useTaskStore } from '../store/taskStore';
import { fetchTasks } from '../services/api';
import { Task } from '../types';
import { enrichTasksWithDistance } from '../utils/geoUtils';
import { normalizeTaskStatus } from '../utils/sortTasks';

interface UseTaskFeedOptions {
  type?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

export function useTaskFeed(options: UseTaskFeedOptions = {}) {
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

  const { type, lat, lng, radius } = options;
  const query = useMemo(
    () => ({ type, lat, lng, radius }),
    [type, lat, lng, radius],
  );

  const loadTasks = useCallback(
    async (pageNum: number = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = { page: pageNum, limit: 20 };
        if (query.type) {
          params.type = query.type;
        }
        if (query.lat !== undefined && query.lng !== undefined) {
          params.lat = query.lat;
          params.lng = query.lng;
          if (query.radius !== undefined) {
            params.radius = query.radius;
          }
        }

        const result = await fetchTasks(params);

        const withLocation = query.lat !== undefined && query.lng !== undefined;
        const normalize = (list: Task[]): Task[] => {
          const withStatus = list.map(task => ({
            ...task,
            status: normalizeTaskStatus(task.status),
          }));
          if (
            withLocation &&
            query.lat !== undefined &&
            query.lng !== undefined
          ) {
            return enrichTasksWithDistance(withStatus, query.lat, query.lng);
          }
          return withStatus;
        };

        if (pageNum === 1) {
          setTasks(normalize(result.tasks));
        } else {
          appendTasks(normalize(result.tasks));
        }
        setPage(pageNum);
        setHasMore(pageNum < result.totalPages);
      } catch (err: any) {
        setError(err.message || 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    },
    [query, setTasks, appendTasks, setLoading, setError, setPage, setHasMore],
  );

  const refresh = useCallback(() => loadTasks(1), [loadTasks]);
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadTasks(page + 1);
    }
  }, [isLoading, hasMore, page, loadTasks]);

  useEffect(() => {
    loadTasks(1);
  }, [loadTasks]);

  return { tasks, isLoading, error, hasMore, refresh, loadMore };
}
