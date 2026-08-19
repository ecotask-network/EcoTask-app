import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { UserProfile, UserStats } from '../types';
import { decodeTokenExpiry } from '../utils/jwt';

const storage = new MMKV({ id: 'user-storage' });
const zustandMMKVStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface UserState {
  profile: UserProfile | null;
  token: string | null;
  tokenExpiresAt: number | null;
  setProfile: (profile: UserProfile) => void;
  setToken: (token: string) => void;
  updateStats: (stats: Partial<UserStats>) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    set => ({
      profile: null,
      token: null,
      tokenExpiresAt: null,
      setProfile: profile => set({ profile }),
      setToken: token =>
        set({ token, tokenExpiresAt: decodeTokenExpiry(token) }),
      updateStats: stats =>
        set(s => ({
          profile: s.profile
            ? { ...s.profile, stats: { ...s.profile.stats, ...stats } }
            : null,
        })),
      logout: () => set({ profile: null, token: null, tokenExpiresAt: null }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
