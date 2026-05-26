'use client'

/**
 * `<ContactForm />` — the canonical contact form used by every public
 * surface (TMCG join, case-study pitch, generic /contact, Help Center
 * ticket creation, etc.).
 *
 * Self-contained inside the lib — host-specific values (user id for
 * tracking, platform-specific contact reasons, reddit-click attribution
 * id) flow IN via props. The hub passes them via a thin
 * `<ContactForm>` wrapper that resolves them from `useAuth` /
 * `getAppConfig` / `getStoredRedditClickId`. Other embedders pass
 * whatever they have (or omit).
 *
 * Field-hide + custom-submit + extra-top-field knobs let one form
 * serve both contact and ticket-creation flows without forking:
 *   - Contact page: rendered with all fields visible, built-in submit
 *     flow to `/api/contact` via `useContactSubmission`.
 *   - Ticket page: hides name/email/companySize/referralSource/
 *     helpCategory; supplies `extraTopField` (a Subject input) +
 *     `onCustomSubmit` wired to `useTicketActions.submitTicket`.
 */

import { useState, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ContactSchema,
  type ContactFormData,
  companySizeOptions,
  referralSourceOptions,
  defaultHelpCategoryOptions,
} from '../../schemas/contact-schema'
import {
  Button,
  type ButtonProps,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label,
} from '../ui'
import { useContactSubmission } from '../../hooks/use-contact-submission'

/**
 * Fields the caller can suppress. Six values — every primary form
 * field plus `name` and `email` (newly hideable so ticket-creation
 * surfaces can hide them; they still need to validate, so the caller
 * MUST supply pre-filled values via `defaultValues` when hiding them).
 */
export type ContactFormHideableField =
  | 'name'
  | 'email'
  | 'companySize'
  | 'referralSource'
  | 'helpCategory'
  | 'message'

export interface ContactFormProps {
  /** Host-side user id passed to `useContactSubmission` for attribution.
   *  Hub wrapper passes `useAuth().user?.id`; lib's Help Center surface
   *  passes `useChatIdentity().user?.id`. Omit for anon flows. */
  userId?: string
  /** Platform-specific help-category dropdown options. Hub wrapper
   *  passes `getAppConfig().contact.contactReasons`. Defaults to the
   *  lib's `defaultHelpCategoryOptions`. */
  helpCategoryOptions?: readonly string[]
  /** Reddit click attribution id. Caller resolves from wherever they
   *  stash it (hub: sessionStorage via `getStoredRedditClickId`). When
   *  set, it's spread into the submission payload. */
  rdtCid?: string
  /** Called after a successful submit so the caller can clear their
   *  attribution storage (hub wrapper calls `clearStoredRedditClickId`).
   *  Fires for BOTH the built-in and custom submit paths. */
  onSubmitSuccess?: () => void

  prefilledReason?: string
  prefilledMessage?: string
  hideFields?: ContactFormHideableField[]
  /** Authoritative pre-fill for any field the caller hides. Merged
   *  into react-hook-form's `defaultValues` AFTER the legacy
   *  `prefilledReason` / `prefilledMessage` props (caller-supplied
   *  wins). REQUIRED when hiding `name` / `email` / `helpCategory` —
   *  those fields are still validated by Zod even when not rendered. */
  defaultValues?: Partial<ContactFormData>
  /** Optional custom submit handler. When provided, the form bypasses
   *  the built-in `useContactSubmission` flow (no /api/contact call,
   *  no success-redirect, no built-in toast) — the caller owns the
   *  entire side-effect chain. Reset + `onSubmitSuccess` still fire
   *  on a successful await. */
  onCustomSubmit?: (data: ContactFormData) => Promise<void>
  /** Render slot for an EXTRA field at the very top of the form,
   *  ABOVE the name/email row. Use this for ticket surfaces that need
   *  a Subject input — the field is NOT part of `ContactSchema`, so
   *  the caller manages its own state + validation and reads the
   *  value back inside `onCustomSubmit`. */
  extraTopField?: ReactNode

  title?: string
  subtitle?: string
  footerText?: string
  noBorder?: boolean
  noPadding?: boolean
  buttonVariant?: ButtonProps['variant']
  buttonClassName?: string
  /** Submit-button label. Defaults to "Send Message". Override for
   *  ticket surfaces (e.g. "Open ticket"). */
  submitLabel?: string
  /** Success-state submit-button label (shown briefly after submit on
   *  the built-in flow). Defaults to "Message Sent!". Has no effect
   *  when `onCustomSubmit` is provided — the caller owns success UX. */
  submitSuccessLabel?: string
  successRedirectUrl?: string
  successToastMessage?: string
}

export function ContactForm({
  userId,
  helpCategoryOptions = defaultHelpCategoryOptions,
  rdtCid,
  onSubmitSuccess,
  prefilledReason,
  prefilledMessage,
  hideFields = [],
  defaultValues: defaultValuesProp,
  onCustomSubmit,
  extraTopField,
  title = 'Hit Us Up',
  subtitle,
  footerText = 'We typically respond within 24 hours. We respect your privacy – no spam, ever.',
  noBorder = false,
  noPadding = false,
  buttonVariant = 'accent',
  buttonClassName = '',
  submitLabel = 'Send Message',
  submitSuccessLabel = 'Message Sent!',
  successRedirectUrl = '/blog#community',
  successToastMessage = 'Redirecting you to join our community...',
}: ContactFormProps = {}) {
  // Built-in contact-API flow. Hook is called unconditionally (rules
  // of hooks); we just don't dispatch its `submit` when the caller
  // passes `onCustomSubmit`. The hook owns its own toast + redirect
  // chain so bypassing it cleanly hands all side-effects to the caller.
  const builtInSubmission = useContactSubmission({
    userId,
    successRedirectUrl,
    successToastMessage,
  })
  // Independent in-flight tracker for the custom path — we can't reuse
  // `builtInSubmission.isSubmitting` because that hook never sees a
  // request when `onCustomSubmit` is active.
  const [customSubmitting, setCustomSubmitting] = useState(false)

  const isSubmitting = onCustomSubmit ? customSubmitting : builtInSubmission.isSubmitting
  // `isSuccess` only ever fires on the built-in path; custom callers
  // own their own UX (no "Message Sent!" button-label flicker).
  const isSuccess = onCustomSubmit ? false : builtInSubmission.isSuccess

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(ContactSchema),
    defaultValues: {
      ...(prefilledReason && { helpCategory: prefilledReason }),
      ...(prefilledMessage && { message: prefilledMessage }),
      // Caller-supplied defaults win over the legacy `prefilled*` props
      // (they're the authoritative seed for hidden fields).
      ...defaultValuesProp,
    },
  })

  const handleFormSubmit = async (data: ContactFormData) => {
    if (isSubmitting) return
    try {
      const payload = { ...data, ...(rdtCid && { rdt_cid: rdtCid }) }
      if (onCustomSubmit) {
        setCustomSubmitting(true)
        try {
          await onCustomSubmit(payload)
        } finally {
          setCustomSubmitting(false)
        }
      } else {
        await builtInSubmission.submit(payload)
      }
      onSubmitSuccess?.()
      reset()
    } catch {
      // Error toast is owned by the active flow:
      //  - built-in: `useContactSubmission` toasts inside `submit()`.
      //  - custom:   the caller toasts inside `onCustomSubmit`.
      // Either way we swallow here so a thrown error doesn't crash the
      // form tree (react-hook-form's onSubmit handler rejects upward).
    }
  }

  const showName = !hideFields.includes('name')
  const showEmail = !hideFields.includes('email')
  const showNameEmailRow = showName || showEmail
  const showCompanySize = !hideFields.includes('companySize')
  const showReferralSource = !hideFields.includes('referralSource')
  const showHelpCategory = !hideFields.includes('helpCategory')
  const showMessage = !hideFields.includes('message')

  return (
    <div
      className={`h-full flex flex-col ${!noBorder ? 'border border-ods-border rounded-2xl md:rounded-3xl' : ''} ${!noPadding ? 'p-6 md:p-8 lg:p-10' : ''}`}
    >
      {(title || subtitle) && (
        <div className="mb-6 md:mb-8">
          {title && (
            <h2 className="text-h2 tracking-[-0.04em] text-ods-text-primary mb-3 md:mb-4">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="font-['DM_Sans'] font-medium text-[16px] md:text-[18px] leading-[24px] text-ods-text-primary">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col flex-grow space-y-4 md:space-y-6"
      >
        {/* Extra top field (e.g. Subject for ticket forms). Rendered
            outside the schema-driven layout so the caller fully owns
            label / placeholder / state. */}
        {extraTopField}

        {showNameEmailRow && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {showName && (
              <div className="flex flex-col">
                <Label htmlFor="name">
                  Your Name<span className="text-ods-accent">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  {...register('name')}
                  placeholder="Jane Doe"
                  aria-invalid={!!errors.name}
                  aria-describedby="name-error"
                  className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-12"
                />
                {errors.name && (
                  <span id="name-error" className="text-ods-error text-xs font-['DM_Sans'] mt-1">
                    {errors.name.message}
                  </span>
                )}
              </div>
            )}
            {showEmail && (
              <div className="flex flex-col">
                <Label htmlFor="email">
                  Email<span className="text-ods-accent">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="jane@company.com"
                  aria-invalid={!!errors.email}
                  aria-describedby="email-error"
                  className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-12"
                />
                {errors.email && (
                  <span id="email-error" className="text-ods-error text-xs font-['DM_Sans'] mt-1">
                    {errors.email.message}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {(showCompanySize || showReferralSource) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {showCompanySize && (
              <div className="flex flex-col">
                <Label htmlFor="companySize">Company Size</Label>
                <Controller
                  control={control}
                  name="companySize"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger
                        id="companySize"
                        aria-label="Company Size"
                        className="bg-ods-card border-ods-border text-ods-text-primary h-12 px-3"
                      >
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                      <SelectContent>
                        {companySizeOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.companySize && (
                  <span id="companySize-error" className="text-ods-error text-xs font-['DM_Sans'] mt-1">
                    {errors.companySize.message}
                  </span>
                )}
              </div>
            )}
            {showReferralSource && (
              <div className="flex flex-col">
                <Label htmlFor="referralSource">How did you hear about us?</Label>
                <Controller
                  control={control}
                  name="referralSource"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger
                        id="referralSource"
                        aria-label="Referral Source"
                        className="bg-ods-card border-ods-border text-ods-text-primary h-12 px-3"
                      >
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {referralSourceOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.referralSource && (
                  <span id="referralSource-error" className="text-ods-error text-xs font-['DM_Sans'] mt-1">
                    {errors.referralSource.message}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {showHelpCategory && (
          <div className="flex flex-col">
            <Label htmlFor="helpCategory">
              Choose your main interest<span className="text-ods-accent">*</span>
            </Label>
            <Controller
              control={control}
              name="helpCategory"
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger
                    id="helpCategory"
                    aria-label="Help Category"
                    className="bg-ods-card border-ods-border text-ods-text-primary h-12 px-3"
                  >
                    <SelectValue placeholder="Choose your main interest" />
                  </SelectTrigger>
                  <SelectContent>
                    {helpCategoryOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.helpCategory && (
              <span id="helpCategory-error" className="text-ods-error text-xs font-['DM_Sans'] mt-1">
                {errors.helpCategory.message}
              </span>
            )}
          </div>
        )}

        {showMessage && (
          <div className="flex flex-col flex-grow">
            <Label htmlFor="message">
              Your Message<span className="text-ods-accent">*</span>
            </Label>
            <Textarea
              id="message"
              {...register('message')}
              placeholder="Share your current challenges or questions about open-source alternatives..."
              aria-invalid={!!errors.message}
              aria-describedby="message-error"
              className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary h-full flex-grow"
            />
            {errors.message && (
              <span id="message-error" className="text-ods-error text-xs font-['DM_Sans'] mt-1">
                {errors.message.message}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-end w-full pt-2 mt-auto">
          {footerText && (
            <p className="font-['DM_Sans'] text-ods-text-secondary text-xs md:text-sm leading-relaxed text-center md:text-left">
              {footerText}
            </p>
          )}
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting || isSuccess}
            variant={buttonVariant}
            className={`w-full md:w-auto ${buttonClassName}`}
          >
            {isSuccess ? submitSuccessLabel : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
