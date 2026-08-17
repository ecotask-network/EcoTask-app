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
      partialize: state => ({ tasks: state.tasks }),
    },
  ),
);
