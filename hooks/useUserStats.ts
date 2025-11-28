// hooks/useUserStats.ts - ENHANCED VERSION
import { useState, useEffect, useCallback } from 'react'; 
import { userAPI, UserStats } from '../services/api';
import { useFocusEffect } from '@react-navigation/native'; 

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
      
      const safeStats: UserStats = {
        user_id: userStats.user_id || 'unknown',
        territories_owned: Number(userStats.territories_owned) || 0,
        current_streak: Number(userStats.current_streak) || 0,
        today_distance: Number(userStats.today_distance) || 0,
        weekly_distance: Number(userStats.weekly_distance) || 0,
        weekly_goal: Number(userStats.weekly_goal) || 15
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

  // Auto refreshes when switched back to index screen 
  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

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