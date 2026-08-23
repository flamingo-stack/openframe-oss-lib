import type { DepartmentRef } from './department';

export interface TeamMember {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  work_email?: string;
  phone?: string;
  role?: string;
  title?: string;
  /** Display name of the department (presentational shape); `department_id` is the FK. */
  department?: string;
  department_id?: string | null;
  team?: string;
  manager_id?: string;
  profile_image_url?: string;
  profile_image_hash?: string;
  bio?: string;
  location?: string;
  location_country?: string;
  start_date?: string;
  end_date?: string;
  employment_status: string;
  employment_type?: string;
  is_public: boolean;
  is_manager: boolean;
  timezone?: string;
  social_links?: Record<string, string>;
  skills?: string[];
  interests?: string[];
  created_at: string;
  updated_at: string;
}

export interface TeamSection {
  title: string;
  /** Department display name. */
  department: string;
  department_id: string | null;
  /** `departments.display_order` — sections sort by it (no name sentinels). */
  display_order: number;
  description: string;
  members: TeamMember[];
}

export interface TeamData {
  founder: TeamMember | null;
  sections: TeamSection[];
}

export interface GetTeamOptions {
  includeInactive?: boolean;
  departmentId?: string;
} 