import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { Task } from '../types';

const storage = new MMKV({ id: 'task-storage' });
const zustandMMKVStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

/** Must match the page size used by useTaskFeed when fetching tasks. */
export const TASK_PAGE_SIZE = 20;

export interface PersistedTaskSlice {
  tasks: Task[];
  selectedTask: Task | null;
  selectedAt: string | null;
  page: number;
  hasMore: boolean;
}

interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  /** ISO timestamp of when selectedTask was set, used to gate the Submit tab shortcut. */
  selectedAt: string | null;
  isLoading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  setTasks: (tasks: Task[]) => void;
  appendTasks: (tasks: Task[]) => void;
  selectTask: (task: Task | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  reset: () => void;
}

/** Fields written to MMKV — excludes transient isLoading / error. */
export function partializeTaskState(
  state: Pick<
    TaskState,
    'tasks' | 'selectedTask' | 'selectedAt' | 'page' | 'hasMore'
  >,
): PersistedTaskSlice {
  return {
    tasks: state.tasks,
    selectedTask: state.selectedTask,
    selectedAt: state.selectedAt,
    page: state.page,
    hasMore: state.hasMore,
  };
}

/**
 * Validates persisted task state after rehydration.
 * - Drops selectedTask (and selectedAt) when its id is not in tasks.
 * - Aligns page / hasMore with the persisted task count to avoid pagination gaps/dupes.
 */
export function sanitizePersistedTaskState(
  persisted: unknown,
): PersistedTaskSlice {
  const p =
    persisted && typeof persisted === 'object'
      ? (persisted as Partial<PersistedTaskSlice>)
      : {};

  const tasks = Array.isArray(p.tasks) ? p.tasks : [];

  let selectedTask: Task | null = null;
  let selectedAt: string | null = null;
  if (p.selectedTask && typeof p.selectedTask === 'object') {
    const match = tasks.find(t => t?.id === p.selectedTask!.id);
    if (match) {
      selectedTask = match;
      selectedAt =
        typeof p.selectedAt === 'string' && p.selectedAt.length > 0
          ? p.selectedAt
          : null;
    }
  }

  if (tasks.length === 0) {
    return {
      tasks,
      selectedTask: null,
      selectedAt: null,
      page: 1,
      hasMore: true,
    };
  }

  const pagesFromCount = Math.max(1, Math.ceil(tasks.length / TASK_PAGE_SIZE));
  const isPartialLastPage = tasks.length % TASK_PAGE_SIZE !== 0;

  // Align page to how many pages the task array actually represents so
  // loadMore continues from the end and stale high values cannot skip ahead.
  const page = pagesFromCount;

  let hasMore = typeof p.hasMore === 'boolean' ? p.hasMore : true;
  if (isPartialLastPage) {
    // A non-full final page means the server has no further pages.
    hasMore = false;
  }

  return { tasks, selectedTask, selectedAt, page, hasMore };
}

export const useTaskStore = create<TaskState>()(
  persist(
    set => ({
      tasks: [],
      selectedTask: null,
      selectedAt: null,
      isLoading: false,
      error: null,
      page: 1,
      hasMore: true,
      setTasks: tasks => set({ tasks }),
      appendTasks: tasks =>
        set(s => ({
          tasks: [
            ...s.tasks,
            ...tasks.filter(
              t => !s.tasks.some(existing => existing.id === t.id),
            ),
          ],
        })),
      selectTask: task =>
        set({
          selectedTask: task,
          selectedAt: task ? new Date().toISOString() : null,
        }),
      setLoading: isLoading => set({ isLoading }),
      setError: error => set({ error }),
      setPage: page => set({ page }),
      setHasMore: hasMore => set({ hasMore }),
      reset: () => set({ tasks: [], page: 1, hasMore: true, error: null }),
    }),
    {
      name: 'task-storage',
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state): PersistedTaskSlice => partializeTaskState(state),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedTaskState(persistedState),
      }),
    },
  ),
);
