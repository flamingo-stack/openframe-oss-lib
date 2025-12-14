export interface Employee {
  id: string;
  full_name: string;
  department: string;
  avatar_url: string;
  role: string;
  job_title: string;
  about: string;
}

export interface EmployeeResponse {
  success: boolean;
  data: Employee[];
}

export interface ProfileData {
  full_name: string;
  department: string;
  avatar_url: string;
  role: string;
  job_title: string;
} 