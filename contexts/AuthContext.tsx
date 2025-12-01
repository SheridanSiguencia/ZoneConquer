// contexts/AuthContext.tsx
import React, { ReactNode } from 'react';
import { useUserStore } from '../store/user';

// The AuthProvider component is a simple wrapper that provides the user store to its children.
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// The useAuth hook is a convenience hook that returns the user store.
// This makes it easy to access the user's state and actions from any component.
export function useAuth() {
  return useUserStore();
}