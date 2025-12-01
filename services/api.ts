// services/api.ts - Your "API phone book"

// Where your backend lives
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000/api';

// Typescript definitions (what data looks like)
export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface UserProfile {
  username: string;
  email: string;
  created_at: string;
}

export interface UserStats {
  user_id: string;
  territories_owned: number;
  current_streak: number;
  today_distance: number;
  weekly_distance: number;
  weekly_goal: number;
}

// Interfaces for Gamification
export interface Achievement {
  achievement_id: number;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  metric: string;
}

export interface Challenge {
  challenge_id: number;
  name: string;
  description: string;
  icon: string;
  goal_value: number;
  metric: string;
  start_date: string;
  end_date: string | null;
}

export interface UserAchievement extends Achievement {
  progress: number;
  unlocked_at: string | null;
}

export interface UserChallenge extends Challenge {
  current_value: number;
  completed_at: string | null;
}

export interface Territory {
  territory_id: string;
  user_id: string;
  coordinates: { latitude: number; longitude: number }[][];
  area_sq_meters: number;
  created_at: string;
}

// The actual API functions
export const authAPI = {
  async register(userData: {
    username: string;
    email: string;
    password: string;
  }) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Registration failed');
    }

    return result;
  },

  async login(credentials: LoginData) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include' as RequestCredentials, // required for sessions
      body: JSON.stringify(credentials),
    });

    const result = await response.json();

    console.log('🔍 LOGIN RESPONSE:', result);

    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }

    return result;
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await fetch(`${API_BASE}/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const result = await response.json();
    return result;
  },
};

export const userAPI = {
  async getStats(): Promise<UserStats> {
    const response = await fetch(`${API_BASE}/user/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user stats');
    }

    const result = await response.json();
    return result;
  },

  // 🆕 expects distance in *miles* (we convert before calling this)
  async updateDistance(
    distanceMiles: number,
  ): Promise<{ success: boolean; stats: UserStats }> {
    const response = await fetch(`${API_BASE}/user/update-distance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ distance_miles: distanceMiles }),
    });

    if (!response.ok) {
      throw new Error('Failed to update distance');
    }

    return await response.json();
  },

  async checkStreak(): Promise<{ success: boolean; stats: UserStats }> {
    const response = await fetch(`${API_BASE}/user/check-streak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error('Failed to check streak');
    }

    return await response.json();
  },

  async getProfile(): Promise<UserProfile> {
    const response = await fetch(`${API_BASE}/user/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const result = await response.json();
    return result;
  },

  async updateProfile(
    profileData: { username: string; email: string }
  ): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    const response = await fetch(`${API_BASE}/user/update-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });
    const result = await response.json();
    return result;
  },
};

export const gamificationAPI = {
  async getAchievements(): Promise<Achievement[]> {
    const response = await fetch(`${API_BASE}/gamification/achievements`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch achievements');
    }
    const result = await response.json();
    return result.achievements;
  },

  async getChallenges(): Promise<Challenge[]> {
    const response = await fetch(`${API_BASE}/gamification/challenges`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch challenges');
    }
    const result = await response.json();
    return result.challenges;
  },

  async getUserProgress(): Promise<{ achievements: UserAchievement[]; challenges: UserChallenge[] }> {
    const response = await fetch(`${API_BASE}/gamification/user-progress`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch user gamification progress');
    }
    const result = await response.json();
    return result;
  },
};

export const territoryAPI = {
  async getHistory(): Promise<Territory[]> {
    const response = await fetch(`${API_BASE}/territories/my-territories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch territory history');
    }

    const result = await response.json();
    return result.territories;
  },
};
