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
export const MEETING_BOOKING_ERROR_CODES = [
  'SLOT_TAKEN',
  'VALIDATION',
  'INVALID_EMAIL',
  'LINK_GONE',
  'TEMPORARILY_UNAVAILABLE',
  'MEETING_UNAVAILABLE',
] as const;

/**
 * Derived from the runtime array ABOVE — the array is the single source of
 * truth. The booking hook validates server codes against it at runtime, so a
 * code added only to a hand-written type would be silently coerced to
 * TEMPORARILY_UNAVAILABLE by every deployed widget (exactly how the
 * INVALID_EMAIL rollout mis-rendered on 2026-08-27: type extended, runtime
 * allowlist stale — an array annotation is not exhaustiveness-checked).
 */
export type MeetingBookingErrorCode = (typeof MEETING_BOOKING_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Field-type vocabulary — ONE set drives the renderer AND the validator
// ---------------------------------------------------------------------------

/**
 * THE registry of HubSpot question types the native form supports — one entry
 * per `fieldType`, and the ONLY place a type is declared. Everything else
 * derives from it: `SupportedFormFieldType` is its key union,
 * `SUPPORTED_FORM_FIELD_TYPES` its keys, `FORM_FIELD_TYPES_WITH_OPTIONS` the
 * entries that carry `options`, and `makeBookingSchema` maps each answer
 * through the entry's validator. The widget's control table
 * (`booking-form.tsx`) is a `Record` over the same key union, so a type added
 * here without a control is a COMPILE error, not a silent gap.
 *
 * Fail-closed: a `fieldType` with no entry makes the link "not natively
 * bookable" and the card falls back to the HubSpot escape hatch.
 *
 * Every string type rides the wire as a STRING (HubSpot's book endpoint takes
 * `{ name, value: string }`); `checkbox` is the one boolean. `number` is a
 * Number property validated as a decimal literal — what `<input type="number">`
 * emits and what the property stores.
 */
export interface FormFieldTypeSpec {
  /** The answer's wire shape, which also decides how required/optional wraps it. */
  kind: 'string' | 'boolean';
  /** Whether HubSpot publishes `options` for the type (the pickers). */
  hasOptions: boolean;
  /**
   * The validator for ONE answer. String types EXTEND `base`, which already
   * carries the required-ness (`min(1)` when required) — so "X is required" is
   * the first issue reported for an empty answer, ahead of the type's own rule.
   * Boolean types ignore it.
   */
  validator: (field: MeetingFormField, base: z.ZodString) => z.ZodTypeAny;
  /** The control's placeholder, derived from the field (the mock's "Enter Company Name"). */
  placeholder?: (field: MeetingFormField) => string;
}

const optionValidator: FormFieldTypeSpec['validator'] = (field, base) =>
  base.refine(v => !v || (field.options ?? []).includes(v), {
    message: `Please choose a valid option for ${field.label}`,
  });

export const FORM_FIELD_TYPES = {
  text: {
    kind: 'string',
    hasOptions: false,
    validator: (field, base) => base.max(1000, { message: `${field.label} is too long` }),
    placeholder: field => `Enter ${field.label}`,
  },
  textarea: {
    kind: 'string',
    hasOptions: false,
    validator: (field, base) => base.max(5000, { message: `${field.label} is too long` }),
    placeholder: field => `Enter text${field.required ? '' : ' (optional)'}`,
  },
  number: {
    kind: 'string',
    hasOptions: false,
    // Canonical decimal literal — the control normalises what the browser
    // accepts (`1e3`, `007`) to this before it is validated or sent.
    validator: (field, base) =>
      base
        .max(32, { message: `${field.label} is too long` })
        .regex(/^-?\d+(\.\d+)?$/, { message: `${field.label} must be a number` }),
  },
  select: { kind: 'string', hasOptions: true, validator: optionValidator },
  radio: { kind: 'string', hasOptions: true, validator: optionValidator },
  checkbox: { kind: 'boolean', hasOptions: false, validator: () => z.boolean() },
} as const satisfies Record<string, FormFieldTypeSpec>;

export type SupportedFormFieldType = keyof typeof FORM_FIELD_TYPES;

export const SUPPORTED_FORM_FIELD_TYPES = Object.keys(FORM_FIELD_TYPES) as readonly SupportedFormFieldType[];

/** The types whose `options` the host must forward (select, radio). */
export const FORM_FIELD_TYPES_WITH_OPTIONS: readonly SupportedFormFieldType[] = SUPPORTED_FORM_FIELD_TYPES.filter(
  type => FORM_FIELD_TYPES[type].hasOptions,
);

export function isSupportedFormField(field: MeetingFormField): field is SupportedMeetingFormField {
  return Object.prototype.hasOwnProperty.call(FORM_FIELD_TYPES, field.type);
}

/** A declared question whose `type` is in the registry. */
export type SupportedMeetingFormField = MeetingFormField & { type: SupportedFormFieldType };

/**
 * The scheduler's fixed identity fields. HubSpot's book endpoint takes them
 * TOP-LEVEL (`firstName`, `lastName`, `email`), its own booking page hardcodes
 * them, and the link's `formFields` never lists them — so they are data HERE,
 * rendered by the widget through the SAME control path as every declared
 * question, rather than three hand-written blocks. `inputType`/`autoComplete`
 * are the browser hints a text control takes; the wire and the validator do
 * not see them.
 */
export interface BuiltInBookingField extends MeetingFormField {
  type: 'text';
  required: true;
  inputType?: 'email';
  autoComplete: string;
  placeholder: string;
  /** The wire's own required/format message — kept verbatim from the schema it replaced. */
  requiredMessage: string;
}

export const BUILT_IN_BOOKING_FIELDS = [
  {
    name: 'firstName',
    label: 'First Name',
    type: 'text',
    required: true,
    autoComplete: 'given-name',
    placeholder: 'Enter First Name',
    requiredMessage: 'First name is required',
  },
  {
    name: 'lastName',
    label: 'Last Name',
    type: 'text',
    required: true,
    autoComplete: 'family-name',
    placeholder: 'Enter Last Name',
    requiredMessage: 'Last name is required',
  },
  {
    name: 'email',
    label: 'Email',
    type: 'text',
    required: true,
    inputType: 'email',
    autoComplete: 'email',
    placeholder: 'username@mail.com',
    requiredMessage: 'Please enter a valid email address',
  },
] as const satisfies readonly BuiltInBookingField[];

/** `'firstName' | 'lastName' | 'email'` — derived from the array, never restated. */
export type BuiltInBookingFieldName = (typeof BUILT_IN_BOOKING_FIELDS)[number]['name'];

/** The registry entry for a supported type, widened to the spec so optional
 *  members (`placeholder`) are readable without narrowing on the union. */
export function fieldTypeSpec(type: SupportedFormFieldType): FormFieldTypeSpec {
  return FORM_FIELD_TYPES[type];
}

/** The wire validator for one identity field, from ITS declaration above. */
function identityValidator(name: BuiltInBookingFieldName) {
  const field: BuiltInBookingField | undefined = BUILT_IN_BOOKING_FIELDS.find(f => f.name === name);
  if (!field) throw new Error(`Unknown built-in booking field: ${name}`);
  const base = z.string().max(255);
  return field.inputType === 'email'
    ? base.email({ message: field.requiredMessage })
    : base.min(1, { message: field.requiredMessage });
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
function buildBookingSchema<TStart extends z.ZodTypeAny, TDuration extends z.ZodTypeAny, TZone extends z.ZodTypeAny>(
  formFields: MeetingFormField[],
  legalConsent: MeetingLegalConsent | null,
  // Passed IN rather than switched on a boolean: a `deferSlot: boolean`
  // parameter cannot be narrowed at type level, so every ternary inside would
  // infer a union and widen `startTimeMs`/`durationMs` to `number | null |
  // undefined` for BOTH schemas — including the server's wire type.
  slot: { startTimeMs: TStart; durationMs: TDuration; timezone: TZone },
) {
  const answers: Record<string, z.ZodTypeAny> = {};
  for (const field of formFields) {
    if (!isSupportedFormField(field)) continue; // unsupported types are fail-closed at render time
    const spec: FormFieldTypeSpec = FORM_FIELD_TYPES[field.type];
    // required/optional wrapping follows the answer's wire KIND, not its type:
    // a boolean is true-or-absent, a string is non-empty-or-empty. For strings
    // the required check is the FIRST rule on the chain, so an empty answer
    // reports "is required" rather than the type's own message.
    let validator: z.ZodTypeAny;
    if (spec.kind === 'boolean') {
      validator = field.required ? z.literal(true, { message: `${field.label} is required` }) : z.boolean().optional();
    } else {
      const base = field.required ? z.string().min(1, { message: `${field.label} is required` }) : z.string();
      validator = spec.validator(field, base);
      if (!field.required) validator = validator.optional().or(z.literal(''));
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
        startTimeMs: slot.startTimeMs,
        durationMs: slot.durationMs,
        // The identity trio's rules come from BUILT_IN_BOOKING_FIELDS — the
        // keys stay literal so the payload type keeps its named properties.
        firstName: identityValidator('firstName'),
        lastName: identityValidator('lastName'),
        email: identityValidator('email'),
        timezone: slot.timezone,
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

/**
 * The STRICT schema — the wire contract. The server rebuilds it from the link's
 * own fetched metadata and validates every booking against it; a slot and a
 * duration are not optional on anything that reaches HubSpot.
 */
export function makeBookingSchema(formFields: MeetingFormField[], legalConsent: MeetingLegalConsent | null) {
  return buildBookingSchema(formFields, legalConsent, {
    startTimeMs: z.number().int().positive(),
    durationMs: z.number().int().positive(),
    timezone: z.string().refine(isValidIanaTimezone, { message: 'Invalid timezone' }),
  });
}

/**
 * The DEFERRED schema — same fields, with the slot/duration/timezone triple
 * relaxed. `flow="details-first"` collects answers BEFORE a slot exists, so the
 * form validates against this and the parent re-attaches the authoritative
 * values at POST time.
 *
 * Two named exports over one private builder rather than an overload or an
 * options flag: `MeetingBookingPayload` is `z.infer<ReturnType<...>>`, and
 * either of those alternatives would widen `startTimeMs`/`durationMs` to
 * `number | undefined` for EVERY consumer — including the server's
 * `durationsMs.includes(data.durationMs)`.
 */
export function makeDeferredBookingSchema(formFields: MeetingFormField[], legalConsent: MeetingLegalConsent | null) {
  // `.nullish()`, not `.optional()`: the widget passes these straight into
  // `defaultValues`, and details-first has `timezone === null` on the server
  // render and the first client render (zone resolution is post-hydration).
  // Accepting only `undefined` would reject a field with no rendered control
  // and no FieldWrapper — the submit button silently dead, type-check clean.
  return buildBookingSchema(formFields, legalConsent, {
    startTimeMs: z.number().int().positive().nullish(),
    durationMs: z.number().int().positive().nullish(),
    timezone: z.string().refine(isValidIanaTimezone, { message: 'Invalid timezone' }).nullish(),
  });
}

/** The wire payload. Pinned to the STRICT builder — see above. */
export type MeetingBookingPayload = z.infer<ReturnType<typeof makeBookingSchema>>;

/**
 * The form's value type, used as the `useForm` generic in BOTH flows: a relaxed
 * resolver is not assignable to `Resolver<MeetingBookingPayload>`, and mixing
 * the two survives only on TS's bivariant method-parameter check.
 */
export type BookingFormValues = z.infer<ReturnType<typeof makeDeferredBookingSchema>>;
