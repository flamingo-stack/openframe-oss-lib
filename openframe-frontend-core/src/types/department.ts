/**
 * Departments — THE single source of truth for the org's department
 * vocabulary.
 *
 * The `departments` table is populated from Google Workspace (the org chart)
 * by the hub's Google sync, which auto-creates a row the first time it sees a
 * new department name. `profiles.department_id` is an FK to it; there is no
 * free-text department column and no enum anywhere in code — every consumer
 * reads the row (or the embedded `DepartmentRef`) and every picker lists the
 * ACTIVE rows ordered by `display_order`.
 *
 * Hub owner module: `lib/data/department-utils.ts`.
 */

export interface Department {
  id: string
  name: string
  slug: string
  description?: string | null
  parent_department_id?: string | null
  display_order: number
  is_active: boolean
}

/** The embedded shape a reader gets through the `department:departments(…)` PostgREST embed. */
export type DepartmentRef = Pick<Department, 'id' | 'name' | 'slug'> & {
  display_order?: number
}

/** `GET /api/admin/departments?counts=…` row — a department plus how many profiles carry it. */
export interface DepartmentSummary {
  id: string
  name: string
  slug: string
  count: number
}

/** Population a department count is taken over. */
export type DepartmentCountPopulation = 'directory' | 'scored'
