export interface WaitlistEntry {
  id: string;
  email: string;
  name?: string;
  company?: string;
  user_id?: string | null;
  platform_id: string;
  referral_source?: string;
  help_category?: string;
  message?: string;
  // Tracking fields
  ip_address?: string;
  user_agent?: string;
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  created_at: string;
  updated_at: string;
  // HubSpot integration metadata (may be undefined if not yet synced)
  hubspot_contact_id?: string | null;
  hubspot_company_id?: string | null;
  hubspot_sync_status?: 'success' | 'error' | 'missing' | null;
  hubspot_contact_url?: string | null;
  // HubSpot enriched data (populated server-side from HubSpot API)
  hubspot_name?: string | null;
  hubspot_company?: string | null;
  hubspot_company_logo_url?: string | null;
  // Platform relationship data (populated via join)
  platforms?: {
    id: string;
    name: string;
    display_name: string;
  };
  // Cohort membership data (populated via join) - array but limited to 1 due to business rule
  cohort_memberships?: Array<{
    id: string;
    status: string;
    created_at: string;
    access_code_cohorts?: {
      id: string;
      name: string;
      launch_date: string;
      status: string;
    };
    access_codes?: {
      code: string;
      used_at: string | null;
    };
  }>;
  // Enriched cohort data (populated server-side from cohort_memberships)
  cohort?: {
    cohort_id: string;
    cohort_name: string;
    cohort_status: string;
    cohort_launch_date: string;
    access_code: string;
    access_code_used: boolean;
    membership_status: string;
    membership_created_at: string;
  } | null;
}

export interface CreateWaitlistEntry {
  email: string;
  name?: string;
  company?: string;
  user_id?: string | null;
  platform_id: string;
  referral_source?: string;
  help_category?: string;
  message?: string;
  // Tracking fields
  ip_address?: string;
  user_agent?: string;
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface WaitlistResponse {
  success: boolean;
  data?: WaitlistEntry;
  error?: string;
} 