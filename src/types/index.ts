export type TaskStatus = 'open' | 'closed' | 'active';

export const TASK_STATUSES: TaskStatus[] = ['open', 'active', 'closed'];

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string }
> = {
  open: { label: 'Open', color: '#22C55E' },
  active: { label: 'Active', color: '#3B82F6' },
  closed: { label: 'Closed', color: '#6B7280' },
};

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  rewardAmount: number;
  rewardToken?: string;
  lat: number;
  lng: number;
  status: TaskStatus;
  distance?: number;
  instructions?: string;
  difficulty?: TaskDifficulty;
  estimatedMinutes?: number;
}

export type TaskType =
  | 'TREE_PLANTING'
  | 'TRASH_COLLECTION'
  | 'OCEAN_CLEANUP'
  | 'GARDENING'
  | 'EDUCATION'
  | 'OTHER';

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_CONFIG: Record<
  TaskDifficulty,
  { icon: string; label: string; color: string }
> = {
  easy: { icon: '🌱', label: 'Easy', color: '#22C55E' },
  medium: { icon: '🌿', label: 'Medium', color: '#F59E0B' },
  hard: { icon: '🏔️', label: 'Hard', color: '#EF4444' },
};

export interface UserStats {
  treesPlanted: number;
  plasticCollected: number;
  co2Reduced: number;
}

export interface UserProfile {
  id: string;
  wallet: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  stats: UserStats;
}

export interface Activity {
  id: string;
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  rewardAmount: number;
  rewardToken: string;
  completedAt: string;
  status: 'confirmed' | 'pending' | 'failed';
  /** ID returned by the backend after a successful proof POST; used for status polling. */
  proofId?: string;
}

export interface PendingProof {
  id: string;
  taskId: string;
  photoPath: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  capturedAt: string;
  photoCid?: string;
  metadataCid?: string;
}

export interface SubmitProofParams {
  taskId: string;
  taskTitle?: string;
  taskType?: TaskType;
  rewardAmount?: number;
  rewardToken?: string;
}

export interface SubmitProofResult {
  taskTitle?: string;
  taskType?: TaskType;
  rewardAmount?: number;
  rewardToken?: string;
  /** ID returned by the backend after a successful proof POST; used for status polling. */
  proofId?: string;
}

export const TASK_TYPE_CONFIG: Record<
  TaskType,
  { icon: string; label: string }
> = {
  TREE_PLANTING: { icon: '🌳', label: 'Trees' },
  TRASH_COLLECTION: { icon: '♻️', label: 'Trash' },
  OCEAN_CLEANUP: { icon: '🌊', label: 'Ocean' },
  GARDENING: { icon: '🌱', label: 'Garden' },
  EDUCATION: { icon: '📚', label: 'Learn' },
  OTHER: { icon: '📍', label: 'Other' },
};

export interface ImpactContribution {
  treesPlanted?: number;
  plasticCollected?: number;
  co2Reduced?: number;
}

export const IMPACT_BY_TASK_TYPE: Record<TaskType, ImpactContribution> = {
  TREE_PLANTING: { treesPlanted: 1, co2Reduced: 2 },
  TRASH_COLLECTION: { plasticCollected: 2, co2Reduced: 1 },
  OCEAN_CLEANUP: { plasticCollected: 3, co2Reduced: 1 },
  GARDENING: { co2Reduced: 2 },
  EDUCATION: { co2Reduced: 1 },
  OTHER: { co2Reduced: 1 },
};
