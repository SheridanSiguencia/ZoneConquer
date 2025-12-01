// store/user.ts
import create from 'zustand';
import { userAPI, User, UserStats } from '../services/api';

interface UserState {
  user: User | null;
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  login: (userData: User) => void;
  logout: () => void;
  fetchUserStats: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  stats: null,
  loading: false,
  error: null,
  login: (userData) => set({ user: userData }),
  logout: () => set({ user: null, stats: null }),
  fetchUserStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await userAPI.getStats();
      set({ stats, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch user stats.', loading: false });
    }
  },
}));
