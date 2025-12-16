// store/user.ts
// store/user.ts
import { create } from 'zustand';
import { Achievement, authAPI, Challenge, gamificationAPI, User, UserAchievement, userAPI, UserChallenge, UserProfile, UserStats } from '../services/api';

// Define the state shape for the user store
interface UserState {
  user: User | null; // The current user
  profile: UserProfile | null; // The user's profile data
  stats: UserStats | null; // The user's stats
  achievements: Achievement[]; // All available achievements
  challenges: Challenge[]; // All available challenges
  userAchievements: UserAchievement[]; // User's progress on achievements
  userChallenges: UserChallenge[]; // User's progress on challenges
  loading: boolean; // Whether the store is currently loading data
  error: string | null; // Any errors that have occurred
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; user?: User; error?: string }>; // Action to log the user in
  logout: () => void; // Action to log the user out
  fetchUserStats: () => void; // Action to fetch the user's stats
  fetchUserProfile: () => void; // Action to fetch the user's profile
  fetchAchievements: () => void; // Action to fetch all achievements
  fetchChallenges: () => void; // Action to fetch all challenges
  fetchUserProgress: () => void; // Action to fetch user's progress on gamification
  updateDistance: (distanceMiles: number) => Promise<{ success: boolean; stats: UserStats }>; 
  updateProfile: (profileData: { username: string; email: string }) => Promise<void>;
}

// Create the user store
export const useUserStore = create<UserState>((set) => ({
  // Initial state
  user: null,
  profile: null,
  stats: null,
  achievements: [],
  challenges: [],
  userAchievements: [],
  userChallenges: [],
  loading: false,
  error: null,

  // Action to log the user in
  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const result = await authAPI.login(credentials);
      
      if (result.success && result.user) {
        set({ 
          user: result.user, 
          loading: false, 
          error: null 
        });
        return { success: true, user: result.user };
      } else {
        const errorMsg = result.error || 'Login failed';
        set({ 
          error: errorMsg, 
          loading: false 
        });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Login failed. Please try again.';
      set({ 
        error: errorMsg, 
        loading: false 
      });
      return { success: false, error: errorMsg };
    }
  },

  // Action to log the user out
  logout: () => set({ user: null, stats: null, profile: null, achievements: [], challenges: [], userAchievements: [], userChallenges: [] }),

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

  // Action to fetch all achievements
  fetchAchievements: async () => {
    set({ loading: true, error: null });
    try {
      const achievements = await gamificationAPI.getAchievements();
      set({ achievements, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch achievements.', loading: false });
    }
  },

  // Action to fetch all challenges
  fetchChallenges: async () => {
    set({ loading: true, error: null });
    try {
      const challenges = await gamificationAPI.getChallenges();
      set({ challenges, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch challenges.', loading: false });
    }
  },

  // Action to fetch user's progress on gamification
  fetchUserProgress: async () => {
    set({ loading: true, error: null });
    try {
      const { achievements, challenges } = await gamificationAPI.getUserProgress();
      set({ userAchievements: achievements, userChallenges: challenges, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch user gamification progress.', loading: false });
    }
  },

  updateDistance: async (distanceMiles: number) => { 
    // REMOVED: set({ loading: true, error: null });
    try {
      const result = await userAPI.updateDistance(distanceMiles);
      // Update only stats, not loading state
      set({ stats: result.stats });
      return result; 
    } catch (error) {
      console.error('Failed to update distance:', error);
      // Set error without affecting loading
      set({ error: 'Failed to update distance.' });
      throw error; 
    }
  },
  
  updateProfile: async (profileData) => {
    set({ loading: true, error: null });
    try {
      const result = await userAPI.updateProfile(profileData);
      if (result.success && result.profile) {
        set({ profile: result.profile, loading: false });
      } else {
        set({ error: result.error || 'Failed to update profile.', loading: false });
      }
    } catch (error) {
      set({ error: 'Failed to update profile.', loading: false });
    }
  }
}));
