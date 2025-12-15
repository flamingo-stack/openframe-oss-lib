/**
 * TMCG (The Miami Cyber Gang) related types and interfaces
 */

export interface TMCGMemberSocialLink {
  platform: string
  url: string
  username?: string
}

export interface TMCGMember {
  id: string
  full_name: string
  avatar_url?: string | null
  company?: string | null
  about?: string | null
  job_title?: string | null
  tmcg_roles: string[]
  social_links: TMCGMemberSocialLink[]
  created_at: string
  updated_at: string
}

export interface TMCGMembersResponse {
  success: boolean
  data: {
    members: TMCGMember[]
    count: number
  }
  error?: string
}

export interface TMCGMemberResponse {
  success: boolean
  data: TMCGMember
  error?: string
}

/**
 * TMCG Member Card Props
 */
export interface TMCGMemberCardProps {
  member: TMCGMember
  className?: string
  compact?: boolean
}

/**
 * TMCG Members Grid Props
 */
export interface TMCGMembersGridProps {
  members: TMCGMember[]
  isLoading?: boolean
  error?: string | null
  className?: string
}

/**
 * TMCG Social Links Props
 */
export interface TMCGSocialLinksProps {
  socialLinks: TMCGMemberSocialLink[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Hook return types
 */
export interface UseTMCGMembersResult {
  members: TMCGMember[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export interface UseTMCGMemberResult {
  member: TMCGMember | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * TMCG specific constants
 */
export const TMCG_ROLES = {
  FOUNDER: 'founder',
  ORGANIZER: 'organizer',
  MEMBER: 'member',
  CONTRIBUTOR: 'contributor',
  SPEAKER: 'speaker',
  MENTOR: 'mentor'
} as const

export type TMCGRole = typeof TMCG_ROLES[keyof typeof TMCG_ROLES]

/**
 * TMCG role display names
 */
export const TMCG_ROLE_DISPLAY_NAMES: Record<string, string> = {
  [TMCG_ROLES.FOUNDER]: 'Founder',
  [TMCG_ROLES.ORGANIZER]: 'Organizer',
  [TMCG_ROLES.MEMBER]: 'Member',
  [TMCG_ROLES.CONTRIBUTOR]: 'Contributor',
  [TMCG_ROLES.SPEAKER]: 'Speaker',
  [TMCG_ROLES.MENTOR]: 'Mentor'
}

/**
 * Social platform icon mapping for TMCG context
 */
export const TMCG_SOCIAL_PLATFORMS = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  github: 'GitHub',
  website: 'Website',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  discord: 'Discord',
  telegram: 'Telegram',
  slack: 'Slack'
} as const

export type TMCGSocialPlatform = keyof typeof TMCG_SOCIAL_PLATFORMS