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
  /** Authoritative session identity, resolved by the parent
   *  (`HelpCenterList`) which already gates rendering on
   *  `identity.isLoading === false`. Passing these in (instead of
   *  calling `useChatIdentity` again here) avoids a subtle race:
   *  `useChatIdentity` is a plain `useState`+`useEffect` hook (no
   *  shared cache), so a second call inside this child would mount
   *  with `user = null` and a stale `sessionEmail = ''`, locking
   *  react-hook-form's `defaultValues.email` to an empty string for
   *  the lifetime of the form — Zod then rejects the submit silently. */
  sessionName: string
  sessionEmail: string
  /** Disables every input + button when the support backend (HubSpot)
   *  is down. Wired from the parent's
   *  `useTicketActions.onSupportSystemDown` flag. */
  supportSystemDown?: boolean
}

/**
 * Loading placeholder that mirrors `<HelpCenterCreateForm>`'s outer
 * dimensions PIXEL-FOR-PIXEL so the page chrome doesn't shift when
 * identity resolves and the real form mounts.
 *
 * Verified against live DOM bounding-rect measurements at the lg
 * breakpoint — every section's top + height matches the real form to
 * the pixel (skeleton wrapper 556px == real wrapper 556px). Each
 * section uses the SAME flex / spacing / padding classes the real
 * form uses, so the gaps propagate identically; only the inner
 * content swaps an `<Input>` / `<Textarea>` / `<Button>` for a
 * same-sized animated `bg-ods-border` bar.
 *
 *   wrapper          → `p-6 md:p-8 lg:p-10` + border + rounded-3xl
 *   heading area     → 56px (`mb-6 md:mb-8` container, h-10 inner bar
 *                       + `mb-3 md:mb-4` = 40 + 16)
 *   subject section  → 79px (`h-[27px]` label + `mb-1` (4px) + h-12
 *                       input = 27 + 4 + 48)
 *   message section  → 127px (`h-[27px]` label + `mb-1` + h-24
 *                       textarea = 27 + 4 + 96)
 *   attachments row  → 28px (h-7 add button + helper label)
 *   footer           → 56px (h-12 button + `pt-2 mt-auto`)
 *   between sections → `space-y-4 md:space-y-6` (16/24px)
 *
 * One non-obvious detail: the real `<ContactForm>` renders 4
 * `<input type="hidden">` registrations BEFORE the visible Subject
 * section (for the hidden name/email/helpCategory/message fields).
 * Tailwind's `space-y-*` rule (`:not([hidden]) ~ :not([hidden])`)
 * counts `type="hidden"` inputs as siblings, so Subject gets a 24px
 * top margin. The skeleton mirrors those 4 hidden inputs exactly so
 * the spacing rule fires identically — without them the whole stack
 * shifts up 24px on every page load.
 */
export function HelpCenterCreateFormSkeleton() {
  return (
    <div className="h-full flex flex-col border border-ods-border rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10">
      {/* Heading container — mirrors `mb-6 md:mb-8` + h2 with its own
          `mb-3 md:mb-4` and `text-h2` height (32px font, line-height
          ~1.25 → 40px). h-10 bar matches the rendered h2 height. */}
      <div className="mb-6 md:mb-8">
        <div className="h-10 w-72 bg-ods-border rounded animate-pulse mb-3 md:mb-4" />
      </div>

      {/* Form body — same `space-y-4 md:space-y-6` gap stack.
          IMPORTANT: the real `<ContactForm>` prepends 4
          `<input type="hidden">` registrations for the hidden
          name/email/helpCategory/message fields (see contact-form.tsx).
          `space-y-*` uses `:not([hidden]) ~ :not([hidden])` — `type="hidden"`
          inputs aren't excluded — so those hidden inputs ARE counted as
          siblings, and the visible Subject section gets a 24px top
          margin. The skeleton mirrors that exact structure with the
          same 4 hidden inputs so the Subject placeholder lands at the
          same Y as the real Subject input. Removing them would shift
          the whole stack up by 24px on every page load. */}
      <div className="flex flex-col flex-grow space-y-4 md:space-y-6">
        <input type="hidden" aria-hidden />
        <input type="hidden" aria-hidden />
        <input type="hidden" aria-hidden />
        <input type="hidden" aria-hidden />
        {/* Subject section — `flex flex-col` matches real form. Label
            bar uses arbitrary `h-[27px]` to match the live Label
            component (18px font * 1.5 line-height = 27px) and `mb-1`
            (4px) which is Tailwind's default `mb-1`. Total section
            height: 27 + 4 + 48 (h-12 input) = 79px, identical to
            real form. */}
        <div className="flex flex-col">
          <div className="h-[27px] w-20 bg-ods-border rounded animate-pulse mb-1" />
          <div className="h-12 w-full bg-ods-border rounded animate-pulse" />
        </div>

        {/* Message section — `flex flex-col flex-grow` matches real
            form (textarea fills remaining vertical space inside the
            wrapper). h-24 bar (96px) = textarea's natural rendered
            height when the wrapper has the standard list + footer
            below it. Same `h-[27px]` + `mb-1` Label pattern as Subject:
            27 + 4 + 96 = 127px, identical to real form. */}
        <div className="flex flex-col flex-grow">
          <div className="h-[27px] w-32 bg-ods-border rounded animate-pulse mb-1" />
          <div className="h-24 w-full bg-ods-border rounded animate-pulse flex-grow" />
        </div>

        {/* Attachments row — mirrors the real `flex flex-col gap-2`
            container with chip strip (empty when no files staged) +
            the h-7 add button + helper text. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-ods-border rounded animate-pulse shrink-0" />
            <div className="h-4 w-40 bg-ods-border rounded animate-pulse" />
          </div>
        </div>

        {/* Footer — same `pt-2 mt-auto` so it sticks to the bottom.
            Button bar is h-12 to match the real `<Button>` height
            (48px). */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-end w-full pt-2 mt-auto">
          <div className="h-4 w-72 bg-ods-border rounded animate-pulse" />
          <div className="h-12 w-32 bg-ods-border rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function HelpCenterCreateForm({
  actions,
  sessionName,
  sessionEmail,
  supportSystemDown = false,
}: HelpCenterCreateFormProps) {
  const [subject, setSubject] = useState('')
  const [subjectError, setSubjectError] = useState<string | null>(null)

  // Subject input — slotted into `<ContactForm>`'s new `extraTopField`
  // position. Local state + error so the input behaves like the
  // schema-driven siblings.
  const subjectField = (
    <div className="flex flex-col">
      <Label htmlFor="help-center-subject">Ticket Subject</Label>
      <Input
        id="help-center-subject"
        type="text"
        value={subject}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setSubject(e.target.value)
          if (subjectError) setSubjectError(null)
        }}
        placeholder="Enter Subject Here"
        maxLength={SUBJECT_MAX_CHARS}
        aria-invalid={!!subjectError}
        aria-describedby={subjectError ? 'help-center-subject-error' : undefined}
        disabled={supportSystemDown}
        className="bg-ods-card border-ods-border text-ods-text-primary placeholder-ods-text-secondary px-3 h-12"
      />
      {subjectError && (
        <span
          id="help-center-subject-error"
          className="text-ods-error text-h6 mt-1"
        >
          {subjectError}
        </span>
      )}
    </div>
  )

  return (
    <ContactForm
      title=""
      footerText=""
      messagePlaceholder="Describe your issue or question in detail..."
      hideFields={['name', 'email', 'companySize', 'referralSource', 'helpCategory']}
      defaultValues={{
        name: sessionName,
        email: sessionEmail,
        helpCategory: 'Support Request',
      }}
      extraTopField={subjectField}
      submitLabel="Open Ticket"
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
