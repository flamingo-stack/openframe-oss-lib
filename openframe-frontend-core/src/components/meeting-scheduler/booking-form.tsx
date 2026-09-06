'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode, Ref } from 'react';
import { useForm, Controller } from 'react-hook-form';
import type { Control, UseFormRegister } from 'react-hook-form';
import {
  BUILT_IN_BOOKING_FIELDS,
  type BuiltInBookingFieldName,
  DECIMAL_LITERAL_RE,
  fieldTypeSpec,
  makeDeferredBookingSchema,
  isSupportedFormField,
  type BuiltInBookingField,
  type MeetingAvailability,
  type SupportedFormFieldType,
  type MeetingFormField,
  type SupportedMeetingFormField,
  type BookingFormValues,
} from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import {
  Button,
  FieldWrapper,
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
  Skeleton,
} from '../ui';
import { HoneypotField } from '../ui/honeypot-field';

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
const ROW_GRID = 'grid grid-cols-2 gap-x-[var(--spacing-system-m)] gap-y-[var(--spacing-system-lf)] md:grid-cols-4';

/** The wire key of the host consent tick (stripped server-side, never sent to HubSpot). */
const HOST_CONSENT_KEY = 'hostConsent';

/** The row grid's column count at `md` and up. `ROW_GRID`'s `md:grid-cols-4`
 *  and `SPAN_CLASS` are its Tailwind twins (literal so the scanner sees them). */
const GRID_COLUMNS = 4;

/** Static so Tailwind's scanner sees every class — a template built from a
 *  runtime span would compile to nothing. */
const SPAN_CLASS = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
} as const;

/** One field's skeleton: label + control footprint — the CSS twin of `FieldWrapper`'s
 *  label row over `Input`'s `h-11 md:h-12` (the other skeleton heights below are
 *  the same kind of twin: the textarea, the consent row, the `Button`). */
const FIELD_SKELETON_CLASS = 'h-[4.75rem] w-full';

/** The submit copy every standalone `BookingForm` gets; the slot-first preset reads the same constant. */
export const DEFAULT_SUBMIT_LABEL = 'Confirm Booking';

/** The footer with a note (details-first): note beside the button, wrapping on a phone. */
const FOOTER_ROW_CLASS = 'flex flex-wrap items-center justify-between gap-[var(--spacing-system-m)]';
/** The bare footer: the button stays LEFT, where the form's reading order ends. */
const FOOTER_BARE_CLASS = 'flex';
/** The submit's width when a note sits beside it. */
const SUBMIT_WIDE_CLASS = 'md:w-60';

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
 * the only signal.
 */
const FIELD_CONTROLS: Record<SupportedFormFieldType, (args: ControlArgs) => ReactNode> = {
  text: ({ field, id, registerName, error, register }) => (
    <Input
      id={id}
      type={field.inputType ?? 'text'}
      required={field.required}
      aria-invalid={Boolean(error)}
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
      {...register(registerName as never, { setValueAs: canonicalNumber })}
    />
  ),
  select: ({ field, id, registerName, error, control }) => (
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => (
        <Select value={rhf.value ?? ''} onValueChange={rhf.onChange}>
          <SelectTrigger id={id} aria-required={field.required || undefined} aria-invalid={Boolean(error)}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map(opt => (
              <SelectItem key={opt} value={opt}>
                {opt}
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
              <Label htmlFor={`${id}-${opt}`}>{opt}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
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

/** `firstName` → `ms-first-name`; the ids the built-ins have always had. */
const builtInId = (name: string) => `ms-${name.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`;

export interface BookingFormProps {
  availability: MeetingAvailability;
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
  /** Host-supplied consent row, rendered after the fields — see `BookingFormConsent`. */
  consent?: BookingFormConsent;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  /** From useHumanitySignals — parent owns the instance so it can resetSignals(). */
  honeypotInputProps: { ref: Ref<HTMLInputElement>; name: string };
  getSignals: () => Record<string, string | number>;
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
 */
export function BookingForm({
  availability,
  meetingId,
  startTimeMs,
  durationMs,
  timezone,
  deferSlot = false,
  initialValues,
  submitLabel,
  footerNote,
  fieldRows,
  consent,
  isSubmitting,
  onSubmit,
  honeypotInputProps,
  getSignals,
}: BookingFormProps) {
  const { formFields, legalConsent } = availability;
  const supportedFields = useMemo(() => formFields.filter(isSupportedFormField), [formFields]);
  // The DEFERRED schema in both flows: it is the wider of the two, and a strict
  // resolver is not assignable to `Resolver<BookingFormValues>`. The strict
  // schema is the server's contract — see `makeBookingSchema`'s docblock.
  const schema = useMemo(
    () => makeDeferredBookingSchema(supportedFields, legalConsent),
    [supportedFields, legalConsent],
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

  const submitValid = handleSubmit(async data => {
    if (consentMissing) return; // the error is already on screen — see `submit`
    if (deferSlot) {
      // Collect-only. The PARENT's `onSubmit` reads the humanity signals, and
      // must do so synchronously in this call — this form and its honeypot are
      // still mounted here, and `getSignals()` reads a detached ref once they
      // unmount, which would silently disable the decoy.
      await onSubmit({ ...data, meetingId, [HOST_CONSENT_KEY]: consented });
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
    });
  });

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
  ): ReactNode => (
    <FieldWrapper key={field.name} label={field.label} htmlFor={where.id} required={field.required} error={where.error}>
      {FIELD_CONTROLS[field.type]({
        field,
        id: where.id,
        registerName: where.registerName,
        error: where.error,
        register,
        control,
      })}
    </FieldWrapper>
  );

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

  // `data-hs-do-not-collect` is LOAD-BEARING. Hosts that run the HubSpot
  // tracking tag (the OpenFrame dashboard does, via GTM) also get HubSpot's
  // collected-forms script, which binds to EVERY <form> on the page and
  // re-posts its fields to HubSpot as a "non-HubSpot form" submission — in
  // parallel with the real booking that already reaches HubSpot through the
  // host proxy. That double-counted the contact's conversions and, with no
  // id/name on this element, named the phantom form after its class list
  // ("Dashboard | OpenFrame: .flex, .flex-col, …"). The attribute is the
  // script's own opt-out, checked at bind time, so the form is never observed.
  return (
    <form onSubmit={submit} className={FORM_STACK} noValidate data-hs-do-not-collect="true">
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
      {footerNote ? (
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
  consent,
  footerNote,
}: {
  fieldRows?: BookingFieldRow[];
  /** Whether the host adds its consent row (drawn only then). A HubSpot
   *  `legalConsent` block is unknown until availability lands — the one
   *  footprint this skeleton cannot budget for. */
  consent?: boolean;
  footerNote?: string;
}) {
  return (
    <div className={cn('flex-1', FORM_STACK)}>
      {/* The host's rows (or the built-in layout) through the SAME grid, column
          rule and normalisation as the loaded form — see `normalizeFieldRows`. */}
      {skeletonRows(fieldRows ?? DEFAULT_FIELD_ROWS).map(row => (
        <div key={row.map(s => s.name).join('|')} className={ROW_GRID}>
          {row.map((slot, slotIndex) => (
            <Skeleton key={slot.name} className={cn(FIELD_SKELETON_CLASS, slotColumnClass(row, slot, slotIndex))} />
          ))}
        </div>
      ))}
      {/* Without rows there is no telling how many questions the link declares: one long answer stands for them. */}
      {!fieldRows && <Skeleton className="h-[7.75rem] w-full" />}
      {consent && <Skeleton className="h-[4.25rem] w-full" />}
      {footerNote ? (
        <div className={FOOTER_ROW_CLASS}>
          <Skeleton className="h-5 min-w-40 flex-1" />
          <Skeleton className={cn('h-12 w-full', SUBMIT_WIDE_CLASS)} />
        </div>
      ) : (
        <div className={FOOTER_BARE_CLASS}>
          <Skeleton className="h-12 w-40" />
        </div>
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

/** The skeleton's rows: the normalised host rows, then the built-ins none of them named. */
function skeletonRows(fieldRows: BookingFieldRow[]): BookingFieldRow[] {
  const { rows, unplacedBuiltIns } = normalizeFieldRows(fieldRows);
  return [...rows, ...unplacedBuiltIns.map(f => [{ name: f.name }])];
}
