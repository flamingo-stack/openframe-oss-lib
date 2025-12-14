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
  department?: string;
  team?: string;
  manager_id?: string;
  profile_image_url?: string;
  profile_image_hash?: string;
  bio?: string;
  location?: string;
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
  department: string;
  description: string;
  members: TeamMember[];
}

export interface TeamData {
  founder: TeamMember | null;
  sections: TeamSection[];
}

export interface GetTeamOptions {
  includeInactive?: boolean;
  department?: string;
} 