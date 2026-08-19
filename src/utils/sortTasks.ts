import { TaskStatus, TASK_STATUS_CONFIG } from '../types';

export type TaskSortMode = 'distance' | 'reward' | 'difficulty';

const DIFFICULTY_WEIGHT: Record<string, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export function filterTasksByQuery<
  T extends { title: string; description?: string },
>(tasks: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return tasks;
  }
  return tasks.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false),
  );
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected task status: ${String(value)}`);
}

export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'open':
      return TASK_STATUS_CONFIG.open.label;
    case 'active':
      return TASK_STATUS_CONFIG.active.label;
    case 'closed':
      return TASK_STATUS_CONFIG.closed.label;
    default:
      return assertNever(status);
  }
}

export function normalizeTaskStatus(status: unknown): TaskStatus {
  if (status === 'open' || status === 'active' || status === 'closed') {
    return status;
  }
  return 'open';
}

export function filterTasksByStatus<T extends { status: TaskStatus }>(
  tasks: T[],
  statuses: TaskStatus[],
): T[] {
  if (statuses.length === 0) {
    return tasks;
  }
  const allowed = new Set<TaskStatus>(statuses);
  return tasks.filter(task => allowed.has(task.status));
}

export function sortTasks<
  T extends {
    rewardAmount: number;
    distance?: number;
    difficulty?: string;
  },
>(tasks: T[], mode: TaskSortMode): T[] {
  const copy = [...tasks];
  switch (mode) {
    case 'reward':
      return copy.sort((a, b) => b.rewardAmount - a.rewardAmount);
    case 'difficulty':
      return copy.sort(
        (a, b) =>
          (DIFFICULTY_WEIGHT[a.difficulty ?? 'hard'] ?? 2) -
          (DIFFICULTY_WEIGHT[b.difficulty ?? 'hard'] ?? 2),
      );
    case 'distance':
    default:
      return copy.sort(
        (a, b) =>
          (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE),
      );
  }
}
