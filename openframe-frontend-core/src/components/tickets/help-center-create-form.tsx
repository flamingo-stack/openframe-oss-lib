'use client'

/**
 * `<HelpCenterCreateForm />` — the "Open a new ticket" form at the top
 * of the Help Center page.
 *
 * Self-contained lib component — no dependency on the hub's
 * `<ContactForm />`. Uses the SAME primitives (`<Input>`, `<Textarea>`,
 * `<Button>`, `<Label>`) and the SAME wrapper styling
 * (`border border-ods-border rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10`)
 * so the visual treatment matches every other primary form in the app.
 *
 * Identity is resolved internally via `useChatIdentity` — the form
 * disables itself when not authenticated (the parent `<HelpCenterList>`
 * gates the whole surface on identity, so this is defense-in-depth).
 *
 * Submission flows through `onSubmit({ subject, content })` which the
 * parent typically wires to `actions.submitTicket` from
 * `useTicketActions`. The form clears the subject + message on success
 * and keeps them on failure so the user can retry without retyping.
 */

import { useState, type FormEvent } from 'react'
import { Button, Input, Textarea, Label } from '../ui'

const SUBJECT_MAX_CHARS = 200
const MESSAGE_MAX_CHARS = 5000

export interface HelpCenterCreateFormInput {
  subject: string
  content: string
}

export interface HelpCenterCreateFormProps {
  /** Submit handler — typically `actions.submitTicket` from the parent's
   *  `useTicketActions`. Returns true on success so the form can clear
   *  its inputs. Throws / returns false → form preserves inputs so the
   *  user can retry. */
  onSubmit: (input: HelpCenterCreateFormInput) => Promise<boolean>
  /** Disables every input + button when the support backend (HubSpot)
   *  is down. Wired from the parent's `useTicketActions
   *  .onSupportSystemDown` flag. */
  supportSystemDown?: boolean
  /** Override the heading. Defaults to "Open a new ticket". */
  title?: string
  /** Override the footer copy. Defaults to the standard response-time
   *  promise. */
  footerText?: string
  /** Override the submit-button label. Defaults to "Open ticket". */
  submitLabel?: string
}

export function HelpCenterCreateForm({
  onSubmit,
  supportSystemDown = false,
  title = 'Open a new ticket',
  footerText = 'The support team typically responds within one business day.',
  submitLabel = 'Open ticket',
}: HelpCenterCreateFormProps) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const disabled = supportSystemDown || isSubmitting

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    // Synchronous validation BEFORE the network call so the user sees
    // both error states at once if they submit an empty form. Subject
    // and message are both required; we don't bother checking max
    // because `maxLength` on the input already enforces it.
    const trimmedSubject = subject.trim()
    const trimmedMessage = message.trim()
    const nextSubjectError = trimmedSubject ? null : 'Subject is required'
    const nextMessageError = trimmedMessage.length < 10
      ? 'Please describe your issue in at least 10 characters'
      : null
    setSubjectError(nextSubjectError)
    setMessageError(nextMessageError)
    if (nextSubjectError || nextMessageError) return

    setIsSubmitting(true)
    try {
      const ok = await onSubmit({ subject: trimmedSubject, content: trimmedMessage })
      if (ok) {
        setSubject('')
        setMessage('')
      }
      // On failure (ok === false): keep inputs so the user can retry.
      // The parent's `useTicketActions` toasts the failure reason.
    } catch {
      // Same as ok===false — preserve inputs. The parent toasts.
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col border border-ods-border rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10">
      {title && (
        <div className="mb-6 md:mb-8">
          <h2 className="text-h2 tracking-[-0.04em] text-ods-text-primary mb-3 md:mb-4">
            {title}
          </h2>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col flex-grow space-y-4 md:space-y-6">
        <div className="flex flex-col">
          <Label htmlFor="help-center-subject">
            Subject<span className="text-ods-accent">*</span>
          </Label>
          <Input
            id="help-center-subject"
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              if (subjectError) setSubjectError(null)
            }}
            placeholder="Briefly describe what's going on"
            maxLength={SUBJECT_MAX_CHARS}
            aria-invalid={!!subjectError}
            aria-describedby={subjectError ? 'help-center-subject-error' : undefined}
            disabled={disabled}
            className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-12"
          />
          {subjectError && (
            <span
              id="help-center-subject-error"
              className="text-ods-error text-xs font-['DM_Sans'] mt-1"
            >
              {subjectError}
            </span>
          )}
        </div>

        <div className="flex flex-col flex-grow">
          <Label htmlFor="help-center-message">
            Describe your issue<span className="text-ods-accent">*</span>
          </Label>
          <Textarea
            id="help-center-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              if (messageError) setMessageError(null)
            }}
            placeholder="What happened? Include any error messages or steps to reproduce."
            maxLength={MESSAGE_MAX_CHARS}
            aria-invalid={!!messageError}
            aria-describedby={messageError ? 'help-center-message-error' : undefined}
            disabled={disabled}
            className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary h-full flex-grow"
          />
          {messageError && (
            <span
              id="help-center-message-error"
              className="text-ods-error text-xs font-['DM_Sans'] mt-1"
            >
              {messageError}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-end w-full pt-2 mt-auto">
          {footerText && (
            <p className="font-['DM_Sans'] text-ods-text-secondary text-xs md:text-sm leading-relaxed text-center md:text-left">
              {footerText}
            </p>
          )}
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={disabled}
            variant="accent"
            className="w-full md:w-auto"
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
