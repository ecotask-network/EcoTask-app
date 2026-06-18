import { create } from 'zustand';

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  rewardAmount: number;
  lat: number;
  lng: number;
  status: string;
  distance?: number;
}

interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
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

export const useTaskStore = create<TaskState>(set => ({
  tasks: [],
  selectedTask: null,
  isLoading: false,
  error: null,
  page: 1,
  hasMore: true,
  setTasks: tasks => set({ tasks }),
  appendTasks: tasks => set(s => ({ tasks: [...s.tasks, ...tasks] })),
  selectTask: task => set({ selectedTask: task }),
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),
  setPage: page => set({ page }),
  setHasMore: hasMore => set({ hasMore }),
  reset: () => set({ tasks: [], page: 1, hasMore: true, error: null }),
}));
