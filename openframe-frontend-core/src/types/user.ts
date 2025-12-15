/**
 * Types related to users
 */

/**
 * User profile
 */
export type UserProfile = {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  job_title: string | null
  company: string | null
  bio: string | null
  employee_id: string | null
  department: string | null
  role: 'user' | 'super_admin'
  msp_id: string | null
  created_at: string
  updated_at: string
}

/**
 * User favorite
 */
export type UserFavorite = {
  id: number
  user_id: string
  vendor_id: number
  created_at: string
}

/**
 * User activity
 */
export type UserActivity = {
  id: number
  user_id: string
  vendor_id: number | null
  activity_type: "viewed" | "favorited" | "unfavorited" | "upvoted" | "downvoted" | "commented" | "compared" | "login" | "logout"
  created_at: string
  metadata?: Record<string, any> | null
}

/**
 * User preferences
 */
export type UserPreferences = {
  id: string
  user_id: string
  theme: "light" | "dark" | "system"
  email_notifications: boolean
  created_at: string
  updated_at: string
}
