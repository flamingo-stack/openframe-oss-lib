"use client"

// Stub auth provider and hooks
import { createContext, useContext } from 'react';

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
});

// Global reference to real auth hook when available
let realUseAuth: (() => any) | null = null;

export function setRealAuthHook(authHook: () => any) {
  realUseAuth = authHook;
}

export function useAuth() {
  // Use real auth hook if available (when used in main app)
  if (realUseAuth) {
    try {
      const realAuth = realUseAuth();
      if (realAuth && realAuth.user) {
        return realAuth;
      }
    } catch (error) {
      // Fallback if real auth fails
    }
  }

  // Fallback mock user for UI kit context
  return {
    user: { id: 'mock-user-id', name: 'Mock User' },
    isLoading: false
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: { id: 'mock-user-id', name: 'Mock User' }, isLoading: false }}>
      {children as any}
    </AuthContext.Provider>
  );
}