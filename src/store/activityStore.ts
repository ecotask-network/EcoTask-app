import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { Activity } from '../types';
import { computeBestStreak, computeCurrentStreak } from '../utils/streaks';

const storage = new MMKV({ id: 'activity-storage' });
const zustandMMKVStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface ActivityState {
  activities: Activity[];
  streak: number;
  bestStreak: number;
  addActivity: (activity: Activity) => void;
  /** Patch the status (and optionally rewardAmount) of a single activity by id. */
  updateActivityStatus: (
    id: string,
    status: Activity['status'],
    rewardAmount?: number,
  ) => void;
  clearActivities: () => void;
  recomputeStreaks: () => void;
}

function confirmedDates(activities: Activity[]): string[] {
  return activities
    .filter(a => a.status === 'confirmed')
    .map(a => a.completedAt);
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      activities: [],
      streak: 0,
      bestStreak: 0,
      addActivity: activity => {
        const activities = [activity, ...get().activities].slice(0, 20);
        const dates = confirmedDates(activities);
        set({
          activities,
          streak: computeCurrentStreak(dates),
          bestStreak: Math.max(get().bestStreak, computeBestStreak(dates)),
        });
      },
      updateActivityStatus: (id, status, rewardAmount) => {
        const activities = get().activities.map(a =>
          a.id === id
            ? {
                ...a,
                status,
                ...(rewardAmount !== undefined ? { rewardAmount } : {}),
              }
            : a,
        );
        const dates = confirmedDates(activities);
        set({
          activities,
          streak: computeCurrentStreak(dates),
          bestStreak: Math.max(get().bestStreak, computeBestStreak(dates)),
        });
      },
      clearActivities: () => set({ activities: [], streak: 0 }),
      recomputeStreaks: () => {
        const dates = confirmedDates(get().activities);
        const best = computeBestStreak(dates);
        set({
          streak: computeCurrentStreak(dates),
          bestStreak: Math.max(get().bestStreak, best),
        });
      },
    }),
    {
      name: 'activity-storage',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
