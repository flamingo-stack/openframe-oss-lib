/**
 * Form rescue — the shared rules for saving a half-filled public form so the
 * team can follow up with a visitor who left before submitting.
 *
 * Pure and server-safe: the browser hook (`hooks/use-form-rescue`) and the
 * host's draft endpoint import the SAME allowlist, exclusions, caps and
 * completion math, so the server re-applies exactly the filter the client ran
 * and a rename here reaches both sides at once. Also exported through the
 * granular subpath `./utils/form-rescue` for server-only consumers.
 *
 * What a draft may carry:
 *   - values of ALLOWLISTED contact fields only (`FORM_RESCUE_VALUE_FIELDS`),
 *     trimmed and capped at `FORM_RESCUE_MAX_VALUE_CHARS`;
 *   - for every other field, only whether it is filled (never its value);
 *   - nothing whose name looks like a credential or payment field
 *     (`isExcludedRescueField`), whatever the allowlist says.
 *
 * Field values go to the host only, never to analytics: the PostHog events
 * (`captureFormRescueEvent`) carry ids, field names and percentages.
 */

/**
 * A rescuable form, defined ONCE beside the form that uses it (the strategy a
 * form plugs in with). The browser sends `id`; the host validates it with
 * `getRescueForm` and shows `label` to the team. A new form is one
 * `defineRescueForm` call: no central list, no host change.
 */
export interface FormRescueDefinition {
  /** Stable wire id: lower snake case, stored on every draft of this form. */
  readonly id: string;
  /** What the team reads on the alert ("Contact form"). */
  readonly label: string;
}

const FORM_ID_PATTERN = /^[a-z][a-z0-9_]{1,47}$/;
const definitions = new Map<string, FormRescueDefinition>();

/**
 * Register a rescuable form. Idempotent for the same id and label (a module
 * evaluated twice registers once); a second, different definition of one id
 * throws, so two forms can never share a draft vocabulary.
 */
export function defineRescueForm(definition: FormRescueDefinition): FormRescueDefinition {
  if (!FORM_ID_PATTERN.test(definition.id)) throw new Error(`[form-rescue] invalid form id "${definition.id}"`);
  const existing = definitions.get(definition.id);
  if (existing) {
    if (existing.label !== definition.label) {
      throw new Error(`[form-rescue] form id "${definition.id}" is already defined as "${existing.label}"`);
    }
    return existing;
  }
  const frozen = Object.freeze({ id: definition.id, label: definition.label });
  definitions.set(frozen.id, frozen);
  return frozen;
}

/** The registered definition for a wire id, or null (unknown ids are refused by the host). */
export function getRescueForm(id: unknown): FormRescueDefinition | null {
  return typeof id === 'string' ? (definitions.get(id) ?? null) : null;
}

/** Every registered form, for a host listing them. */
export function listRescueForms(): FormRescueDefinition[] {
  return [...definitions.values()];
}

/** The lib's own public forms. A host defines its own forms the same way, beside them. */
export const RESCUE_FORMS = {
  contact: defineRescueForm({ id: 'contact', label: 'Contact form' }),
  caseStudyPitch: defineRescueForm({ id: 'case_study_pitch', label: 'Case study pitch' }),
  dataRoomRequest: defineRescueForm({ id: 'data_room_request', label: 'Data room request' }),
  trustCenterRequest: defineRescueForm({ id: 'trust_center_request', label: 'Trust Center document request' }),
  meetingBooking: defineRescueForm({ id: 'meeting_booking', label: 'Meeting booking' }),
  waitlist: defineRescueForm({ id: 'waitlist', label: 'Waitlist' }),
} as const;

/**
 * Fields whose VALUES a draft keeps: who the visitor is and where they work.
 * Covers both naming schemes in use (the contact form's `name` / `companySize`,
 * the meeting booking's HubSpot `firstName` / `company` / `jobtitle`).
 * Free text (`message`) and phone numbers are reported as filled only.
 */
export const FORM_RESCUE_VALUE_FIELDS = [
  'email',
  'name',
  'firstName',
  'lastName',
  'company',
  'jobtitle',
  'companySize',
  'linkedin_url',
] as const;

/** Never send or store these, whatever the allowlist says. */
const EXCLUDED_FIELD_PATTERN =
  /pass(word|code)?|card|cvv|cvc|ssn|social.?security|iban|bank|routing|token|secret|otp|pin$/i;

export function isExcludedRescueField(name: string): boolean {
  return EXCLUDED_FIELD_PATTERN.test(name);
}

/** Longest value a draft keeps per field. */
export const FORM_RESCUE_MAX_VALUE_CHARS = 200;
/** Save this long after the visitor stops typing. */
export const FORM_RESCUE_DEBOUNCE_MS = 1500;
/** Most fields a draft reports (filled names), a bound on the payload. */
export const FORM_RESCUE_MAX_FIELDS = 40;

/** Body keys a form's SUBMIT carries so the host can close the matching draft. */
export const FORM_RESCUE_ATTEMPT_FIELD = 'form_attempt_id';
export const FORM_RESCUE_RESUME_FIELD = 'form_resume_token';
/** Every rescue key that rides in a submit body. Hosts forwarding a payload upstream strip by THIS array. */
export const FORM_RESCUE_SUBMIT_KEYS = [FORM_RESCUE_ATTEMPT_FIELD, FORM_RESCUE_RESUME_FIELD] as const;

/** Query parameter a resume link carries. */
export const FORM_RESCUE_RESUME_PARAM = 'resume';

/** Draft lifecycle. `submitted` is final; `rescued` can still become `submitted`. */
export const FORM_DRAFT_STATUSES = ['started', 'rescuable', 'rescued', 'submitted'] as const;
export type FormDraftStatus = (typeof FORM_DRAFT_STATUSES)[number];

/** Why a due draft was settled WITHOUT alerting the team (stored on the draft). */
export const FORM_RESCUE_SKIP_REASONS = {
  finishedElsewhere: 'finished_elsewhere',
  alreadyRescued: 'already_rescued',
  internal: 'internal_email',
} as const;
export type FormRescueSkipReason = (typeof FORM_RESCUE_SKIP_REASONS)[keyof typeof FORM_RESCUE_SKIP_REASONS];

/** Same shape the host's `contact_submissions.email` check accepts. */
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function isRescueEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= FORM_RESCUE_MAX_VALUE_CHARS && EMAIL_PATTERN.test(value.trim());
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFormAttemptId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(isFilled);
  return true;
}

/**
 * Keep only allowlisted, non-excluded string values, trimmed and capped.
 * The ONE filter, run by the browser before sending and by the host before storing.
 */
export function sanitizeRescueValues(values: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!values || typeof values !== 'object') return out;
  for (const key of FORM_RESCUE_VALUE_FIELDS) {
    if (isExcludedRescueField(key)) continue;
    const raw = values[key];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, FORM_RESCUE_MAX_VALUE_CHARS);
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

/** Names of the given fields that hold something, credentials never included. */
export function filledRescueFields(values: Record<string, unknown>, fieldNames: readonly string[]): string[] {
  return fieldNames
    .filter(name => !isExcludedRescueField(name) && isFilled(values[name]))
    .slice(0, FORM_RESCUE_MAX_FIELDS);
}

export function rescueCompletionPct(filledCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((filledCount / totalCount) * 100)));
}

/** A field NAME the host stores (`last_field`, `fields_filled`); bounded, printable. */
export function sanitizeRescueFieldName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_.-]{1,64}$/.test(trimmed) && !isExcludedRescueField(trimmed) ? trimmed : null;
}

/** A form's progress at one moment: allowlisted values, filled field names, position. */
export interface FormDraftProgress {
  values: Record<string, string>;
  fields_filled: string[];
  last_field: string | null;
  completion_pct: number;
}

/** What the browser sends on every save (`POST <formDraftsUrl>`), beside the humanity signals. */
export interface FormDraftSaveRequest extends FormDraftProgress {
  /** The attempt's idempotency key: every save of one attempt updates one draft. */
  attempt_id: string;
  /** A `FormRescueDefinition.id`. */
  form_id: string;
  source_path: string;
  utm?: Partial<Record<'source' | 'medium' | 'campaign' | 'content' | 'term', string>>;
  /** Set when the visitor came back through a resume link: the host saves onto
   *  THAT draft, so one person's return never starts a second draft. */
  resume_token?: string;
}

/** What the host answers a resume link with: the allowlisted values, nothing internal. */
export interface FormDraftResumeResponse {
  form_id: string;
  values: Record<string, string>;
}

/** The PostHog events this feature emits. Properties are ids, names and numbers, never values. */
export const FORM_RESCUE_EVENTS = {
  started: 'form_started',
  progress: 'form_progress',
  leadCaptured: 'form_lead_captured',
  abandoned: 'form_abandoned',
  submitted: 'form_submitted',
  rescued: 'form_rescued',
  resumed: 'form_resumed',
} as const;

type AnalyticsValue = string | number | boolean | string[] | null;

/**
 * Send one form event to PostHog when the page loaded it (GTM exposes
 * `window.posthog`); a no-op otherwise. Never throws.
 */
export function captureFormRescueEvent(event: string, properties: Record<string, AnalyticsValue>): void {
  try {
    if (typeof window === 'undefined') return;
    const ph = (window as unknown as { posthog?: { capture?: (e: string, p: object) => void } }).posthog;
    if (typeof ph?.capture === 'function') ph.capture(event, properties);
  } catch {
    // Analytics never breaks a form.
  }
}
