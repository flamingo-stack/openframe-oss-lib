import type { DepartmentRef } from './department';

/**
 * THE person projection every people picker and person embed speaks.
 *
 * One shape, because it is one wire payload: the employee-directory endpoints
 * return it, `EmployeeSelector` renders it, and the design-doc DAL embeds it as
 * a DRI / section owner / comment author. Everything past `full_name` is
 * optional because the list payloads project fewer columns than the detail ones
 * — a narrower reader `Pick<>`s from here rather than re-declaring the fields.
 */
export interface EmployeeDirectoryRow {
  id: string;
  full_name: string | null;
  email?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  /** FK to the ONE `departments` table; `department` is the embedded row. */
  department_id?: string | null;
  department?: DepartmentRef | null;
}

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