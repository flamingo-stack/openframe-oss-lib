// Design Doc Types (product-hub)
// Mirrors product-release.ts — entity + child tables + create/update/filter shapes.
//
// Participant sections are keyed by the employee DEPARTMENT (FK to the ONE
// `departments` table — see department.ts); there is no function enum.
// Completion-gate math and status transitions live in the hub's
// `lib/utils/design-doc-gate.ts` (isomorphic, shared by server + client).

import type { EntityAuthor } from './entity-author'
import type { DeliveryItem } from './delivery'
import type { DepartmentRef } from './department'

// ---------------------------------------------------------------------------
// Value vocabularies (string unions + `as const` arrays; badge colors and
// option labels are declared ONCE in the hub gate module, not here)
// ---------------------------------------------------------------------------

export const DESIGN_DOC_STATUSES = ['draft', 'in_review', 'approved', 'building', 'shipped', 'abandoned'] as const
export type DesignDocStatus = (typeof DESIGN_DOC_STATUSES)[number]

export const DESIGN_DOC_TIERS = ['S', 'M', 'L'] as const
export type DesignDocTier = (typeof DESIGN_DOC_TIERS)[number]

export const DESIGN_DOC_PARTICIPANT_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'] as const
export type DesignDocParticipantStatus = (typeof DESIGN_DOC_PARTICIPANT_STATUSES)[number]

export const DESIGN_DOC_COMMENT_TYPES = ['blocking', 'suggestion', 'question', 'note'] as const
export type DesignDocCommentType = (typeof DESIGN_DOC_COMMENT_TYPES)[number]

export const DESIGN_DOC_COMMENT_STATUSES = ['open', 'resolved', 'declined'] as const
export type DesignDocCommentStatus = (typeof DESIGN_DOC_COMMENT_STATUSES)[number]

export const DESIGN_DOC_LINK_TYPES = ['roadmap_task', 'figma', 'claude_artifact', 'claude_design', 'brief', 'other'] as const
export type DesignDocLinkType = (typeof DESIGN_DOC_LINK_TYPES)[number]

export const DESIGN_DOC_MEDIA_TYPES = ['image', 'video', 'screenshot', 'demo'] as const
export type DesignDocMediaType = (typeof DESIGN_DOC_MEDIA_TYPES)[number]

// ---------------------------------------------------------------------------
// Rows (as returned by the hub DAL — hydrated)
// ---------------------------------------------------------------------------

/** Minimal profile identity the DAL embeds on participants / comment authors. */
export interface DesignDocPerson {
  id: string
  full_name: string | null
  avatar_url: string | null
  job_title?: string | null
  /** Present on the DRI/detail payload only — never on list payloads. */
  email?: string | null
  department_id?: string | null
  department?: DepartmentRef | null
}

export interface DesignDocClickUpTask {
  id: number
  doc_id: number
  participant_id: number | null
  clickup_task_id: string
  display_order: number | null
  created_at: string
  /** Hydrated from the `clickup_tasks` mirror (never the live API). `undefined` = not in the mirror. */
  task?: DeliveryItem
}

export interface DesignDocLink {
  id: number
  doc_id: number
  link_type: DesignDocLinkType
  url: string | null
  clickup_task_id: string | null
  title: string | null
  display_order: number | null
  created_at: string
  /** `roadmap_task` links are hydrated from the mirror too. */
  task?: DeliveryItem
}

export interface DesignDocMedia {
  id: number
  doc_id: number
  participant_id: number | null
  media_type: DesignDocMediaType
  media_url: string
  title: string | null
  description: string | null
  display_order: number | null
  created_at: string
  created_by: string | null
}

/**
 * A comment. ROOT comments (`parent_comment_id === null`) carry `comment_type`
 * + `status` and gate approval when `blocking` + `open`; REPLIES carry neither
 * (single-level threads — a reply to a reply is re-parented to the root).
 */
export interface DesignDocComment {
  id: number
  doc_id: number
  participant_id: number | null
  parent_comment_id: number | null
  author_id: string | null
  comment_type: DesignDocCommentType | null
  title: string | null
  body: string
  status: DesignDocCommentStatus | null
  resolved_at: string | null
  created_at: string
  author?: DesignDocPerson | null
  /** Threaded by the DAL; always `[]` on replies. */
  replies: DesignDocComment[]
}

export interface DesignDocParticipant {
  id: number
  doc_id: number
  department_id: string
  department: DepartmentRef
  assignee_id: string | null
  assignee?: DesignDocPerson | null
  status: DesignDocParticipantStatus
  content: string | null
  completed_at: string | null
  display_order: number | null
  created_at: string
  updated_at: string
  tasks: DesignDocClickUpTask[]
  media: DesignDocMedia[]
  /** Section-scoped root comments (threaded). */
  comments: DesignDocComment[]
}

export interface DesignDocCompletion {
  total: number
  completed: number
  blocked: number
  openBlocking: number
  isComplete: boolean
  waitingOn: Array<{
    participantId: number
    department: DepartmentRef
    assigneeName: string | null
    status: DesignDocParticipantStatus
  }>
}

/** R13 — what the signed-in viewer still owes on one doc. */
export interface DesignDocMyOpenWork {
  /** One person may own several department sections on the same doc. */
  participants: Array<{ id: number; department: DepartmentRef; status: DesignDocParticipantStatus }>
  openTasks: DeliveryItem[]
}

export interface DesignDoc {
  id: number
  title: string
  slug: string
  tier: DesignDocTier
  summary: string | null
  content: string | null
  status: DesignDocStatus
  author_id: string | null
  /**
   * EVERYONE who has handed the DRI role away on this doc (appended, never
   * overwritten). The third-party break-glass excludes all of them: a DRI who
   * also holds management could otherwise vacate the seat, act as a "third
   * party" on their own doc and approve it alone — and with a single scalar,
   * simply hand the seat on twice to erase the memory of their own vacating.
   */
  dri_vacated_by: string[]
  approved_at: string | null
  created_at: string
  updated_at: string
  /** DRI, hydrated via the shared author hydrator. */
  author?: EntityAuthor
  participants: DesignDocParticipant[]
  links: DesignDocLink[]
  /** Doc-level comments only (participant-scoped comments ride on their participant). */
  comments: DesignDocComment[]
  completion: DesignDocCompletion
  my_open_work?: DesignDocMyOpenWork
}

// ---------------------------------------------------------------------------
// Write shapes
// ---------------------------------------------------------------------------

export interface DesignDocLinkInput {
  link_type: DesignDocLinkType
  url?: string | null
  clickup_task_id?: string | null
  title?: string | null
  display_order?: number
}

export interface DesignDocClickUpTaskInput {
  clickup_task_id: string
  display_order?: number
}

export interface DesignDocMediaInput {
  media_type: DesignDocMediaType
  media_url: string
  title?: string | null
  description?: string | null
  display_order?: number
}

export interface CreateDesignDocParticipantInput {
  /** Defaults to the assignee's profile department when omitted. */
  department_id?: string
  assignee_id: string
}

/** Wizard payload (POST /api/admin/design-docs). */
export interface CreateDesignDocData {
  title: string
  slug: string
  tier: DesignDocTier
  summary?: string | null
  /** Spec markdown (Why / What / How); the create screen carries the same body editor as edit. */
  content?: string | null
  /** DRI; defaults to the caller. */
  author_id?: string | null
  participants: CreateDesignDocParticipantInput[]
  links: DesignDocLinkInput[]
}

/**
 * Doc-level allowlist (PUT). `status` and `participants` are NOT here — status
 * only moves through PATCH (the gate), participants only through their routes.
 */
export interface UpdateDesignDocData {
  title?: string
  slug?: string
  tier?: DesignDocTier
  summary?: string | null
  content?: string | null
  author_id?: string | null
  links?: DesignDocLinkInput[]
  /** OCC token — the `updated_at` the editor seeded from; mismatch → 409. */
  expected_updated_at?: string
}

export interface UpdateDesignDocParticipantData {
  content?: string | null
  status?: DesignDocParticipantStatus
  assignee_id?: string | null
  department_id?: string
  clickup_tasks?: DesignDocClickUpTaskInput[]
  media?: DesignDocMediaInput[]
  expected_updated_at?: string
}

export interface AddDesignDocParticipantData {
  /** Defaults to the assignee's profile department when omitted. */
  department_id?: string
  assignee_id: string
}

export interface AddDesignDocCommentData {
  participant_id?: number | null
  /** Set for a reply; the DAL re-parents replies-of-replies to the root. */
  parent_comment_id?: number | null
  /** Required on root comments, ignored on replies. */
  comment_type?: DesignDocCommentType
  title?: string | null
  body: string
}

export interface DesignDocFilters {
  status?: string
  search?: string
  mine?: 'open'
  limit?: number
  offset?: number
}

export interface DesignDocListResponse {
  data: DesignDoc[]
  count: number
  /** Server-computed status facet counts (how-i-work feed convention). */
  facets: { status: Record<string, number> }
}

export interface DesignDocStats {
  total: number
  draft: number
  in_review: number
  approved: number
  building: number
  waiting_on_me_docs: number
  waiting_on_me_tasks: number
}
