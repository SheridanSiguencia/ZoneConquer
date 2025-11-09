// hooks/useUserStats.ts - FIXED VERSION
import { useState, useEffect } from 'react';
import { userAPI, UserStats } from '../services/api';

export const useUserStats = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Fetching user stats...');
      const userStats = await userAPI.getStats();
      
      console.log('✅ Raw API response:', userStats);
      
      // ✅ CONVERT STRINGS TO NUMBERS
      const safeStats: UserStats = {
        user_id: userStats.user_id || 'unknown',
        total_distance: Number(userStats.total_distance) || 0,
        territories_owned: Number(userStats.territories_owned) || 0,
        current_streak: Number(userStats.current_streak) || 0,
        today_distance: Number(userStats.today_distance) || 0,     // ← Convert to number
        weekly_distance: Number(userStats.weekly_distance) || 0,   // ← Convert to number
        weekly_goal: Number(userStats.weekly_goal) || 15           // ← Convert to number
      };
      
      console.log('✅ Processed stats (with numbers):', safeStats);
      setStats(safeStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stats';
      console.error('❌ Error fetching user stats:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
};