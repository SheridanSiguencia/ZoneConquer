// services/api.ts - Your "API phone book"

// Where your backend lives
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000/api';

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

export interface UserStats {
  user_id: string;
  territories_owned: number;
  current_streak: number;
  today_distance: number;
  weekly_distance: number;
  weekly_goal: number;
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
  async register(userData: { username: string; email: string; password: string }) {
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
      credentials: 'include' as RequestCredentials,  // ← THIS IS REQUIRED for sessions!
      body: JSON.stringify(credentials),
    });

    const result = await response.json();
    
    console.log('🔍 LOGIN RESPONSE:', result); // ADD THIS FOR DEBUGGING
    
    // Check
    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }

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
  async updateDistance(distance_meters: number): Promise<{ success: boolean; stats: UserStats }> {
    const response = await fetch(`${API_BASE}/user/update-distance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ distance_meters }),
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
  }
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