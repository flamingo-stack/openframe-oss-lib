'use client'

import { useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  makeBookingSchema,
  isSupportedFormField,
  type MeetingAvailability,
  type MeetingBookingPayload,
} from '../../schemas/meeting-booking-schema'
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
  RadioGroup,
  RadioGroupItem,
} from '../ui'
import { HoneypotField } from '../ui/honeypot-field'

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

export interface BookingFormProps {
  availability: MeetingAvailability
  meetingId: string
  startTimeMs: number
  durationMs: number
  /** IANA zone the confirmation/invite should render in (parent-resolved). */
  timezone: string
  isSubmitting: boolean
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  /** From useHumanitySignals — parent owns the instance so it can resetSignals(). */
  honeypotInputProps: { ref: React.Ref<HTMLInputElement>; name: string }
  getSignals: () => Record<string, string | number>
}

export function BookingForm({
  availability,
  meetingId,
  startTimeMs,
  durationMs,
  timezone,
  isSubmitting,
  onSubmit,
  honeypotInputProps,
  getSignals,
}: BookingFormProps) {
  const { formFields, legalConsent } = availability
  const supportedFields = useMemo(() => formFields.filter(isSupportedFormField), [formFields])
  const schema = useMemo(() => makeBookingSchema(supportedFields, legalConsent), [supportedFields, legalConsent])

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MeetingBookingPayload>({
    resolver: zodResolver(schema),
    defaultValues: {
      meetingId,
      startTimeMs,
      durationMs,
      timezone,
      locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
      firstName: '',
      lastName: '',
      email: '',
      formFields: {},
      legalConsentResponses: (legalConsent?.communicationConsentCheckboxes ?? []).map((c) => ({
        communicationTypeId: c.communicationTypeId,
        consented: false,
      })),
    },
  })

  const submit = handleSubmit(async (data) => {
    await onSubmit({ ...data, meetingId, startTimeMs, durationMs, timezone, ...getSignals() })
  })

  const fieldError = (name: string): string | undefined => {
    const err = (errors.formFields as Record<string, { message?: string }> | undefined)?.[name]
    return err?.message
  }

  // Field chrome mirrors ContactForm 1:1 (`contact/contact-form.tsx`) — the
  // booking form must be indistinguishable from every other form in the app.
  const inputClass = 'bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-11 md:h-12'
  // One step ABOVE the `spacing system/m` the design names (16/24 instead of
  // 12/16), because the field messages hang out of flow: they need ~16px on a
  // phone and ~20 on desktop of clear space under the control, and `m` leaves
  // 12/16 — four pixels short at both ends, so an error would print over the
  // next field's label. The design has no error state drawn; this is the
  // smallest ODS step that houses it.
  const FORM_STACK = 'flex flex-col gap-[var(--spacing-system-l)]'

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
          is carried by `required` on the control (read out by assistive tech),
          not by an asterisk the design does not draw. */}
      <FieldWrapper label="Email" htmlFor="ms-email" error={errors.email?.message}>
        <Input
          id="ms-email"
          type="email"
          required
          autoComplete="email"
          placeholder="jane@company.com"
          aria-invalid={!!errors.email}
          className={inputClass}
          {...register('email')}
        />
      </FieldWrapper>

      <div className="grid grid-cols-2 gap-[var(--spacing-system-m)]">
        <FieldWrapper label="First Name" htmlFor="ms-first-name" error={errors.firstName?.message}>
          <Input
            id="ms-first-name"
            required
            autoComplete="given-name"
            placeholder="Jane"
            aria-invalid={!!errors.firstName}
            className={inputClass}
            {...register('firstName')}
          />
        </FieldWrapper>
        <FieldWrapper label="Last Name" htmlFor="ms-last-name" error={errors.lastName?.message}>
          <Input
            id="ms-last-name"
            required
            autoComplete="family-name"
            placeholder="Doe"
            aria-invalid={!!errors.lastName}
            className={inputClass}
            {...register('lastName')}
          />
        </FieldWrapper>
      </div>

      {supportedFields.map((field) => (
        <FieldWrapper
          key={field.name}
          label={field.label}
          htmlFor={`ms-q-${field.name}`}
          error={fieldError(field.name)}
        >
          {field.type === 'textarea' && (
            <Textarea
              id={`ms-q-${field.name}`}
              className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3"
              {...register(`formFields.${field.name}` as never)}
            />
          )}
          {field.type === 'text' && (
            <Input
              id={`ms-q-${field.name}`}
              className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-11 md:h-12"
              {...register(`formFields.${field.name}` as never)}
            />
          )}
          {(field.type === 'select' || field.type === 'radio') && (
            <Controller
              control={control}
              name={`formFields.${field.name}` as never}
              render={({ field: rhf }) =>
                field.type === 'select' ? (
                  <Select value={(rhf.value as string) ?? ''} onValueChange={rhf.onChange}>
                    <SelectTrigger id={`ms-q-${field.name}`}>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <RadioGroup value={(rhf.value as string) ?? ''} onValueChange={rhf.onChange}>
                    {(field.options ?? []).map((opt) => (
                      <div key={opt} className="flex items-center gap-[var(--spacing-system-xs)]">
                        <RadioGroupItem id={`ms-q-${field.name}-${opt}`} value={opt} />
                        <Label htmlFor={`ms-q-${field.name}-${opt}`}>{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )
              }
            />
          )}
          {field.type === 'checkbox' && (
            <Controller
              control={control}
              name={`formFields.${field.name}` as never}
              render={({ field: rhf }) => (
                // The question's Label above already carries the text and
                // binds to this id — a second inline label would double the
                // visible text AND the accessible name.
                <div className="flex items-center gap-[var(--spacing-system-xs)]">
                  <Checkbox
                    id={`ms-q-${field.name}`}
                    checked={Boolean(rhf.value)}
                    onCheckedChange={(v) => rhf.onChange(v === true)}
                  />
                </div>
              )}
            />
          )}
        </FieldWrapper>
      ))}

      {legalConsent && (
        // Same out-of-flow message as the fields above, so a missed consent
        // box doesn't shove the submit button down the card. With no error the
        // wrapper is `display:contents` and the panel below is the flex item,
        // exactly as it was.
        <FieldWrapper error={errors.legalConsentResponses?.message as string | undefined}>
        <div className="flex flex-col gap-[var(--spacing-system-xs)] border border-ods-border rounded-md p-[var(--spacing-system-m)]">
          {/* GDPR surface — HubSpot's consent copy rendered VERBATIM, never edited. */}
          <p className="text-h6 text-ods-text-secondary">{legalConsent.processingConsentText}</p>
          {legalConsent.communicationConsentText && (
            <p className="text-h6 text-ods-text-secondary">{legalConsent.communicationConsentText}</p>
          )}
          <Controller
            control={control}
            name="legalConsentResponses"
            render={({ field: rhf }) => (
              <>
                {legalConsent.communicationConsentCheckboxes.map((box) => {
                  const responses = (rhf.value ?? []) as Array<{ communicationTypeId: string; consented: boolean }>
                  const current = responses.find((r) => r.communicationTypeId === box.communicationTypeId)
                  return (
                    <div key={box.communicationTypeId} className="flex items-center gap-[var(--spacing-system-xs)]">
                      <Checkbox
                        id={`ms-consent-${box.communicationTypeId}`}
                        checked={current?.consented ?? false}
                        onCheckedChange={(v) =>
                          rhf.onChange(
                            responses.map((r) =>
                              r.communicationTypeId === box.communicationTypeId ? { ...r, consented: v === true } : r,
                            ),
                          )
                        }
                      />
                      <Label htmlFor={`ms-consent-${box.communicationTypeId}`}>{box.label}</Label>
                    </div>
                  )
                })}
              </>
            )}
          />
          {legalConsent.privacyPolicyText && (
            <p className="text-h6 text-ods-text-secondary">{legalConsent.privacyPolicyText}</p>
          )}
        </div>
        </FieldWrapper>
      )}

      {/* Step navigation back to the calendar lives in the step header (the
          app-standard BackButton, rendered by the parent) — the form ships
          only its submit. */}
      <div className="flex">
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          Confirm Booking
        </Button>
      </div>
    </form>
  )
}
