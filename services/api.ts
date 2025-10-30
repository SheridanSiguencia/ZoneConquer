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


// The actual API functions
export const authAPI = {
  async login(credentials: LoginData) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const result = await response.json();
    
    console.log('🔍 LOGIN RESPONSE:', result); // ADD THIS FOR DEBUGGING
    
    // 🛡️ SUPER EXPLICIT CHECK
    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }

    return result;
  },
};
// Add UserStats interface
export interface UserStats {
  user_id: string;
  total_distance_km: number;
  territories_owned: number;
  current_streak: number;
  today_distance?: number;
}

// user 
export const userAPI = {
  async getStats(userId: string) {
    const response = await fetch(`${API_BASE}/user/stats?user_id=${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user stats');
    }
    
    return await response.json();
  }
};
  
