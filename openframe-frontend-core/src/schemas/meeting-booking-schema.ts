import { z } from 'zod';

/**
 * Meeting-booking wire contracts + validation factory.
 *
 * SERVER-SAFE tsup entry (no "use client" banner) with its OWN per-file
 * subpath (`./schemas/meeting-booking-schema`) — same pattern and reasons as
 * `schemas/contact-schema`: used by BOTH the lib's `<HubSpotMeetingScheduler>`
 * (client-side validation) AND the host's server-side booking route, which
 * REBUILDS the schema from the link's own fetched metadata and never trusts a
 * client-shaped instance. zod is an optional peer quarantined to per-subpath
 * verticals — do NOT re-export this module through any broad barrel.
 *
 * Every cross-boundary type for the scheduling feature lives HERE (the lib
 * owns the contract; hosts import this subpath directly, type-only where
 * possible).
 */

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/**
 * Sanitized availability payload served by the host proxy
 * (`GET {apiBaseUrl}/api/meetings/availability?meeting=<id>&monthOffset=<n>`).
 *
 * NO timezone field on purpose: slot starts are absolute epoch-ms instants
 * (verified timezone-independent against the live API), upstream fetches are
 * UTC-pinned, and ALL zone rendering happens client-side. Slots must be
 * whitelist-copied from HubSpot's `linkAvailability` ONLY — never derived
 * from busy-time data.
 */
export interface MeetingAvailability {
  meetingId: string;
  monthOffset: number;
  hasMore: boolean;
  /** Offered durations in ms — HubSpot's native unit for the booking POST. */
  durationsMs: number[];
  /** Bookable slot start times (epoch ms), keyed by duration in ms. */
  slotsByDurationMs: Record<string, number[]>;
  formFields: MeetingFormField[];
  /** Verbatim whitelist-copy of HubSpot's `legalConsentOptions` when consent is enabled; null when disabled. */
  legalConsent: MeetingLegalConsent | null;
  /**
   * Who the visitor is meeting — whitelisted DISPLAY projection the host DAL
   * builds from its own people data (e.g. a profiles table matched
   * server-side). NEVER carries emails or busy-time data; optional so
   * existing hosts stay wire-compatible.
   */
  hosts?: MeetingHost[];
}

/** Display-only host identity for the scheduler's context panel. */
export interface MeetingHost {
  name: string;
  avatarUrl: string | null;
  /** Job title / role line under the name (null → omitted). */
  title: string | null;
}

/**
 * One scheduling link on the DIRECTORY wire (`GET /api/meetings`) — the
 * host-DAL whitelist projection consumed by `MeetingSchedulerDirectory` and
 * host pages. Never carries organizer emails/busy-time data.
 */
export interface SchedulingLink {
  id: string;
  /** The link's public HubSpot booking URL — escape-hatch target only. */
  link: string;
  /** HubSpot slug path — the row's in-app destination is `<basePath>/<slug>`. */
  slug: string;
  /** Audience group key (slugified audience label; `"other"` in scope=all). */
  purpose: string;
  title: string;
  description: string | null;
  kind: 'personal' | 'team';
  /** Display-only minutes projection (booking stays ms end-to-end). */
  durationsMinutes: number[];
  hosts: MeetingHost[];
  /** Earliest bookable slot (epoch ms) from the current-month payload. */
  nextAvailableMs: number | null;
}

export interface SchedulingLinksPayload {
  purposes: Array<{ purpose: string; label: string; links: SchedulingLink[] }>;
  fetchedAt: string;
}

export interface MeetingFormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

/**
 * HubSpot's consent copy, rendered VERBATIM by the widget (GDPR surface —
 * never edited, never summarized). Responses are keyed by
 * `communicationTypeId`.
 */
export interface MeetingLegalConsent {
  processingConsentText: string;
  processingConsentCheckboxLabel: string | null;
  communicationConsentText: string | null;
  communicationConsentCheckboxes: Array<{
    communicationTypeId: string;
    label: string;
    required: boolean;
  }>;
  privacyPolicyText: string | null;
  isLegitimateInterest: boolean;
}

/**
 * Whitelisted booking result returned by the host proxy — the THIRD HubSpot
 * payload that reaches a browser, so it gets the same whitelist-copy
 * treatment as the two GETs. Nothing organizer-derived.
 */
export interface BookingConfirmation {
  meetingId: string;
  title: string;
  startTimeMs: number;
  durationMs: number;
}

/**
 * Typed domain errors the booking route emits; the widget keys its recovery
 * UI off these. `SLOT_TAKEN` → refetch-and-recover; `TEMPORARILY_UNAVAILABLE`
 * → retry affordance; `MEETING_UNAVAILABLE` → daily ceiling exhausted
 * (escape hatch, not a retry timer); `LINK_GONE` → link deleted upstream;
 * `INVALID_EMAIL` → HubSpot rejected the attendee address (its
 * MeetingsBookingCreatedError.INVALID_EMAIL class — fake/unreachable
 * mailboxes), so the widget tells the visitor to fix the email instead of
 * blaming the slot or their other details.
 */
export type MeetingBookingErrorCode =
  'SLOT_TAKEN' | 'VALIDATION' | 'INVALID_EMAIL' | 'LINK_GONE' | 'TEMPORARILY_UNAVAILABLE' | 'MEETING_UNAVAILABLE';

// ---------------------------------------------------------------------------
// Field-type vocabulary — ONE set drives the renderer AND the validator
// ---------------------------------------------------------------------------

/**
 * HubSpot custom-question types the native form supports. The widget's
 * renderer switches over THIS set and `makeBookingSchema` maps over THIS set;
 * fail-closed = a field whose `type` is not in the set (the widget then
 * renders the "Open in HubSpot" escape hatch for that link instead of a
 * half-working native form). Exact upstream type strings are pinned against
 * the rollout fixture link — extend here (renderer + validator move together).
 */
export const SUPPORTED_FORM_FIELD_TYPES = ['text', 'textarea', 'select', 'radio', 'checkbox'] as const;
export type SupportedFormFieldType = (typeof SUPPORTED_FORM_FIELD_TYPES)[number];

export function isSupportedFormField(field: MeetingFormField): boolean {
  return (SUPPORTED_FORM_FIELD_TYPES as readonly string[]).includes(field.type);
}

// ---------------------------------------------------------------------------
// Validators (single home — client widget and server rebuild both use these)
// ---------------------------------------------------------------------------

const IANA_TZ_RE = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/;

/**
 * IANA timezone check. Shape prefilter, then the authoritative resolution
 * test: `Intl.DateTimeFormat` throws on unknown zones. NOT
 * `Intl.supportedValuesOf('timeZone')` — that list excludes `'UTC'` itself
 * (verified in Node), which is a legitimate booking zone. Reject, never coerce.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!IANA_TZ_RE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** BCP-47 locale shape check via `Intl.getCanonicalLocales`. Reject, never coerce. */
export function isValidBcp47Locale(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale).length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Schema factory
// ---------------------------------------------------------------------------

/**
 * Build the booking-form schema for ONE link's declared questions + consent.
 *
 * A factory (not a static schema) because per-link required questions cannot
 * be expressed statically. The widget builds it from the availability payload
 * it rendered; the server REBUILDS it from the link's own fetched metadata —
 * required-consent enforcement flows from this rebuild, not a parallel check.
 *
 * Deliberately NOT `.strict()`: the humanity-signal fields
 * (`HUMANITY_SIGNAL_KEYS` from `utils/humanity-signals`) ride alongside in
 * the same POST body (read raw by the host's bot gate BEFORE parsing) and are
 * stripped server-side before anything reaches HubSpot. zod's default
 * unknown-key stripping means the parsed output never contains them.
 *
 * `timezone`/`locale` are POST-only presentation fields (the invite renders
 * in the visitor's local time) — this schema is the ONLY place a
 * client-supplied zone is accepted; the availability path is UTC-pinned.
 */
export function makeBookingSchema(formFields: MeetingFormField[], legalConsent: MeetingLegalConsent | null) {
  const answers: Record<string, z.ZodTypeAny> = {};
  for (const field of formFields) {
    if (!isSupportedFormField(field)) continue; // unsupported types are fail-closed at render time
    let validator: z.ZodTypeAny;
    switch (field.type as SupportedFormFieldType) {
      case 'checkbox':
        validator = z.boolean();
        break;
      case 'select':
      case 'radio':
        validator = z.string().refine(v => !v || (field.options ?? []).includes(v), {
          message: `Please choose a valid option for ${field.label}`,
        });
        break;
      case 'textarea':
        validator = z.string().max(5000, { message: `${field.label} is too long` });
        break;
      case 'text':
      default:
        validator = z.string().max(1000, { message: `${field.label} is too long` });
        break;
    }
    if (field.required) {
      validator =
        field.type === 'checkbox'
          ? z.literal(true, { message: `${field.label} is required` })
          : (validator as z.ZodString).min(1, { message: `${field.label} is required` });
    } else if (field.type !== 'checkbox') {
      validator = (validator as z.ZodString).optional().or(z.literal(''));
    } else {
      validator = z.boolean().optional();
    }
    answers[field.name] = validator;
  }

  const requiredConsentIds = (legalConsent?.communicationConsentCheckboxes ?? [])
    .filter(c => c.required)
    .map(c => c.communicationTypeId);

  // A required answer cannot be enforced by an `.optional()` parent object —
  // omitting the `formFields` key entirely would skip every per-question
  // rule. When the link declares at least one required supported question,
  // the object itself is required.
  const hasRequiredAnswers = formFields.some(f => isSupportedFormField(f) && f.required);
  const answersObject = z.object(answers);

  return (
    z
      .object({
        meetingId: z.string().min(1),
        startTimeMs: z.number().int().positive(),
        durationMs: z.number().int().positive(),
        firstName: z.string().min(1, { message: 'First name is required' }).max(255),
        lastName: z.string().min(1, { message: 'Last name is required' }).max(255),
        email: z.string().email({ message: 'Please enter a valid email address' }).max(255),
        timezone: z.string().refine(isValidIanaTimezone, { message: 'Invalid timezone' }),
        locale: z.string().refine(isValidBcp47Locale, { message: 'Invalid locale' }).optional(),
        // Plain `.optional()` (no `.default()`) so zod's input and output types
        // match — react-hook-form's zodResolver needs them identical, and the
        // server handles `undefined` explicitly anyway. REQUIRED when the link
        // declares required questions (see `hasRequiredAnswers` above).
        formFields: hasRequiredAnswers ? answersObject : answersObject.optional(),
        legalConsentResponses: z
          .array(z.object({ communicationTypeId: z.string(), consented: z.boolean() }))
          .optional(),
      })
      // Object-level rule: `.refine` on an `.optional()` field is skipped when
      // the field is absent — required consents must reject even on a payload
      // that omits the array entirely.
      .superRefine((data, ctx) => {
        const responses = data.legalConsentResponses ?? [];
        const ok = requiredConsentIds.every(id =>
          responses.some(r => r.communicationTypeId === id && r.consented === true),
        );
        if (!ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['legalConsentResponses'],
            message: 'Required consent checkboxes must be accepted',
          });
        }
      })
  );
}

export type MeetingBookingPayload = z.infer<ReturnType<typeof makeBookingSchema>>;
