'use client';

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

import { useState, type ChangeEvent } from 'react';
import { ContactForm } from '../contact';
import { Input, Label } from '../ui';
import { AnnouncedLoadingScope, useLoadingScope } from '../ui/loading-scope';
import { RequiredMark } from '../ui/required-mark';
import type { UseTicketActionsReturn } from './hooks/use-ticket-actions';

const SUBJECT_MAX_CHARS = 200;

interface HelpCenterCreateFormLoadedProps {
  /** The full actions bag from `useTicketActions` — we read
   *  `submitTicket` from it. Passing the whole bag (rather than just
   *  the one method) keeps the wiring shape consistent with other
   *  composition points (e.g. `<HelpCenterCard>` takes individual
   *  action callbacks because the drawer needs four of them; the form
   *  only needs one but the parent already has the bag in scope). */
  actions: UseTicketActionsReturn;
  /** Authoritative session identity, resolved by the parent
   *  (`HelpCenterList`) which already gates rendering on
   *  `identity.isLoading === false`. Passing these in (instead of
   *  calling `useChatIdentity` again here) avoids a subtle race:
   *  `useChatIdentity` is a plain `useState`+`useEffect` hook (no
   *  shared cache), so a second call inside this child would mount
   *  with `user = null` and a stale `sessionEmail = ''`, locking
   *  react-hook-form's `defaultValues.email` to an empty string for
   *  the lifetime of the form — Zod then rejects the submit silently. */
  sessionName: string;
  sessionEmail: string;
  /** Disables every input + button when the support backend (HubSpot)
   *  is down. Wired from the parent's
   *  `useTicketActions.onSupportSystemDown` flag. */
  supportSystemDown?: boolean;
  /** Not loading: the form. */
  loading?: false;
}

/**
 * The form's props. `loading: true` (the session identity is still being read): the form draws its own loading state
 * (as in a page's loading scope), at the loaded form's size, and the other props may be left out.
 */
export type HelpCenterCreateFormProps =
  HelpCenterCreateFormLoadedProps | ({ loading: true } & Partial<Omit<HelpCenterCreateFormLoadedProps, 'loading'>>);

/**
 * The ticket form. ONE structure: while the session identity is read (`loading`) it is the SAME form in a loading
 * scope (its title, labels and footer copy real, each field and control its own loading form), announced once (an
 * outer scope has already said it); in a page's loading scope it draws the same way.
 */
export function HelpCenterCreateForm(props: HelpCenterCreateFormProps) {
  const scoped = useLoadingScope();
  if (props.loading || scoped) {
    return (
      <AnnouncedLoadingScope label="Loading the form" active className="contents">
        <HelpCenterCreateFormBody sessionName="" sessionEmail="" />
      </AnnouncedLoadingScope>
    );
  }
  return <HelpCenterCreateFormBody {...props} />;
}

function HelpCenterCreateFormBody({
  actions,
  sessionName,
  sessionEmail,
  supportSystemDown = false,
}: Omit<HelpCenterCreateFormLoadedProps, 'actions' | 'loading'> & {
  /** Absent in the loading form, where nothing submits. */
  actions?: UseTicketActionsReturn;
}) {
  const [subject, setSubject] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);

  // Subject input — slotted into `<ContactForm>`'s new `extraTopField`
  // position. Local state + error so the input behaves like the
  // schema-driven siblings.
  const subjectField = (
    <div className="flex flex-col">
      <Label htmlFor="help-center-subject">
        Subject
        <RequiredMark />
      </Label>
      <Input
        id="help-center-subject"
        type="text"
        value={subject}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setSubject(e.target.value);
          if (subjectError) setSubjectError(null);
        }}
        placeholder="Briefly describe what's going on"
        maxLength={SUBJECT_MAX_CHARS}
        aria-invalid={!!subjectError}
        aria-required
        aria-describedby={subjectError ? 'help-center-subject-error' : undefined}
        disabled={supportSystemDown}
        className="h-12 border-ods-border bg-ods-card px-3 text-ods-text-primary placeholder-ods-text-secondary"
      />
      {subjectError && (
        <span id="help-center-subject-error" className="mt-1 text-ods-error text-h6">
          {subjectError}
        </span>
      )}
    </div>
  );

  return (
    <ContactForm
      // A signed-in support ticket, not a lead: nothing to rescue.
      rescue={null}
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
        const trimmedSubject = subject.trim();
        if (!trimmedSubject) {
          setSubjectError('Subject is required');
          // Throw so `<ContactForm>`'s catch path doesn't `reset()` —
          // user keeps their typed message body and just adds a subject.
          throw new Error('SUBJECT_REQUIRED');
        }
        setSubjectError(null);
        if (!actions) throw new Error('TICKET_FORM_LOADING');
        const ok = await actions.submitTicket({
          subject: trimmedSubject,
          content: data.message,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
        if (ok) {
          setSubject('');
        } else {
          // Same as above — keep inputs for retry. The toast is already
          // surfaced by `useTicketActions`.
          throw new Error('TICKET_SUBMIT_FAILED');
        }
      }}
    />
  );
}
