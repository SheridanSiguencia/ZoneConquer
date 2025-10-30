// hooks/useUserStats.ts - CREATE NEW FILE
import { useState, useEffect } from 'react';
import { userAPI, UserStats } from '@/services/api';

export function useUserStats(userId: string | null) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      if (!userId) {
        setUserStats(null);
        setIsLoading(false);
        return;
      }
  
      try {
        setIsLoading(true);
        const stats = await userAPI.getStats(userId);
        setUserStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
        console.error('Error loading user stats:', err);
      } finally {
        setIsLoading(false);
      }
    }
  
    loadStats();
  }, [userId]);