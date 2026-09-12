// Design Doc Types (product-hub)
// Mirrors product-release.ts — entity + child tables + create/update/filter shapes.
//
// Participant sections are keyed by the employee DEPARTMENT (FK to the ONE
// `departments` table — see department.ts); there is no function enum.
// A doc has no status: it is READY when every section is signed off and no
// blocking comment is open. That math lives in the hub's
// `lib/utils/design-doc-gate.ts` (isomorphic, shared by server + client).

import type { RoadmapItem } from '../components/chat/types/entities/roadmap-item';
import type { DeliveryItem } from './delivery';
import type { DepartmentRef } from './department';
import type { EmployeeDirectoryRow } from './employee';
import type { EntityAuthor } from './entity-author';

// ---------------------------------------------------------------------------
// Value vocabularies — DATA, not source code.
//
// Every enumerable design-doc value (tier, participant status, comment
// type/status, link type, media type) is a row in the `design_doc_vocabulary`
// table, with its label, badge colour, display order and the semantic ROLES it
// claims. Nothing here lists members: a union of literals would be a second,
// stale copy of that table and would make adding a value a deploy instead of an
// INSERT.
//
// What stays in code is the CAPABILITY vocabulary — the role names the gate
// understands and the renderers a link type can bind to (both declared in the
// hub's `lib/utils/design-doc-gate.ts`). A row participates by CLAIMING a
// capability; no engine rule ever names a value.
//
// The aliases below are documentation, not constraints: they mark which
// vocabulary a string belongs to. Values are validated at the edge (the DAL
// checks membership against the live table) and by the database itself (each
// value column carries a composite FK into `design_doc_vocabulary`).
// ---------------------------------------------------------------------------

/** One value of `design_doc_vocabulary.kind` — the STRUCTURAL list (one per
 *  value column), the only design-doc vocabulary that is code. */
export type DesignDocVocabularyKind =
  'tier' | 'participant_status' | 'comment_type' | 'comment_status' | 'link_type' | 'media_type';

/** A `design_doc_vocabulary` row, as the DAL and the vocabulary API return it. */
export interface DesignDocVocabularyOption {
  id: number;
  kind: DesignDocVocabularyKind;
  value: string;
  label: string;
  /** A `StatusBadge` colorScheme name (validated against the badge's own union
   *  when the hub reads the row — an unknown scheme degrades to 'default'). */
  color_scheme: string;
  display_order: number;
  is_active: boolean;
  /** Engine capabilities this member claims (`complete`, `blocks_ready`, …).
   *  The names live in the hub's gate module. */
  roles: string[];
  /** link_type only: which renderer previews it. */
  render: DesignDocLinkRender | null;
  /** link_type only: the markdown shortcode that embeds it, and whether that
   *  shortcode takes the author's `|title`. */
  embed_shortcode: string | null;
  embed_with_title: boolean;
  /** link_type only: where the artifact comes from, shown beside the label. */
  source: string | null;
  placeholder: string | null;
}

/** How the doc page previews a link type. A CAPABILITY (each key is a
 *  component in the renderer), so this one IS code — a DB row binds to it. */
export type DesignDocLinkRender = 'task' | 'figma' | 'claude' | 'link';

/** The whole vocabulary in one payload — what every surface (server rules,
 *  client badges, pickers, validators) reads instead of a literal list. */
export interface DesignDocVocabulary {
  options: DesignDocVocabularyOption[];
}

/** A `design_doc_vocabulary.value` of kind `tier`. */
export type DesignDocTier = string;
/** A `design_doc_vocabulary.value` of kind `participant_status`. */
export type DesignDocParticipantStatus = string;
/** A `design_doc_vocabulary.value` of kind `comment_type`. */
export type DesignDocCommentType = string;
/** A `design_doc_vocabulary.value` of kind `comment_status`. */
export type DesignDocCommentStatus = string;
/** A `design_doc_vocabulary.value` of kind `link_type`. */
export type DesignDocLinkType = string;
/** A `design_doc_vocabulary.value` of kind `media_type`. */
export type DesignDocMediaType = string;

// ---------------------------------------------------------------------------
// Rows (as returned by the hub DAL — hydrated)
// ---------------------------------------------------------------------------

/**
 * The profile identity the DAL embeds on participants / comment authors — THE
 * shared person projection, not a second declaration of it. `email` rides the
 * detail payload only and is stripped from lists.
 */
export type DesignDocPerson = EmployeeDirectoryRow;

export interface DesignDocClickUpTask {
  id: number;
  doc_id: number;
  participant_id: number | null;
  clickup_task_id: string;
  display_order: number | null;
  created_at: string;
  /** Hydrated from the `clickup_tasks` mirror (never the live API). `undefined` = not in the mirror. */
  task?: DeliveryItem;
}

export interface DesignDocLink {
  id: number;
  doc_id: number;
  link_type: DesignDocLinkType;
  url: string | null;
  clickup_task_id: string | null;
  title: string | null;
  display_order: number | null;
  created_at: string;
  /**
   * A `roadmap_task` link, hydrated from the mirror as the ROADMAP item it is —
   * so it renders with the roadmap card, the same as `/roadmap` and the chat.
   * `undefined` = the mirror has not seen that id. (Section tasks are a
   * different entity and carry `DeliveryItem` on `DesignDocClickUpTask`.)
   */
  roadmap?: RoadmapItem;
}

export interface DesignDocMedia {
  id: number;
  doc_id: number;
  participant_id: number | null;
  media_type: DesignDocMediaType;
  media_url: string;
  title: string | null;
  description: string | null;
  display_order: number | null;
  created_at: string;
  created_by: string | null;
}

/**
 * A comment. ROOT comments (`parent_comment_id === null`) carry `comment_type`
 * + `status` and keep the doc from being ready when `blocking` + `open`; REPLIES carry neither
 * (single-level threads — a reply to a reply is re-parented to the root).
 */
export interface DesignDocComment {
  id: number;
  doc_id: number;
  participant_id: number | null;
  parent_comment_id: number | null;
  author_id: string | null;
  comment_type: DesignDocCommentType | null;
  title: string | null;
  body: string;
  status: DesignDocCommentStatus | null;
  resolved_at: string | null;
  created_at: string;
  author?: DesignDocPerson | null;
  /** Threaded by the DAL; always `[]` on replies. */
  replies: DesignDocComment[];
}

export interface DesignDocParticipant {
  id: number;
  doc_id: number;
  department_id: string;
  department: DepartmentRef;
  assignee_id: string | null;
  assignee?: DesignDocPerson | null;
  status: DesignDocParticipantStatus;
  content: string | null;
  completed_at: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
  tasks: DesignDocClickUpTask[];
  media: DesignDocMedia[];
  /** Section-scoped root comments (threaded). */
  comments: DesignDocComment[];
}

export interface DesignDocCompletion {
  total: number;
  completed: number;
  blocked: number;
  openBlocking: number;
  isComplete: boolean;
  waitingOn: Array<{
    participantId: number;
    department: DepartmentRef;
    assigneeName: string | null;
    status: DesignDocParticipantStatus;
  }>;
}

/** R13 — what the signed-in viewer still owes on one doc. */
export interface DesignDocMyOpenWork {
  /** One person may own several department sections on the same doc. */
  participants: Array<{ id: number; department: DepartmentRef; status: DesignDocParticipantStatus }>;
  openTasks: DeliveryItem[];
}

export interface DesignDoc {
  id: number;
  title: string;
  slug: string;
  tier: DesignDocTier;
  summary: string | null;
  content: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  /** DRI, hydrated via the shared author hydrator. */
  author?: EntityAuthor;
  /**
   * Engineering feature leads — the people reviewing the doc alongside the
   * department sign-off sections. DISPLAY-ONLY attribution, like
   * `how_i_work_participants`: being listed grants NO rights (nothing in the
   * hub's `design-doc-gate.ts` reads it) and is NOT an input to readiness.
   * The doc-level owner with actual levers is the DRI (`author_id`).
   *
   * Carried on BOTH the list and the detail payload — the dashboard renders
   * their avatars in its own column.
   */
  feature_leads: DesignDocPerson[];
  participants: DesignDocParticipant[];
  links: DesignDocLink[];
  /** Doc-level comments only (participant-scoped comments ride on their participant). */
  comments: DesignDocComment[];
  completion: DesignDocCompletion;
  my_open_work?: DesignDocMyOpenWork;
}

// ---------------------------------------------------------------------------
// Write shapes
// ---------------------------------------------------------------------------

export interface DesignDocLinkInput {
  link_type: DesignDocLinkType;
  url?: string | null;
  clickup_task_id?: string | null;
  title?: string | null;
  display_order?: number;
}

export interface DesignDocClickUpTaskInput {
  clickup_task_id: string;
  display_order?: number;
}

export interface DesignDocMediaInput {
  media_type: DesignDocMediaType;
  media_url: string;
  title?: string | null;
  description?: string | null;
  display_order?: number;
}

export interface CreateDesignDocParticipantInput {
  /** Defaults to the assignee's profile department when omitted. */
  department_id?: string;
  assignee_id: string;
}

/** Wizard payload (POST /api/admin/design-docs). */
export interface CreateDesignDocData {
  title: string;
  slug: string;
  tier: DesignDocTier;
  summary?: string | null;
  /** Spec markdown (Why / What / How); the create screen carries the same body editor as edit. */
  content?: string | null;
  /** DRI; defaults to the caller. */
  author_id?: string | null;
  /** Feature leads (profile ids). Display-only — see `DesignDoc.feature_leads`. */
  feature_lead_ids?: string[];
  participants: CreateDesignDocParticipantInput[];
  links: DesignDocLinkInput[];
}

/**
 * Doc-level allowlist (PUT). `participants` are NOT here — they only move
 * through their own routes.
 */
export interface UpdateDesignDocData {
  title?: string;
  slug?: string;
  tier?: DesignDocTier;
  summary?: string | null;
  content?: string | null;
  author_id?: string | null;
  /**
   * Replaces the whole feature-lead set (`[]` clears it); omitted leaves it
   * untouched. Display-only, so it rides the STANDING floor like the title —
   * not the DRI-only levers.
   */
  feature_lead_ids?: string[];
  links?: DesignDocLinkInput[];
  /** OCC token — the `updated_at` the editor seeded from; mismatch → 409. */
  expected_updated_at?: string;
}

export interface UpdateDesignDocParticipantData {
  content?: string | null;
  status?: DesignDocParticipantStatus;
  assignee_id?: string | null;
  department_id?: string;
  clickup_tasks?: DesignDocClickUpTaskInput[];
  media?: DesignDocMediaInput[];
  expected_updated_at?: string;
}

export interface AddDesignDocParticipantData {
  /** Defaults to the assignee's profile department when omitted. */
  department_id?: string;
  assignee_id: string;
}

export interface AddDesignDocCommentData {
  participant_id?: number | null;
  /** Set for a reply; the DAL re-parents replies-of-replies to the root. */
  parent_comment_id?: number | null;
  /** Required on root comments, ignored on replies. */
  comment_type?: DesignDocCommentType;
  title?: string | null;
  body: string;
}

/** The dashboard's readiness filter (`?ready=`). */
export type DesignDocReadyFilter = 'ready' | 'not_ready';

export interface DesignDocFilters {
  ready?: DesignDocReadyFilter;
  search?: string;
  mine?: 'open';
  limit?: number;
  offset?: number;
}

export interface DesignDocListResponse {
  data: DesignDoc[];
  count: number;
}

export interface DesignDocStats {
  total: number;
  /** Docs whose every section is signed off with no open blocking comment. */
  ready: number;
  not_ready: number;
  waiting_on_me_docs: number;
  waiting_on_me_tasks: number;
}
