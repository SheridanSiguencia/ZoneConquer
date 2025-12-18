// services/api.ts - Your "API phone book"

// Where your backend lives
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://zoneconquer.onrender.com/api';

// Typescript definitions (what data looks like)
export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  user_id: string;      
  username: string;
  email: string;
  created_at?: string;  
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
  username: string;
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

export interface Friend {
  friendship_id: string;
  user_id: string;
  username: string;
  status: 'pending' | 'accepted' | 'blocked';
  territories_owned: number;
  weekly_distance: number;
  created_at: string;
}

export interface FriendRequest {
  friendship_id: string;
  user_id: string;
  username: string;
  created_at: string;
}

export type LatLng = {
  latitude: number;
  longitude: number;
};

export interface FriendTerritory {
  territory_id: string;
  coordinates: LatLng[][];
  user_id: string;
  username: string;
  area_sq_meters: number;
  created_at: string;
}


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
    // NOTE: Unit mismatch fix. The backend returns distance in meters, but the frontend expects miles.
    // Converting meters to miles (1 meter = 0.000621371 miles).
    const METERS_TO_MILES = 0.000621371;
    return {
      ...result,
      user_id: result.user_id,
      territories_owned: Number(result.territories_owned) || 0,
      current_streak: Number(result.current_streak) || 0,
      today_distance: (Number(result.today_distance) * METERS_TO_MILES) || 0, 
      weekly_distance: (Number(result.weekly_distance) * METERS_TO_MILES) || 0, 
      weekly_goal: Number(result.weekly_goal) || 15,
    };
  },
  async updateDistance(
    distanceMiles: number,
  ): Promise<{ success: boolean; stats: UserStats }> {
    // console.log('API: updateDistance called with', distanceMiles, 'miles');
    
    // Convert miles to meters before sending
    const distanceMeters = distanceMiles * 1609.34;
    
    const response = await fetch(`${API_BASE}/user/update-distance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      // Send distance_meters instead of distance_miles
      body: JSON.stringify({ distance_meters: distanceMeters }),
    });
  
    //console.log('API: updateDistance response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text(); 
      console.log('BACKEND ERROR TEXT:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.log('BACKEND ERROR JSON:', errorData);
        throw new Error(errorData.error || `Backend error: ${response.status}`);
      } catch (e) {
        throw new Error(`Failed to update distance: ${response.status} - ${errorText}`);
      }
    }
  
    const result = await response.json();
    // console.log('API: updateDistance success:', result);
    return result;
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

  async saveTerritory(coordinates: LatLng[][], areaM2: number): Promise<{ success: boolean, territory_id: string }> {
    const response = await fetch(`${API_BASE}/territories/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        coordinates,
        area_sq_meters: areaM2,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save territory');
    }

    return await response.json();
  },

  async updateTerritory(territoryId: string, coordinates: LatLng[][], areaM2: number): Promise<{ 
    success: boolean;
    error?: string; 
  }> {
    const response = await fetch(`${API_BASE}/territories/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        territory_id: territoryId,
        coordinates,
        area_sq_meters: areaM2,
      }),
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to update territory'
      };
    }
  
    return await response.json();
  },
};

// friendsAPI object
export const friendsAPI = {
  // Send friend request
  async sendRequest(username: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/friends/send-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      throw new Error('Failed to send friend request');
    }

    return await response.json();
  },

  // Accept friend request
  async acceptRequest(friendshipId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/friends/accept-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ friendship_id: friendshipId }),
    });

    if (!response.ok) {
      throw new Error('Failed to accept friend request');
    }

    return await response.json();
  },

  // Reject friend request
  async rejectRequest(friendshipId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/friends/reject-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ friendship_id: friendshipId }),
    });

    if (!response.ok) {
      throw new Error('Failed to reject friend request');
    }

    return await response.json();
  },

  // Get friends list
  async getFriends(): Promise<Friend[]> {
    const response = await fetch(`${API_BASE}/friends/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch friends list');
    }

    const result = await response.json();
    return result.friends || [];
  },

  // Get pending friend requests
  async getPendingRequests(): Promise<FriendRequest[]> {
    const response = await fetch(`${API_BASE}/friends/pending`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pending requests');
    }

    const result = await response.json();
    return result.pending_requests || [];
  },

  // Get friends' territories for map
  async getFriendsTerritories(): Promise<FriendTerritory[]> {
    const response = await fetch(`${API_BASE}/friends/territories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch friends territories');
    }

    const result = await response.json();
    return result.territories || [];
  },

  // Remove friend (unfriend)
  async removeFriend(friendId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/friends/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ friend_id: friendId }),
    });

    if (!response.ok) {
      throw new Error('Failed to remove friend');
    }

    return await response.json();
  },
};
