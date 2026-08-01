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
  const inputClass = 'bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-12'

  return (
    <form onSubmit={submit} className="flex flex-col space-y-4 md:space-y-6" noValidate>
      <HoneypotField {...honeypotInputProps} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="flex flex-col">
          <Label htmlFor="ms-first-name">
            First name<span className="text-ods-accent">*</span>
          </Label>
          <Input
            id="ms-first-name"
            autoComplete="given-name"
            placeholder="Jane"
            aria-invalid={!!errors.firstName}
            className={inputClass}
            {...register('firstName')}
          />
          {errors.firstName && <span className="text-ods-error text-h6 mt-1">{errors.firstName.message}</span>}
        </div>
        <div className="flex flex-col">
          <Label htmlFor="ms-last-name">
            Last name<span className="text-ods-accent">*</span>
          </Label>
          <Input
            id="ms-last-name"
            autoComplete="family-name"
            placeholder="Doe"
            aria-invalid={!!errors.lastName}
            className={inputClass}
            {...register('lastName')}
          />
          {errors.lastName && <span className="text-ods-error text-h6 mt-1">{errors.lastName.message}</span>}
        </div>
      </div>

      <div className="flex flex-col">
        <Label htmlFor="ms-email">
          Email<span className="text-ods-accent">*</span>
        </Label>
        <Input
          id="ms-email"
          type="email"
          autoComplete="email"
          placeholder="jane@company.com"
          aria-invalid={!!errors.email}
          className={inputClass}
          {...register('email')}
        />
        {errors.email && <span className="text-ods-error text-h6 mt-1">{errors.email.message}</span>}
      </div>

      {supportedFields.map((field) => (
        <div key={field.name} className="flex flex-col">
          <Label htmlFor={`ms-q-${field.name}`}>
            {field.label}
            {field.required && <span className="text-ods-accent">*</span>}
          </Label>
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
              className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-12"
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
                <div className="flex items-center gap-[var(--spacing-system-xs)]">
                  <Checkbox
                    id={`ms-q-${field.name}`}
                    checked={Boolean(rhf.value)}
                    onCheckedChange={(v) => rhf.onChange(v === true)}
                  />
                  <Label htmlFor={`ms-q-${field.name}`}>{field.label}</Label>
                </div>
              )}
            />
          )}
          {fieldError(field.name) && (
            <span className="text-ods-error text-h6 mt-1">{fieldError(field.name)}</span>
          )}
        </div>
      ))}

      {legalConsent && (
        <div className="flex flex-col gap-[var(--spacing-system-xs)] border border-ods-border rounded-md p-[var(--spacing-system-md)]">
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
                      <Label htmlFor={`ms-consent-${box.communicationTypeId}`}>
                        {box.label}
                        {box.required ? ' *' : ''}
                      </Label>
                    </div>
                  )
                })}
              </>
            )}
          />
          {legalConsent.privacyPolicyText && (
            <p className="text-h6 text-ods-text-secondary">{legalConsent.privacyPolicyText}</p>
          )}
          {errors.legalConsentResponses && (
            <p className="text-h6 text-ods-error">{errors.legalConsentResponses.message as string}</p>
          )}
        </div>
      )}

      {/* Step navigation back to the calendar lives in the step header (the
          app-standard BackButton, rendered by the parent) — the form ships
          only its submit. */}
      <div className="flex">
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting} className="w-full md:w-auto">
          Confirm booking
        </Button>
      </div>
    </form>
  )
}
