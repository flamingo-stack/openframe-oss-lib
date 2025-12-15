export interface AccessCodeCohort {
  id: string;
  name: string;
  description?: string;
  launch_date: string;
  capacity?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAccessCodeCohort {
  name: string;
  description?: string;
  launch_date: string;
  capacity?: number;
}

export interface UpdateAccessCodeCohort {
  name?: string;
  description?: string;
  launch_date?: string;
  capacity?: number;
}

export interface AccessCode {
  id: string;
  cohort_id: string;
  waitlist_entry_id: string;
  code: string;
  used_at?: string | null;
  expires_at?: string;
  created_at: string;
}

export interface CohortMembership {
  id: string;
  cohort_id: string;
  waitlist_entry_id: string;
  access_code_id: string;
  status: 'pending' | 'invited' | 'registered';
  created_at: string;
}

export interface AccessCodeValidation {
  email: string;
  code: string;
}

export interface AccessCodeValidationResponse {
  valid: boolean;
  message?: string;
  cohort_name?: string;
}

export interface AccessCodeConsumptionResponse {
  success: boolean;
  consumed: boolean;
  message?: string;
  cohort_name?: string;
}

export interface CohortWithStats extends AccessCodeCohort {
  member_count: number;
  codes_generated: number;
  codes_used: number;
}