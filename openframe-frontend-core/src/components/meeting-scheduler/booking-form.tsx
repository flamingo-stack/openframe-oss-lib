'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode, Ref } from 'react';
import { useForm, Controller } from 'react-hook-form';
import type { Control, UseFormRegister } from 'react-hook-form';
import {
  BUILT_IN_BOOKING_FIELDS,
  makeDeferredBookingSchema,
  isSupportedFormField,
  type BuiltInBookingField,
  type MeetingAvailability,
  type SupportedFormFieldType,
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
  name: string;
  /** Columns out of four at `md` and up. Defaults to an even split of the row. */
  span?: 1 | 2 | 3 | 4;
}

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

/** Static so Tailwind's scanner sees every class — a template built from a
 *  runtime span would compile to nothing. */
const SPAN_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
};

const evenSpan = (count: number): 1 | 2 | 3 | 4 =>
  Math.min(4, Math.max(1, Math.floor(4 / Math.max(1, count)))) as 1 | 2 | 3 | 4;

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

/** What one control needs: the field, its DOM id, where it registers in the
 *  form, and the form's own register/control. */
interface ControlArgs {
  field: SupportedMeetingFormField & Partial<Pick<BuiltInBookingField, 'inputType' | 'autoComplete' | 'placeholder'>>;
  id: string;
  /** Top-level for the built-ins (`email`), `formFields.<name>` for declared questions. */
  registerName: string;
  register: UseFormRegister<BookingFormValues>;
  control: Control<BookingFormValues>;
}

// Field chrome mirrors ContactForm 1:1 (`contact/contact-form.tsx`) — the
// booking form must be indistinguishable from every other form in the app.
const INPUT_CLASS =
  'bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-11 md:h-12';
const TEXTAREA_CLASS = 'border-ods-border bg-ods-card px-3 text-ods-text-primary placeholder-ods-text-secondary';

/** Placeholder derived from the field itself (the mock's "Enter Company Name",
 *  "Enter Text (optional)"), so declared questions get one without any copy
 *  living here; the built-ins carry their own. */
const placeholderFor = (field: ControlArgs['field']): string | undefined =>
  field.placeholder ??
  (field.type === 'text'
    ? `Enter ${field.label}`
    : field.type === 'textarea'
      ? `Enter text${field.required ? '' : ' (optional)'}`
      : undefined);

/**
 * ONE control per registry type. A `Record` over `SupportedFormFieldType` on
 * purpose: `FORM_FIELD_TYPES` (the schema module) is the single place a type is
 * declared, and this table cannot compile without an entry for each — so the
 * validator and the renderer can never disagree about what is supported.
 */
const FIELD_CONTROLS: Record<SupportedFormFieldType, (args: ControlArgs) => ReactNode> = {
  text: ({ field, id, registerName, register }) => (
    <Input
      id={id}
      type={field.inputType ?? 'text'}
      required={field.required}
      autoComplete={field.autoComplete}
      placeholder={placeholderFor(field)}
      className={INPUT_CLASS}
      {...register(registerName as never)}
    />
  ),
  textarea: ({ field, id, registerName, register }) => (
    <Textarea
      id={id}
      placeholder={placeholderFor(field)}
      className={TEXTAREA_CLASS}
      {...register(registerName as never)}
    />
  ),
  number: ({ field, id, registerName, register }) => (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      step="any"
      required={field.required}
      className={INPUT_CLASS}
      {...register(registerName as never)}
    />
  ),
  select: ({ field, id, registerName, control }) => (
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => (
        <Select value={rhf.value ?? ''} onValueChange={rhf.onChange}>
          <SelectTrigger id={id}>
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
  radio: ({ field, id, registerName, control }) => (
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => (
        <RadioGroup value={rhf.value ?? ''} onValueChange={rhf.onChange}>
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
  checkbox: ({ id, registerName, control }) => (
    <Controller
      control={control}
      name={registerName as never}
      render={({ field: rhf }) => (
        // The question's Label above already carries the text and binds to
        // this id — a second inline label would double the visible text AND
        // the accessible name.
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <Checkbox id={id} checked={Boolean(rhf.value)} onCheckedChange={v => rhf.onChange(v === true)} />
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
  const [consented, setConsented] = useState(initialValues?.hostConsent === true);
  const [consentError, setConsentError] = useState<string | null>(null);
  const consentMissing = Boolean(consent) && !consented;

  // The seeded availability is refetched immediately on mount, so the link's
  // consent set can change WHILE this form is open. Reconcile rather than
  // remount: carry each `consented` across by id and default new ids to false.
  // A wholesale reset would drop what the visitor has typed; leaving it alone
  // would make a newly-declared required consent impossible to satisfy.
  useEffect(() => {
    setValue(
      'legalConsentResponses',
      consentDefaults.map(next => ({
        ...next,
        consented: priorConsents?.find(r => r.communicationTypeId === next.communicationTypeId)?.consented ?? false,
      })),
      { shouldDirty: false },
    );
  }, [consentDefaults, priorConsents, setValue]);

  const submitValid = handleSubmit(async data => {
    if (consentMissing) return; // the error is already on screen — see `submit`
    if (deferSlot) {
      // Collect-only. Signals are captured HERE, while this form and its
      // honeypot are still mounted — `getSignals()` reads a detached ref once
      // they unmount, which would silently disable the decoy.
      await onSubmit({ ...data, meetingId, hostConsent: consented });
      return;
    }
    await onSubmit({ ...data, meetingId, hostConsent: consented, startTimeMs, durationMs, timezone, ...getSignals() });
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

  // One step ABOVE the `spacing system/m` the design names (16/24 instead of
  // 12/16), because the field messages hang out of flow: they need ~16px on a
  // phone and ~20 on desktop of clear space under the control, and `m` leaves
  // 12/16 — four pixels short at both ends, so an error would print over the
  // next field's label. The design has no error state drawn; this is the
  // smallest ODS step that houses it.
  const FORM_STACK = 'flex flex-col gap-[var(--spacing-system-l)]';

  /** ONE render path for every field — built-in or declared — so the default
   *  order below and any host-supplied `fieldRows` compose the same controls. */
  const renderField = (
    field: ControlArgs['field'],
    where: { id: string; registerName: string; error?: string },
  ): ReactNode => (
    <FieldWrapper key={field.name} label={field.label} htmlFor={where.id} required={field.required} error={where.error}>
      {FIELD_CONTROLS[field.type]({ field, id: where.id, registerName: where.registerName, register, control })}
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

  /** Declared questions no row claims — appended full width, so a question added
   *  in HubSpot can never go invisible by omission from a layout written before it. */
  const unplacedFields = fieldRows
    ? supportedFields.filter(f => !fieldRows.some(row => row.some(slot => slot.name === f.name)))
    : [];

  /** Rows whose every slot names a question the link has not declared are
   *  DROPPED, not rendered empty: an empty grid still eats one form gap, so a
   *  layout written ahead of the HubSpot config would print blank bands. */
  const placedRows = (fieldRows ?? [])
    .map(row => row.filter(slot => slotResolves(slot.name)))
    .filter(row => row.length > 0);

  const submitButton = (
    <Button
      type="submit"
      loading={isSubmitting}
      disabled={isSubmitting}
      // The details-first footer draws a 240px action beside its note
      // (`4904:117335`); the bare slot-first row keeps the button at its natural
      // width, as it always has.
      className={footerNote ? 'md:w-60' : undefined}
    >
      {submitLabel ?? 'Confirm Booking'}
    </Button>
  );

  return (
    <form onSubmit={submit} className={FORM_STACK} noValidate>
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
          {placedRows.map((row, rowIndex) => (
            <div
              key={row.map(s => s.name).join('|') || rowIndex}
              className="grid grid-cols-2 gap-[var(--spacing-system-m)] md:grid-cols-4"
            >
              {row.map(slot => (
                <div
                  key={slot.name}
                  className={cn(
                    // A two-field row stays side by side on a phone — the rule
                    // the built-in name pair has always followed: two short
                    // fields cost one line instead of two on the layout that can
                    // least afford them.
                    row.length === 2 ? 'col-span-1' : 'col-span-2',
                    SPAN_CLASS[slot.span ?? evenSpan(row.length)],
                  )}
                >
                  {slotNode(slot.name)}
                </div>
              ))}
            </div>
          ))}
          {unplacedFields.map(field => (
            <Fragment key={field.name}>{renderDeclaredField(field)}</Fragment>
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
            <Controller
              control={control}
              name="legalConsentResponses"
              render={({ field: rhf }) => (
                <>
                  {legalConsent.communicationConsentCheckboxes.map((box, index) => {
                    const responses = (rhf.value ?? []) as Array<{ communicationTypeId: string; consented: boolean }>;
                    const current = responses.find(r => r.communicationTypeId === box.communicationTypeId);
                    return (
                      // The design system's consent row (`checkbox-block`, the
                      // same block the waitlist form uses): box, label, caption
                      // in one bordered row. GDPR surface — HubSpot's copy is
                      // rendered VERBATIM, never edited. The processing statement
                      // rides as the caption of the FIRST row, once: it describes
                      // the consent as a whole, not each channel.
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
                        label={box.label}
                        description={index === 0 ? legalConsent.processingConsentText : undefined}
                      />
                    );
                  })}
                </>
              )}
            />
            {legalConsent.communicationConsentText && (
              <p className="text-ods-text-secondary text-h6">{legalConsent.communicationConsentText}</p>
            )}
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
        <div className="flex items-center justify-between gap-[var(--spacing-system-m)]">
          <p className="text-ods-text-secondary text-h6">{footerNote}</p>
          {submitButton}
        </div>
      ) : (
        <div className="flex">{submitButton}</div>
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
 * this card. Same footprint discipline as its sibling: fixed heights, no shift
 * when the real form swaps in.
 */
export function BookingFormSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)] lg:p-0">
      <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2">
        <Skeleton className="h-[4.75rem] w-full" />
        <Skeleton className="h-[4.75rem] w-full" />
      </div>
      <Skeleton className="h-[4.75rem] w-full" />
      <Skeleton className="h-[7.75rem] w-full" />
      <Skeleton className="h-[4.25rem] w-full" />
      <div className="flex justify-end">
        <Skeleton className="h-12 w-40" />
      </div>
    </div>
  );
}
