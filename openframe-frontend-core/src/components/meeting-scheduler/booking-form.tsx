'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode, Ref } from 'react';
import { useForm, Controller } from 'react-hook-form';
import type { Control, Path, UseFormRegister } from 'react-hook-form';
import { useRescuedForm } from '../../hooks/use-rescued-form';
import { useToast } from '../../hooks/use-toast';
import {
  BUILT_IN_BOOKING_FIELDS,
  type BuiltInBookingFieldName,
  DECIMAL_LITERAL_RE,
  fieldTypeSpec,
  makeDeferredBookingSchema,
  withDeniedEmailDomains,
  emailDomainDenied,
  type DeniedEmailDomains,
  MULTI_VALUE_SEPARATOR,
  bookingFormAsks,
  normalizeFormFields,
  splitMultiValue,
  type BuiltInBookingField,
  type MeetingAvailability,
  type SupportedFormFieldType,
  type MeetingFormField,
  type SupportedMeetingFormField,
  type BookingFormValues,
} from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import type { FormRescueDefinition } from '../../utils/form-rescue';
import { HUBSPOT_DO_NOT_COLLECT_FORM_PROPS } from '../../utils/hubspot-collected-forms';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import {
  Button,
  FieldWrapper,
  fieldLabelId,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  CheckboxBlock,
  RadioGroup,
  RadioGroupItem,
  ToggleGroup,
  ToggleGroupItem,
} from '../ui';
import { HoneypotField } from '../ui/honeypot-field';
import { useLoadingScope } from '../ui/loading-scope';
import { TOGGLE_SIZE_CLASS } from '../ui/toggle';

/**
 * One field in a host-supplied row. `name` is a built-in (`email`, `firstName`,
 * `lastName`) or a HubSpot-declared question's `name`.
 */
export interface BookingFieldSlot {
  /** Built-ins autocomplete; a HubSpot question's `name` is whatever the link declares. */
  name: BuiltInBookingFieldName | (string & NonNullable<unknown>);
  /** Columns out of four at `md` and up. Defaults to an even split of the row. */
  span?: BookingFieldSpan;
}

/** Columns out of `GRID_COLUMNS` at `md` and up — the keys of `SPAN_CLASS`. */
export type BookingFieldSpan = keyof typeof SPAN_CLASS;

export type BookingFieldRow = BookingFieldSlot[];

/**
 * Display copy a HOST overrides for ONE field, keyed by its name — a built-in
 * (`email`) or a HubSpot-declared question. It replaces what is DRAWN and
 * nothing else: the name the answer rides under, the validation and the
 * schema's own messages are untouched, so a campaign page can ask for a
 * "Business Email" without owning a second email rule.
 *
 * An overridden `label` also feeds the type's derived placeholder
 * (`Enter <label>`), so overriding the label alone keeps the pair consistent.
 */
export interface BookingFieldCopy {
  label?: string;
  placeholder?: string;
  /**
   * How a CHOICE question (`select`, `radio`) is drawn. Omitted or `dropdown`:
   * the question's own control (a select, or radio buttons). `chips`: one-tap
   * chips, when the link offers at most `CHIP_MAX_OPTIONS` answers (past it, the
   * question's own control). The answers, their name and their validation are
   * always the link's own.
   */
  display?: 'chips' | 'dropdown';
}

/**
 * A HOST-supplied consent row — the block the waitlist form draws for its SMS
 * consent, here for "I agree to the Privacy Policy and to be contacted". It is
 * the host's copy and the host's link, so it is a prop, not HubSpot metadata;
 * HubSpot's own `legalConsent` block (verbatim, declared on the link) renders
 * alongside when the link carries one.
 *
 * A client-side gate, exactly like the waitlist's: Continue is refused until it
 * is ticked, and the tick rides in the payload as `hostConsent` — which the
 * host's book route strips as an undeclared key. It is not a HubSpot consent
 * record; declare `legalConsent` on the link when one is required.
 */
export interface BookingFormConsent {
  label: ReactNode;
  description?: ReactNode;
  /** Shown under the row when Continue is pressed unticked. */
  errorMessage?: string;
}

/** The form's vertical rhythm — one stack for the loaded form and its skeleton. */
const FORM_STACK = 'flex flex-col gap-[var(--spacing-system-l)]';

/** The row grid: two columns on a phone, four from `md`. The row gap is one step
 *  wider than the column gap because field messages hang ~16px below their
 *  control and would print over the next row's label at the column gap. */
const ROW_GRID =
  'grid grid-cols-2 gap-x-[var(--spacing-system-m)] gap-y-[var(--spacing-system-lf)] content-md:grid-cols-4';

/** The wire key of the host consent tick (stripped server-side, never sent to HubSpot). */
const HOST_CONSENT_KEY = 'hostConsent';

/** The row grid's column count at `md` and up. `ROW_GRID`'s `content-md:grid-cols-4`
 *  and `SPAN_CLASS` are its Tailwind twins (literal so the scanner sees them). */
const GRID_COLUMNS = 4;

/** Static so Tailwind's scanner sees every class — a template built from a
 *  runtime span would compile to nothing. */
const SPAN_CLASS = {
  1: 'content-md:col-span-1',
  2: 'content-md:col-span-2',
  3: 'content-md:col-span-3',
  4: 'content-md:col-span-4',
} as const;

/** The submit copy every standalone `BookingForm` gets; the slot-first preset reads the same constant. */
export const DEFAULT_SUBMIT_LABEL = 'Confirm Booking';

/** The footer with a note (details-first): note beside the button, wrapping on a phone. */
const FOOTER_ROW_CLASS = 'flex flex-wrap items-center justify-between gap-[var(--spacing-system-m)]';
/** The bare footer: the button stays LEFT, where the form's reading order ends. */
const FOOTER_BARE_CLASS = 'flex';
/** The submit's width when a note sits beside it. */
const SUBMIT_WIDE_CLASS = 'content-md:w-60';

/** The built-in layout when a host passes no rows — what the skeleton draws for it. */
const DEFAULT_FIELD_ROWS: BookingFieldRow[] = [[{ name: 'email' }], [{ name: 'firstName' }, { name: 'lastName' }]];

/** The even split of four columns over `count` slots; a remainder goes to the
 *  leading slots (three slots → 2/1/1), so a row never leaves a trailing gap. */
export const evenSpan = (count: number, index: number): BookingFieldSpan => {
  const base = Math.floor(GRID_COLUMNS / Math.max(1, count));
  const extra = GRID_COLUMNS - base * count;
  return Math.min(GRID_COLUMNS, Math.max(1, index < extra ? base + 1 : base)) as BookingFieldSpan;
};

/** ONE column rule for a slot, read by the loaded form and its skeleton: a
 *  two-field row stays side by side on a phone — the rule the built-in name pair
 *  has always followed: two short fields cost one line instead of two on the
 *  layout that can least afford them — and the span applies from `md`. */
const slotColumnClass = (row: BookingFieldRow, slot: BookingFieldSlot, index: number): string =>
  cn(row.length === 2 ? 'col-span-1' : 'col-span-2', SPAN_CLASS[slot.span ?? evenSpan(row.length, index)]);

/** What one control needs: the field, its DOM id, where it registers in the
 *  form, and the form's own register/control. */
interface ControlArgs {
  /** A declared question, or a built-in carrying its control hints (everything on the declaration that is not wire data). */
  field: SupportedMeetingFormField & Partial<Omit<BuiltInBookingField, keyof MeetingFormField | 'requiredMessage'>>;
  id: string;
  /** Top-level for the built-ins (`email`), `formFields.<name>` for declared questions. */
  registerName: string;
  /** The field's current validation message, so the control can say `aria-invalid`. */
  error?: string;
  register: UseFormRegister<BookingFormValues>;
  control: Control<BookingFormValues>;
}

/** A built-in carries its own placeholder; a declared question gets the one its
 *  TYPE derives (the registry's `placeholder`), so no copy lives here. */
const placeholderFor = (field: ControlArgs['field']): string | undefined =>
  field.placeholder ?? fieldTypeSpec(field.type).placeholder?.(field);

/** An option's display text: HubSpot's label when it differs from the submitted value. Exported: a host that asks
 *  one of the link's questions outside the form (a landing hero) words its answers the same way. */
export const formFieldOptionLabel = (field: Pick<MeetingFormField, 'optionLabels'>, value: string): string =>
  field.optionLabels?.[value] ?? value;

/** A free-text answer is sent without the whitespace a paste drags in. */
const trimmed = (v: unknown): string => String(v ?? '').trim();

/** `<input type="number">` accepts `1e3` and ` 12 `; the wire wants the
 *  decimal literal the validator checks. A value ALREADY in that shape passes
 *  verbatim (`007` included) — a long integer or a tiny decimal must not be
 *  reshaped through a float — and one that cannot be brought into it is left
 *  for the validator's own message. */
const canonicalNumber = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (s === '' || DECIMAL_LITERAL_RE.test(s)) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  const canonical = String(n);
  return DECIMAL_LITERAL_RE.test(canonical) ? canonical : s;
};

/**
 * ONE control per registry type. A `Record` over `SupportedFormFieldType` on
 * purpose: `FORM_FIELD_TYPES` (the schema module) is the single place a type is
 * declared, and this table cannot compile without an entry for each — so the
 * validator and the renderer can never disagree about what is supported.
 * Every control states `aria-invalid` from the field's message and carries
 * `required`/`aria-required` from the field, so the accent asterisk is never
 * the only signal. The ones that can PAINT the state take `invalid` too
 * (`Input`, `Textarea`, `SelectTrigger` — the lib's error border), so a refused
 * field reads as refused at the control, not only in the line beneath it.
 */
const FIELD_CONTROLS: Record<SupportedFormFieldType, (args: ControlArgs) => ReactNode> = {
  text: ({ field, id, registerName, error, register }) => (
    <Input
      id={id}
      type={field.inputType ?? 'text'}
      required={field.required}
      aria-invalid={Boolean(error)}
      invalid={Boolean(error)}
      autoComplete={field.autoComplete}
      placeholder={placeholderFor(field)}
      {...register(registerName as never)}
    />
  ),
  textarea: ({ field, id, registerName, error, register }) => (
    <Textarea
      id={id}
      required={field.required}
      aria-invalid={Boolean(error)}
      invalid={Boolean(error)}
      placeholder={placeholderFor(field)}
      {...register(registerName as never)}
    />
  ),
  number: ({ field, id, registerName, error, register }) => (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      step="any"
      required={field.required}
      aria-invalid={Boolean(error)}
      invalid={Boolean(error)}
      {...register(registerName as never, { setValueAs: canonicalNumber })}
    />
  ),
  phone: ({ field, id, registerName, error, register }) => (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      required={field.required}
      aria-invalid={Boolean(error)}
      invalid={Boolean(error)}
      placeholder={placeholderFor(field)}
      {...register(registerName as never, { setValueAs: trimmed })}
    />
  ),
  date: ({ field, id, registerName, error, register }) => (
    // The native picker emits exactly the wire shape (`YYYY-MM-DD`).
    <Input
      id={id}
      type="date"
      required={field.required}
      aria-invalid={Boolean(error)}
      invalid={Boolean(error)}
      {...register(registerName as never)}
    />
  ),
  select: ({ field, id, registerName, error, control }) => (
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => (
        <Select value={rhf.value ?? ''} onValueChange={rhf.onChange}>
          <SelectTrigger
            id={id}
            aria-required={field.required || undefined}
            aria-invalid={Boolean(error)}
            invalid={Boolean(error)}
          >
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map(opt => (
              <SelectItem key={opt} value={opt}>
                {formFieldOptionLabel(field, opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  ),
  radio: ({ field, id, registerName, error, control }) => (
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => (
        <RadioGroup
          value={rhf.value ?? ''}
          onValueChange={rhf.onChange}
          aria-required={field.required || undefined}
          aria-invalid={Boolean(error)}
        >
          {(field.options ?? []).map(opt => (
            <div key={opt} className="flex items-center gap-[var(--spacing-system-xs)]">
              <RadioGroupItem id={`${id}-${opt}`} value={opt} />
              <Label htmlFor={`${id}-${opt}`}>{formFieldOptionLabel(field, opt)}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
    />
  ),
  multiselect: ({ field, id, registerName, error, control }) => (
    // HubSpot's "multiple checkboxes": the answer is its `;`-joined value list,
    // held in that wire shape so the validator and the POST see one string.
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => {
        const selected = splitMultiValue(rhf.value);
        const toggle = (opt: string, on: boolean) => {
          const next = (field.options ?? []).filter(o => (o === opt ? on : selected.includes(o)));
          rhf.onChange(next.join(MULTI_VALUE_SEPARATOR));
        };
        return (
          <div id={id} role="group" className="flex flex-col gap-[var(--spacing-system-xs)]">
            {(field.options ?? []).map(opt => (
              <div key={opt} className="flex items-center gap-[var(--spacing-system-xs)]">
                <Checkbox
                  id={`${id}-${opt}`}
                  checked={selected.includes(opt)}
                  onCheckedChange={v => toggle(opt, v === true)}
                  aria-invalid={Boolean(error)}
                />
                <Label htmlFor={`${id}-${opt}`}>{formFieldOptionLabel(field, opt)}</Label>
              </div>
            ))}
          </div>
        );
      }}
    />
  ),
  checkbox: ({ field, id, registerName, error, control }) => (
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => (
        // The question's Label above already carries the text and binds to
        // this id — a second inline label would double the visible text AND
        // the accessible name.
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <Checkbox
            id={id}
            checked={Boolean(rhf.value)}
            onCheckedChange={v => rhf.onChange(v === true)}
            aria-required={field.required || undefined}
            aria-invalid={Boolean(error)}
          />
        </div>
      )}
    />
  ),
};

/** The field types that may be drawn as chips (`BookingFieldCopy.display`): one answer from a list. */
const CHIP_FIELD_TYPES: ReadonlySet<string> = new Set(['select', 'radio']);

/** The most answers a choice question may offer and still be drawn as chips: more read better as a list. */
export const CHIP_MAX_OPTIONS = 6;

/**
 * Whether a choice question is drawn as chips: only when the host asks for it
 * (`display: 'chips'`) and the link offers at most `CHIP_MAX_OPTIONS` answers.
 * Anything else keeps the question's own control from `FIELD_CONTROLS`.
 */
function drawnAsChips(field: { type: string; options?: string[] }, display: BookingFieldCopy['display']): boolean {
  if (display !== 'chips' || !CHIP_FIELD_TYPES.has(field.type)) return false;
  const count = field.options?.length ?? 0;
  return count > 0 && count <= CHIP_MAX_OPTIONS;
}

/**
 * A choice question as one-tap chips: the lib's single `ToggleGroup`, one item
 * per option. The group is named by the question's label (`FieldWrapper` gives
 * it `fieldLabelId`), a refused question paints the lib's error border on its
 * chips, and hover is a quiet background so it never reads as the chosen one.
 */
/** The chips' row: read by `chipsControl` and by `FieldSkeleton`, so a chips question loads at its own height. */
const CHIP_ROW_CLASS = 'flex flex-wrap justify-start gap-[var(--spacing-system-xsf)]';

const chipsControl = ({ field, id, registerName, error, control }: ControlArgs): ReactNode => (
  <Controller
    control={control}
    name={registerName as never}
    render={({ field: rhf }) => (
      <ToggleGroup
        id={id}
        type="single"
        variant="choice"
        value={rhf.value ?? ''}
        // A tap on the chosen chip reports '': the answer stays (clearing is not a choice the form offers).
        onValueChange={(value: string) => {
          if (value) rhf.onChange(value);
        }}
        // The form focuses a question that failed validation through its ref: the group passes that to its first chip.
        ref={(group: HTMLDivElement | null) =>
          rhf.ref(group && { focus: () => group.querySelector('button')?.focus() })
        }
        onBlur={rhf.onBlur}
        aria-labelledby={fieldLabelId(id)}
        aria-required={field.required || undefined}
        aria-invalid={Boolean(error)}
        className={CHIP_ROW_CLASS}
      >
        {(field.options ?? []).map(opt => (
          <ToggleGroupItem key={opt} value={opt} className={cn(error && 'data-[state=off]:border-ods-error')}>
            {formFieldOptionLabel(field, opt)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    )}
  />
);

/** `firstName` → `ms-first-name`; the ids the built-ins have always had. */
const builtInId = (name: string) => `ms-${name.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`;

export interface BookingFormProps {
  /** The link's availability; null while it is read (the form is then its skeleton). */
  availability: MeetingAvailability | null;
  /** The link is still being read: the form draws its own skeleton (`BookingFormSkeleton`), as in a loading scope. */
  loading?: boolean;
  meetingId: string;
  /** Absent in `deferSlot` mode — the slot is chosen AFTER these answers. */
  startTimeMs?: number;
  durationMs?: number;
  /** IANA zone the confirmation/invite should render in (parent-resolved).
   *  Null until hydration, which is why `deferSlot` relaxes it. */
  timezone: string | null;
  /**
   * Collect-only mode (`flow="details-first"`): validate against the deferred
   * schema, and hand the values up instead of POSTing. The parent re-attaches
   * the authoritative slot/duration/timezone when it submits.
   */
  deferSlot?: boolean;
  /** Repopulates the form on a remount — the back edge, or an error return. */
  initialValues?: Record<string, unknown>;
  /**
   * Answers the host took OUTSIDE the form, by question name (a landing hero's
   * one-tap question). Each is written into its question when the form mounts
   * and whenever it changes, while the question is empty or still holds the
   * host's last answer: nothing the visitor typed is overwritten, and an answer
   * the host withdraws clears what it wrote. An answer to a question the form
   * does not ask is ignored.
   */
  answers?: Readonly<Record<string, string>>;
  /** Defaults to "Confirm Booking"; details-first says "Continue". */
  submitLabel?: string;
  /** Small print beside the submit (details-first sets expectations). */
  footerNote?: string;
  /**
   * Re-arrange the fields into rows instead of the built-in order (email, the
   * name pair, then each declared question full width). Reuse, not a fork: the
   * SAME controls, validation, consent block and honeypot — only their grouping
   * changes, so a host can match a mock without owning the machine.
   *
   * A slot naming nothing is skipped; a declared question no row claims is
   * appended full width. Both are deliberate — see `slotNode`/`unplacedFields`.
   */
  fieldRows?: BookingFieldRow[];
  /**
   * The OPTIONAL questions of the link this form asks, by name. A link is often
   * shared by several pages, and a question added to it for one page must not
   * appear on the others: with this set, an optional question it does not name
   * is left out (in `fieldRows` and in the default layout alike). A REQUIRED
   * question is always asked, named or not: a required field with no control
   * is a submit that cannot succeed. Omitted: every declared question is asked.
   */
  optionalFields?: readonly string[];
  /** The form element's id, so a host can submit it from a button outside it
   *  (`<button form={id}>`): the modal layout keeps its actions in a footer
   *  under the card. */
  formId?: string;
  /** Leave the submit button out: the host draws one of its own (see `formId`). */
  hideSubmit?: boolean;
  /** Whether the answers would pass validation as they stand, reported on every
   *  change: a host drawing its own submit keeps it disabled until this says
   *  true. The form's own button never needs it - its click validates. */
  onValidityChange?: (valid: boolean) => void;
  /** Per-field display overrides, keyed by field name — see `BookingFieldCopy`. */
  fieldCopy?: Record<string, BookingFieldCopy>;
  /** Email domains this form refuses, with the message it shows — see `DeniedEmailDomains`.
   *  MEMOIZE it: a new object every render rebuilds the resolver's schema. */
  deniedEmailDomains?: DeniedEmailDomains;
  /** Host-supplied consent row, rendered after the fields — see `BookingFormConsent`. */
  consent?: BookingFormConsent;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  /** From useHumanitySignals — parent owns the instance so it can resetSignals(). */
  honeypotInputProps: { ref: Ref<HTMLInputElement>; name: string };
  getSignals: () => Record<string, string | number>;
  /** Form rescue for this form (`RESCUE_FORMS.meetingBooking`); `null` or omitted saves nothing.
   *  The attempt's keys ride the payload handed to `onSubmit`, so the parent closes it after
   *  the booking commits (`completeFormRescue`), in details-first too, where this form has
   *  unmounted by then. */
  rescue?: FormRescueDefinition | null;
}

/**
 * BookingForm — attendee details + the link's declared custom questions +
 * verbatim legal-consent copy. ContactForm's scaffolding (react-hook-form +
 * zodResolver + lib field primitives); a sibling rather than a `<ContactForm>`
 * configuration because of the dynamic HubSpot `formFields`, the per-checkbox
 * consent model, and the first/last-name field model — none expressible via
 * `hideFields`/`extraTopField`.
 *
 * Bot protection is LOAD-BEARING: without the humanity signals in the body,
 * the host's `verifyHuman` degrades to first-party-only BotID (fails open for
 * external embedders). Honeypot + elapsed-ms are merged into the POST at
 * submit; the parent calls `resetSignals()` after a SLOT_TAKEN refetch so a
 * legitimate retry isn't flagged too-fast.
 *
 * While the link is read (`loading`, a loading scope, or no availability yet) the form is its own skeleton.
 */
export function BookingForm(props: BookingFormProps) {
  const inScope = useLoadingScope();
  const { availability } = props;
  if (inScope || props.loading || !availability) {
    return (
      <BookingFormSkeleton
        fieldRows={props.fieldRows}
        optionalFields={props.optionalFields}
        fieldCopy={props.fieldCopy}
        consent={props.consent}
        footerNote={props.footerNote}
        submitLabel={props.submitLabel}
      />
    );
  }
  return <BookingFormBody {...props} availability={availability} />;
}

function BookingFormBody({
  availability,
  meetingId,
  startTimeMs,
  durationMs,
  timezone,
  deferSlot = false,
  initialValues,
  answers,
  submitLabel,
  footerNote,
  fieldRows,
  optionalFields,
  formId,
  hideSubmit = false,
  onValidityChange,
  fieldCopy,
  deniedEmailDomains,
  consent,
  isSubmitting,
  onSubmit,
  honeypotInputProps,
  getSignals,
  rescue = null,
}: BookingFormProps & { availability: MeetingAvailability }) {
  const { formFields, legalConsent } = availability;
  // Every declared question resolved to a control (`resolveFormFieldControl`) —
  // an unfamiliar HubSpot type is drawn as its nearest control, never dropped
  // silently and never a reason to hide the form.
  // `optionalFields` narrows the optional ones to the questions this form asks.
  const supportedFields = useMemo(
    () => normalizeFormFields(formFields).filter(field => bookingFormAsks(field, optionalFields)),
    [formFields, optionalFields],
  );
  // The DEFERRED schema in both flows: it is the wider of the two, and a strict
  // resolver is not assignable to `Resolver<BookingFormValues>`. The strict
  // schema is the server's contract — see `makeBookingSchema`'s docblock.
  const schema = useMemo(
    () => withDeniedEmailDomains(makeDeferredBookingSchema(supportedFields, legalConsent), deniedEmailDomains),
    [supportedFields, legalConsent, deniedEmailDomains],
  );

  const consentDefaults = useMemo(
    () =>
      (legalConsent?.communicationConsentCheckboxes ?? []).map(c => ({
        communicationTypeId: c.communicationTypeId,
        consented: false,
      })),
    [legalConsent],
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      meetingId,
      // Genuinely OMITTED, not present-as-undefined, when the slot is deferred.
      ...(deferSlot ? {} : { startTimeMs, durationMs }),
      timezone,
      locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
      firstName: '',
      lastName: '',
      email: '',
      formFields: {},
      legalConsentResponses: consentDefaults,
      // A remount (back edge, or an error return) would otherwise lose every
      // answer — `defaultValues` is snapshotted once and never re-read.
      ...(initialValues ?? {}),
    } as BookingFormValues,
  });

  const priorConsents = initialValues?.legalConsentResponses as typeof consentDefaults | undefined;

  // The host consent lives OUTSIDE react-hook-form (it is not a wire field), so
  // a remount restores it from the stash the same way the fields come back.
  const [consented, setConsented] = useState(initialValues?.[HOST_CONSENT_KEY] === true);
  const [consentError, setConsentError] = useState<string | null>(null);
  const consentMissing = Boolean(consent) && !consented;

  // Live validity for a host-drawn submit. `watch()` re-renders on every
  // change; the parse is the same schema the submit runs, so the two can never
  // disagree. Reported only when asked for, and only when it changes.
  const watchedValues = watch();
  const liveValid = onValidityChange ? schema.safeParse(watchedValues).success && !consentMissing : false;
  const lastValidRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!onValidityChange) return;
    if (lastValidRef.current === liveValid) return;
    lastValidRef.current = liveValid;
    onValidityChange(liveValid);
  });

  // The seeded availability is refetched immediately on mount, so the link's
  // consent set can change WHILE this form is open. Reconcile rather than
  // remount: carry each `consented` across by id and default new ids to false.
  // A wholesale reset would drop what the visitor has typed; leaving it alone
  // would make a newly-declared required consent impossible to satisfy.
  useEffect(() => {
    // The LIVE answers first (what the visitor has ticked since mount), the
    // stash only as the seed for a fresh remount — reading the stash alone
    // would undo every tick made after mount when the consent set refreshes.
    const current = (getValues('legalConsentResponses') ?? priorConsents ?? []) as typeof consentDefaults;
    setValue(
      'legalConsentResponses',
      consentDefaults.map(next => ({
        ...next,
        consented: current.find(r => r.communicationTypeId === next.communicationTypeId)?.consented ?? false,
      })),
      { shouldDirty: false },
    );
  }, [consentDefaults, priorConsents, getValues, setValue]);

  // The host's outside answers, written without a remount, on mount too (an answer given before the form
  // mounted, or while a later step had it unmounted, still arrives). A question is the host's to write while it
  // is empty or still holds what this effect last wrote there; once it holds anything else (typed, or restored
  // from the visitor's own stash) it is the visitor's. An answer the host withdraws clears what it wrote.
  const written = useRef<Record<string, string>>({});
  useEffect(() => {
    const names = new Set([...Object.keys(answers ?? {}), ...Object.keys(written.current)]);
    for (const name of names) {
      // Only a question this form asks: an answer to one the link does not declare (or the form leaves out) goes nowhere.
      if (!supportedFields.some(field => field.name === name)) continue;
      const next = answers?.[name] ?? '';
      const current = getValues('formFields')?.[name] ?? '';
      if (current !== '' && current !== written.current[name]) continue;
      if (next) written.current[name] = next;
      else delete written.current[name];
      if (current === next) continue;
      setValue(`formFields.${name}` as never, next as never, { shouldValidate: next !== '' });
    }
  }, [answers, supportedFields, getValues, setValue]);

  // Form rescue: the built-ins by name, the declared questions under `formFields.<name>`.
  const rescueFields = useMemo(
    () => [...BUILT_IN_BOOKING_FIELDS.map(field => field.name), ...supportedFields.map(field => field.name)],
    [supportedFields],
  );
  const formRescue = useRescuedForm(
    { watch, getValues, setValue },
    {
      rescue,
      fields: rescueFields,
      getSignals,
      fieldPath: name =>
        (BUILT_IN_BOOKING_FIELDS.some(field => field.name === name)
          ? name
          : `formFields.${name}`) as Path<BookingFormValues>,
    },
  );

  const { toast } = useToast();

  /**
   * A refused submit already reports itself under each field, and the button
   * stays live — pressing it is how a visitor asks what is wrong.
   *
   * The denied-domain rule is the one they cannot see coming: the address is
   * well formed and the control looks answered, so the inline line under a
   * filled-in field is easy to miss. That one is ALSO said at the button.
   * Nothing else toasts — a toast per empty field would bury the messages the
   * fields already carry.
   */
  const onInvalid = () => {
    if (deniedEmailDomains && emailDomainDenied(getValues('email'), deniedEmailDomains)) {
      toast({
        variant: 'error',
        title: 'Check your email address',
        description: deniedEmailDomains.message,
      });
    }
  };

  const submitValid = handleSubmit(async data => {
    if (consentMissing) return; // the error is already on screen — see `submit`
    if (deferSlot) {
      // Collect-only. The PARENT's `onSubmit` reads the humanity signals, and
      // must do so synchronously in this call — this form and its honeypot are
      // still mounted here, and `getSignals()` reads a detached ref once they
      // unmount, which would silently disable the decoy.
      await onSubmit({ ...data, meetingId, [HOST_CONSENT_KEY]: consented, ...formRescue.submitFields() });
      return;
    }
    await onSubmit({
      ...data,
      meetingId,
      [HOST_CONSENT_KEY]: consented,
      startTimeMs,
      durationMs,
      timezone,
      ...getSignals(),
      ...formRescue.submitFields(),
    });
  }, onInvalid);

  // Consent is checked BEFORE the resolver runs, not inside the valid branch,
  // so an unticked box and an empty field are reported together rather than
  // one submit apart.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (consentMissing) setConsentError(consent?.errorMessage ?? 'Please agree to continue.');
    return submitValid(event);
  };

  const fieldError = (name: string): string | undefined => {
    const err = (errors.formFields as Record<string, { message?: string }> | undefined)?.[name];
    return err?.message;
  };

  /** ONE render path for every field — built-in or declared — so the default
   *  order below and any host-supplied `fieldRows` compose the same controls. */
  const renderField = (
    field: ControlArgs['field'],
    where: { id: string; registerName: string; error?: string },
  ): ReactNode => {
    // DISPLAY only: the host's copy replaces what this control draws, never the
    // name the answer registers under, the validation, or the schema's messages.
    const copy = fieldCopy?.[field.name];
    const shown = copy
      ? { ...field, label: copy.label ?? field.label, placeholder: copy.placeholder ?? field.placeholder }
      : field;
    return (
      <FieldWrapper
        key={shown.name}
        label={shown.label}
        htmlFor={where.id}
        required={shown.required}
        error={where.error}
      >
        {(drawnAsChips(shown, copy?.display) ? chipsControl : FIELD_CONTROLS[shown.type])({
          field: shown,
          id: where.id,
          registerName: where.registerName,
          error: where.error,
          register,
          control,
        })}
      </FieldWrapper>
    );
  };

  const builtInFields: Record<string, ReactNode> = Object.fromEntries(
    BUILT_IN_BOOKING_FIELDS.map(field => [
      field.name,
      renderField(field, { id: builtInId(field.name), registerName: field.name, error: errors[field.name]?.message }),
    ]),
  );

  const renderDeclaredField = (field: SupportedMeetingFormField): ReactNode =>
    renderField(field, {
      id: `ms-q-${field.name}`,
      registerName: `formFields.${field.name}`,
      error: fieldError(field.name),
    });

  const declaredByName = new Map(supportedFields.map(f => [f.name, f]));

  const slotResolves = (name: string): boolean => Boolean(builtInFields[name] || declaredByName.has(name));

  const slotNode = (name: string): ReactNode => {
    const builtIn = builtInFields[name];
    if (builtIn) return builtIn;
    const declared = declaredByName.get(name);
    // A name matching nothing is SKIPPED, not an error: a row may reference a
    // question the link has not declared yet (declaring it in HubSpot is what
    // turns it on), and throwing would take the whole form down over config.
    return declared ? renderDeclaredField(declared) : null;
  };

  /** Fields no row claims — appended full width, so neither a question added in
   *  HubSpot nor a built-in the layout forgot can go invisible: the schema still
   *  requires the identity trio, and a required field with no control is a
   *  submit that dies silently. */
  const { rows: placedRows, unplacedBuiltIns, named: placedNames } = normalizeFieldRows(fieldRows ?? [], slotResolves);
  const unplacedFields = fieldRows ? supportedFields.filter(f => !placedNames.has(f.name)) : [];

  const submitButton = (
    <Button
      type="submit"
      loading={isSubmitting}
      disabled={isSubmitting}
      // The details-first footer draws a 240px action beside its note
      // (`4904:117335`); the bare slot-first row keeps the button at its natural
      // width, as it always has.
      className={footerNote ? SUBMIT_WIDE_CLASS : undefined}
    >
      {submitLabel ?? DEFAULT_SUBMIT_LABEL}
    </Button>
  );

  // Opted out of HubSpot's collected-forms script — see HUBSPOT_DO_NOT_COLLECT_FORM_PROPS.
  return (
    <form id={formId} onSubmit={submit} className={FORM_STACK} noValidate {...HUBSPOT_DO_NOT_COLLECT_FORM_PROPS}>
      <HoneypotField {...honeypotInputProps} />

      {/* Email first, name pair below — the order the desktop and mobile mocks
          both draw. The pair stays TWO columns even on a phone (164px each at
          375): two short fields side by side cost one line instead of two on
          the layout that can least afford them.

          Every field goes through `FieldWrapper`, which hangs its message OUT
          OF FLOW below the control. That is the whole reason it is here: a
          message rendered in flow grows its field, which pushes everything
          under it down and — inside a card that states its height — walks the
          submit button off the bottom the moment validation fails. Required-ness
          is carried by `required` on the control (read out by assistive tech)
          AND by `FieldWrapper`'s accent asterisk — the mark HubSpot's own form
          and `ContactForm` both draw, so a visitor sees the same convention on
          every form in the app. */}
      {fieldRows ? (
        <>
          {placedRows.map(row => (
            <div key={row.map(s => s.name).join('|')} className={ROW_GRID}>
              {row.map((slot, slotIndex) => (
                <div key={slot.name} className={slotColumnClass(row, slot, slotIndex)}>
                  {slotNode(slot.name)}
                </div>
              ))}
            </div>
          ))}
          {[...unplacedBuiltIns, ...unplacedFields].map(field => (
            <Fragment key={field.name}>{slotNode(field.name)}</Fragment>
          ))}
        </>
      ) : (
        <>
          {builtInFields.email}
          <div className="grid grid-cols-2 gap-[var(--spacing-system-m)]">
            {builtInFields.firstName}
            {builtInFields.lastName}
          </div>
          {supportedFields.map(field => (
            <Fragment key={field.name}>{renderDeclaredField(field)}</Fragment>
          ))}
        </>
      )}

      {consent && (
        <CheckboxBlock
          id="ms-host-consent"
          checked={consented}
          onCheckedChange={v => {
            setConsented(v);
            if (v) setConsentError(null);
          }}
          disabled={isSubmitting}
          required
          error={consentError ?? undefined}
          label={consent.label}
          description={consent.description}
        />
      )}

      {legalConsent && (
        // Same out-of-flow message as the fields above, so a missed consent
        // box doesn't shove the submit button down the card. With no error the
        // wrapper is `display:contents` and the panel below is the flex item,
        // exactly as it was.
        <FieldWrapper error={errors.legalConsentResponses?.message}>
          <div className="flex flex-col gap-[var(--spacing-system-xs)]">
            {/* GDPR surface — HubSpot's copy rendered VERBATIM, never edited, in
                HubSpot's own order: processing statement, communication intro,
                the boxes, privacy note. The statement is a standalone line so a
                link with consent enabled but NO communication boxes still shows
                it. */}
            <p className="text-ods-text-secondary text-h6">{legalConsent.processingConsentText}</p>
            {legalConsent.communicationConsentText && (
              <p className="text-ods-text-secondary text-h6">{legalConsent.communicationConsentText}</p>
            )}
            <Controller
              control={control}
              name="legalConsentResponses"
              render={({ field: rhf }) => (
                <>
                  {legalConsent.communicationConsentCheckboxes.map(box => {
                    const responses = (rhf.value ?? []) as Array<{ communicationTypeId: string; consented: boolean }>;
                    const current = responses.find(r => r.communicationTypeId === box.communicationTypeId);
                    return (
                      // The design system's consent row (`checkbox-block`, the
                      // same block the waitlist form uses): box + label in one
                      // bordered row.
                      <CheckboxBlock
                        key={box.communicationTypeId}
                        id={`ms-consent-${box.communicationTypeId}`}
                        checked={current?.consented ?? false}
                        onCheckedChange={v =>
                          rhf.onChange(
                            responses.map(r =>
                              r.communicationTypeId === box.communicationTypeId ? { ...r, consented: v } : r,
                            ),
                          )
                        }
                        required={box.required}
                        label={box.label}
                      />
                    );
                  })}
                </>
              )}
            />
            {legalConsent.privacyPolicyText && (
              <p className="text-ods-text-secondary text-h6">{legalConsent.privacyPolicyText}</p>
            )}
          </div>
        </FieldWrapper>
      )}

      {/* Step navigation back to the calendar lives in the step header (the
          app-standard BackButton, rendered by the parent) — the form ships
          only its submit. */}
      {/* Two shapes, not one with a placeholder: without a note this must stay
          the bare `flex` row it has always been, or the submit slides from the
          left edge to the right on every existing slot-first booking. */}
      {hideSubmit ? null : footerNote ? (
        <div className={FOOTER_ROW_CLASS}>
          <p className="text-ods-text-secondary text-h6">{footerNote}</p>
          {submitButton}
        </div>
      ) : (
        <div className={FOOTER_BARE_CLASS}>{submitButton}</div>
      )}
    </form>
  );
}

/**
 * Cold-start placeholder for `flow="details-first"`, where the FORM is the
 * first thing in the action panel.
 *
 * The slot-first skeleton (`SlotPickerSkeleton`) would put a grey calendar
 * where the form belongs — above the fold on a page whose entire content is
 * this card. Same footprint discipline as its sibling: fixed heights, and no
 * shift when the real form swaps in for single-line fields. Two footprints it
 * cannot know: a textarea row is taller than its placeholder (the rows carry no
 * type), and a HubSpot `legalConsent` block only exists once availability lands.
 */
export function BookingFormSkeleton({
  fieldRows,
  optionalFields,
  fieldCopy,
  consent,
  footerNote,
  submitLabel = DEFAULT_SUBMIT_LABEL,
}: {
  fieldRows?: BookingFieldRow[];
  /** The optional questions the form asks (`BookingForm`'s `optionalFields`): a row slot naming another optional
   *  question is left out, as the loaded form leaves it out. */
  optionalFields?: readonly string[];
  /** The host's per-field copy (`BookingForm`'s `fieldCopy`): a built-in field's label is drawn with it. */
  fieldCopy?: Record<string, BookingFieldCopy>;
  /** The host's consent row (`BookingForm`'s `consent`), drawn for real: it is the host's own words. `true` (no
   *  copy known) draws the row with its label as a bar. A HubSpot `legalConsent` block is unknown until
   *  availability lands, the one footprint this skeleton cannot budget for. */
  consent?: BookingFormConsent | boolean;
  /** The footer's note (the host's words), drawn for real. */
  footerNote?: string;
  /** The submit button's label (`BookingForm`'s `submitLabel`): the button is drawn for real at its own size. */
  submitLabel?: string;
}) {
  const consentId = useId();
  // The real submit button (static copy), inert with the rest of the form.
  const submitButton = (
    <Button type="button" tabIndex={-1} className={footerNote ? SUBMIT_WIDE_CLASS : undefined}>
      {submitLabel}
    </Button>
  );
  return (
    // Inert: the fields are the form's own controls, drawn so each is its loaded size; none takes focus.
    <div className={cn('flex-1', FORM_STACK)} aria-hidden inert>
      {/* The host's rows (or the built-in layout) through the SAME grid, column
          rule and normalisation as the loaded form — see `normalizeFieldRows`. */}
      {skeletonRows(fieldRows ?? DEFAULT_FIELD_ROWS, optionalFields).map(row => (
        <div key={row.map(s => s.name).join('|')} className={ROW_GRID}>
          {row.map((slot, slotIndex) => (
            <FieldSkeleton
              key={slot.name}
              name={slot.name}
              fieldCopy={fieldCopy}
              className={slotColumnClass(row, slot, slotIndex)}
            />
          ))}
        </div>
      ))}
      {/* Without rows there is no telling how many questions the link declares: one long answer stands for them. */}
      {!fieldRows && (
        // An empty label keeps the field's own frame (`FieldWrapper` draws no label for it); the bar stands for it.
        <FieldWrapper label="">
          <TextLineSkeleton type="h6" className="mb-1 w-40" />
          <Textarea tabIndex={-1} />
        </FieldWrapper>
      )}
      {consent && (
        <CheckboxBlock
          id={consentId}
          checked={false}
          onCheckedChange={() => {}}
          required
          label={
            consent === true ? <TextLineSkeleton type="inherit" as="span" className="w-64 max-w-full" /> : consent.label
          }
          description={consent === true ? undefined : consent.description}
        />
      )}
      {footerNote ? (
        <div className={FOOTER_ROW_CLASS}>
          <p className="text-ods-text-secondary text-h6">{footerNote}</p>
          {submitButton}
        </div>
      ) : (
        <div className={FOOTER_BARE_CLASS}>{submitButton}</div>
      )}
    </div>
  );
}

/**
 * The ONE normalisation of host rows, read by the form and its skeleton.
 *  - A slot whose name `resolves` to nothing is dropped, and a row left empty is
 *    dropped with it: an empty grid still eats one form gap, so a layout written
 *    ahead of the HubSpot config would print blank bands.
 *  - A name placed twice renders once (its first slot) — one control per field.
 *  - Explicit spans were written for the FULL row; once a slot drops out they
 *    would leave a trailing gap, so a shortened row falls back to the even split.
 *  - Built-ins no row names come back as `unplacedBuiltIns`: the schema still
 *    requires the identity trio, and a required field with no control is a
 *    submit that dies silently.
 * The skeleton has no availability yet, so it passes no `resolves` and keeps
 * every declared-looking name; that is the one swap it cannot rule out.
 */
function normalizeFieldRows(fieldRows: BookingFieldRow[], resolves: (name: string) => boolean = () => true) {
  const seen = new Set<string>();
  const rows: BookingFieldRow[] = [];
  for (const row of fieldRows) {
    const kept: BookingFieldSlot[] = [];
    for (const slot of row) {
      if (!resolves(slot.name) || seen.has(slot.name)) continue;
      seen.add(slot.name);
      kept.push(slot);
    }
    if (kept.length === 0) continue;
    rows.push(kept.length === row.length ? kept : kept.map((slot): BookingFieldSlot => ({ name: slot.name })));
  }
  const named = new Set(fieldRows.flat().map(slot => slot.name));
  const unplacedBuiltIns = BUILT_IN_BOOKING_FIELDS.filter(f => !named.has(f.name));
  return { rows, unplacedBuiltIns, named };
}

/** The skeleton's rows: the normalised host rows, then the built-ins none of them named. With `optionalFields`, a
 *  slot that is neither a built-in nor one of the named questions is left out, as `bookingFormAsks` leaves it out. */
function skeletonRows(fieldRows: BookingFieldRow[], optionalFields?: readonly string[]): BookingFieldRow[] {
  const asks = (name: string) =>
    !optionalFields || BUILT_IN_BOOKING_FIELDS.some(f => f.name === name) || optionalFields.includes(name);
  const { rows, unplacedBuiltIns } = normalizeFieldRows(fieldRows, asks);
  return [...rows, ...unplacedBuiltIns.map(f => [{ name: f.name }])];
}

/**
 * One field while the link is read: the loaded field's own `FieldWrapper` over the loaded control. A built-in field's
 * label is its own words (or the host's copy); a declared question's label is the host's copy when it gives one
 * (static, drawn for real), else a bar of the label's line, since the link supplies it. A question the host draws
 * as chips (`display: 'chips'`) is one row of chips at the chips' own height; any other is an `Input`.
 */
function FieldSkeleton({
  name,
  fieldCopy,
  className,
}: {
  name: string;
  fieldCopy?: Record<string, BookingFieldCopy>;
  className?: string;
}) {
  const builtIn = BUILT_IN_BOOKING_FIELDS.find(f => f.name === name);
  const copy = fieldCopy?.[name];
  const label = builtIn ? (copy?.label ?? builtIn.label) : copy?.label;
  return (
    // An empty label keeps the field's own frame; a read label is the bar under it.
    <FieldWrapper label={label ?? ''} required={builtIn?.required} className={className}>
      {label === undefined && <TextLineSkeleton type="h6" className="mb-1 w-32" />}
      {!builtIn && copy?.display === 'chips' ? (
        <div className={CHIP_ROW_CLASS}>
          <UnifiedSkeleton variant="default" className={cn(TOGGLE_SIZE_CLASS.default, 'w-24 rounded-md')} />
        </div>
      ) : (
        <Input tabIndex={-1} />
      )}
    </FieldWrapper>
  );
}
