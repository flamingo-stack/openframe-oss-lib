'use client';

// Stub auth provider and hooks
import { createContext } from 'react';
import type { ReactNode } from 'react';

/** The signed-in user, as far as this stub's consumers care. Hosts inject a
 *  richer object through `setRealAuthHook`; only `id` and `name` are read
 *  inside the lib (see `comment-card.tsx`). */
export interface AuthStubUser {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface AuthContextType {
  user: AuthStubUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
});

// Global reference to real auth hook when available
let realUseAuth: (() => AuthContextType) | null = null;

export function setRealAuthHook(authHook: () => AuthContextType) {
  realUseAuth = authHook;
}

export function useAuth(): AuthContextType {
  // Use real auth hook if available (when used in main app)
  if (realUseAuth) {
    try {
      const realAuth = realUseAuth();
      if (realAuth && realAuth.user) {
        return realAuth;
      }
    } catch {
      // Fallback if real auth fails
    }
  }

  // Fallback mock user for UI kit context
  return {
    user: { id: 'mock-user-id', name: 'Mock User' },
    isLoading: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: { id: 'mock-user-id', name: 'Mock User' }, isLoading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
