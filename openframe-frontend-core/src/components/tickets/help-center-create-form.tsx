'use client'

/**
 * `<HelpCenterCreateForm />` — thin wrapper around the canonical
 * `<ContactForm />`. Does NOT reimplement form layout / validation /
 * primitives — it just preconfigures `<ContactForm />` for ticket
 * creation:
 *
 *   - Hides every contact-only field (name + email from session,
 *     companySize / referralSource / helpCategory irrelevant).
 *   - Slots a Subject `<Input>` into `extraTopField` (Subject isn't
 *     part of `ContactSchema`; the wrapper manages it locally and
 *     reads the value back in `onCustomSubmit`).
 *   - Pre-fills the hidden name / email / helpCategory from
 *     `useChatIdentity` so Zod's required-field validators pass even
 *     though those inputs aren't rendered.
 *   - Wires `onCustomSubmit` to `actions.submitTicket(...)` so the
 *     ticket lands through the same optimistic-placeholder flow the
 *     rest of the Help Center uses.
 *
 * Why a wrapper instead of inlining `<ContactForm />` directly inside
 * `<HelpCenterList />`: the Subject input needs local state + error
 * state + validation that conceptually pairs with the form, not the
 * orchestrator. Keeping that tiny state machine in its own file keeps
 * `<HelpCenterList />` focused on list/state/pagination concerns.
 */

import { useState, type ChangeEvent } from 'react'
import { Input, Label } from '../ui'
import { ContactForm } from '../contact'
import { useChatIdentity } from '../chat/hooks/use-chat-identity'
import type { UseTicketActionsReturn } from './hooks/use-ticket-actions'

const SUBJECT_MAX_CHARS = 200

export interface HelpCenterCreateFormProps {
  /** The full actions bag from `useTicketActions` — we read
   *  `submitTicket` from it. Passing the whole bag (rather than just
   *  the one method) keeps the wiring shape consistent with other
   *  composition points (e.g. `<HelpCenterCard>` takes individual
   *  action callbacks because the drawer needs four of them; the form
   *  only needs one but the parent already has the bag in scope). */
  actions: UseTicketActionsReturn
  /** Disables every input + button when the support backend (HubSpot)
   *  is down. Wired from the parent's
   *  `useTicketActions.onSupportSystemDown` flag. */
  supportSystemDown?: boolean
}

/**
 * Loading placeholder that mirrors `<HelpCenterCreateForm>`'s outer
 * dimensions so the page chrome doesn't shift when identity resolves
 * and the real form mounts. Same border-radius + padding + section
 * spacing as the form; each inner block is a pulse-bar sized to roughly
 * match the real input/textarea/button it stands in for.
 *
 * Renders the SAME wrapper classes as the real form (the chunky
 * `rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10` shell). Visual
 * continuity > pixel-perfect — the real form's heading is a bit taller
 * than `h-8` on the largest breakpoint, but the wrapper + section gaps
 * dominate the layout cost so the swap is unnoticeable.
 */
export function HelpCenterCreateFormSkeleton() {
  return (
    <div className="h-full flex flex-col border border-ods-border rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10">
      {/* Heading row — matches the form's `text-h2` title block. */}
      <div className="mb-6 md:mb-8">
        <div className="h-8 w-56 bg-ods-border rounded animate-pulse" />
      </div>
      <div className="flex flex-col flex-grow space-y-4 md:space-y-6">
        {/* Subject input + label */}
        <div className="flex flex-col gap-2">
          <div className="h-4 w-20 bg-ods-border rounded animate-pulse" />
          <div className="h-12 w-full bg-ods-border rounded animate-pulse" />
        </div>
        {/* Message textarea + label — taller; matches real Textarea
            (`flex-grow` with a sensible default height while loading). */}
        <div className="flex flex-col gap-2 flex-grow">
          <div className="h-4 w-32 bg-ods-border rounded animate-pulse" />
          <div className="h-32 w-full bg-ods-border rounded animate-pulse" />
        </div>
        {/* Footer row — text on the left, button on the right. */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-end w-full pt-2 mt-auto">
          <div className="h-4 w-72 bg-ods-border rounded animate-pulse" />
          <div className="h-10 w-32 bg-ods-border rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function HelpCenterCreateForm({ actions, supportSystemDown = false }: HelpCenterCreateFormProps) {
  const identity = useChatIdentity()
  const [subject, setSubject] = useState('')
  const [subjectError, setSubjectError] = useState<string | null>(null)

  // Hidden-but-Zod-required pre-fill. `<ContactForm>` validates name +
  // email + helpCategory even when their inputs aren't rendered, so we
  // seed authoritative values from `useChatIdentity`. Whitespace-only
  // display names degrade to email-local-part to clear the min(2)
  // check. `helpCategory` gets a stable sentinel that the server
  // discards before the HubSpot POST.
  const sessionName =
    [identity.user?.firstName, identity.user?.lastName].filter(Boolean).join(' ').trim() ||
    identity.user?.email?.split('@')[0] ||
    'Customer'
  const sessionEmail = identity.user?.email ?? ''

  // Subject input — slotted into `<ContactForm>`'s new `extraTopField`
  // position. Local state + error so the input behaves like the
  // schema-driven siblings.
  const subjectField = (
    <div className="flex flex-col">
      <Label htmlFor="help-center-subject">
        Subject<span className="text-ods-accent">*</span>
      </Label>
      <Input
        id="help-center-subject"
        type="text"
        value={subject}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setSubject(e.target.value)
          if (subjectError) setSubjectError(null)
        }}
        placeholder="Briefly describe what's going on"
        maxLength={SUBJECT_MAX_CHARS}
        aria-invalid={!!subjectError}
        aria-describedby={subjectError ? 'help-center-subject-error' : undefined}
        disabled={supportSystemDown}
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
  )

  return (
    <ContactForm
      title="Open a new ticket"
      footerText="The support team typically responds within one business day."
      hideFields={['name', 'email', 'companySize', 'referralSource', 'helpCategory']}
      defaultValues={{
        name: sessionName,
        email: sessionEmail,
        helpCategory: 'Support Request',
      }}
      extraTopField={subjectField}
      submitLabel="Open ticket"
      attachmentsEnabled
      onCustomSubmit={async (data, attachments) => {
        const trimmedSubject = subject.trim()
        if (!trimmedSubject) {
          setSubjectError('Subject is required')
          // Throw so `<ContactForm>`'s catch path doesn't `reset()` —
          // user keeps their typed message body and just adds a subject.
          throw new Error('SUBJECT_REQUIRED')
        }
        setSubjectError(null)
        const ok = await actions.submitTicket({
          subject: trimmedSubject,
          content: data.message,
          attachments: attachments.length > 0 ? attachments : undefined,
        })
        if (ok) {
          setSubject('')
        } else {
          // Same as above — keep inputs for retry. The toast is already
          // surfaced by `useTicketActions`.
          throw new Error('TICKET_SUBMIT_FAILED')
        }
      }}
    />
  )
}
