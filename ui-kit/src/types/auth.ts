export type UserRole = 'user' | 'super_admin'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type SSOProvider = 'google' | 'slack' | 'microsoft'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: UserRole
  provider: string
}

export interface AuthContextType {
  user: AuthUser | null
  status: AuthStatus
  isLoading: boolean
  isSuperAdmin: boolean
  signInWithSSO: (provider: SSOProvider) => Promise<void>
  signOut: () => Promise<void>
}

export interface JWTClaims {
  sub: string
  email: string
  user_role?: UserRole
  aud: string
  exp: number
  iat: number
  iss: string
  [key: string]: any
} 