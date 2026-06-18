import { useEffect, useCallback } from 'react';
import { useTaskStore } from '../store/taskStore';
import { fetchTasks } from '../services/api';

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

  const loadTasks = useCallback(
    async (pageNum: number = 1) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchTasks({
          page: pageNum,
          limit: 20,
          ...options,
        });
        if (pageNum === 1) {
          setTasks(result.tasks);
        } else {
          appendTasks(result.tasks);
        }
        setPage(pageNum);
        setHasMore(pageNum < result.totalPages);
      } catch (err: any) {
        setError(err.message || 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    },
    [options, setTasks, appendTasks, setLoading, setError, setPage, setHasMore],
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
