import type { DepartmentRef } from './department';

export interface Employee {
  id: string;
  full_name: string;
  /** FK to the ONE `departments` table; `department` is the embedded row. */
  department_id: string | null;
  department: DepartmentRef | null;
  avatar_url: string;
  role: string;
  job_title: string;
  about: string;
  location_country?: string;
}

export interface EmployeeResponse {
  success: boolean;
  data: Employee[];
}

export interface EmployeeProfileData {
  full_name: string;
  department_id: string | null;
  department: DepartmentRef | null;
  avatar_url: string;
  role: string;
  job_title: string;
} 