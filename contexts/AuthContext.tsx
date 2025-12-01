// contexts/AuthContext.tsx
import React, { ReactNode } from 'react';
import { useUserStore } from '../store/user';

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return useUserStore();
}