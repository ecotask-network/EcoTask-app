import { create } from 'zustand';

interface UserProfile {
  id: string;
  wallet: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
}

interface UserState {
  profile: UserProfile | null;
  token: string | null;
  setProfile: (profile: UserProfile) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>(set => ({
  profile: null,
  token: null,
  setProfile: profile => set({ profile }),
  setToken: token => set({ token }),
  logout: () => set({ profile: null, token: null }),
}));
