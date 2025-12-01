// store/user.ts
import create from 'zustand';
import { userAPI, User, UserStats, UserProfile } from '../services/api';

// Define the state shape for the user store
interface UserState {
  user: User | null; // The current user
  profile: UserProfile | null; // The user's profile data
  stats: UserStats | null; // The user's stats
  loading: boolean; // Whether the store is currently loading data
  error: string | null; // Any errors that have occurred
  login: (userData: User) => void; // Action to log the user in
  logout: () => void; // Action to log the user out
  fetchUserStats: () => void; // Action to fetch the user's stats
  fetchUserProfile: () => void; // Action to fetch the user's profile
}

// Create the user store
export const useUserStore = create<UserState>((set) => ({
  // Initial state
  user: null,
  profile: null,
  stats: null,
  loading: false,
  error: null,

  // Action to log the user in
  login: (userData) => set({ user: userData }),

  // Action to log the user out
  logout: () => set({ user: null, stats: null, profile: null }),

  // Action to fetch the user's stats
  fetchUserStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await userAPI.getStats();
      set({ stats, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch user stats.', loading: false });
    }
  },

  // Action to fetch the user's profile
  fetchUserProfile: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await userAPI.getProfile();
      set({ profile, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch user profile.', loading: false });
    }
  },
}));
