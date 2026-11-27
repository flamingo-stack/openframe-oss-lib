'use client';

import { useState } from 'react';
import type { ChatEmailAddress, ChatEmailEnvelope } from '../../chat-protocol/chat-message';
import { cn } from '../../utils/cn';
import { EmailIcon } from '../icons-v2-generated';
import { TouchFriendlyTooltip } from '../ui/touch-friendly-tooltip';

const addressOf = (entry: ChatEmailAddress): string => entry.address;

/** How a reply stands at the provider, when there is anything to say: a delivered one and an inbound email say nothing. */
function deliveryLineOf(email: ChatEmailEnvelope): string | null {
  if (email.deliveryState === 'SENDING') return 'Sending…';
  if (email.deliveryState === 'FAILED') {
    return email.deliveryFailureReason ? `Not delivered: ${email.deliveryFailureReason}` : 'Not delivered';
  }
  return null;
}

interface EmailMessageCardProps {
  email: ChatEmailEnvelope;
  /** The email's body, its quotes stripped: plain text, as the email had it. */
  body: string;
  /** The viewer's own side of the thread (the right), else the other person's (the left). */
  self: boolean;
}

/**
 * A message that is an email (Figma tickets 9427-75851): a card whose bar says who it went from and to and how many were
 * copied, over the body as plain text. The quoted thread and the signature are folded under the body.
 */
export function EmailMessageCard({ email, body, self }: EmailMessageCardProps) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const to = email.to.map(addressOf).join(', ');
  const cc = email.cc.map(addressOf).join(', ');
  const ccCount = `+${email.cc.length} in CC`;
  const delivery = deliveryLineOf(email);
  return (
    <div className={cn('flex min-w-0', self ? 'justify-end' : 'justify-start')} data-testid="chat-email-message">
      <div className="min-w-0 max-w-[95%] overflow-hidden rounded-xl border border-ods-border bg-ods-card">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)] border-b border-ods-border px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)] text-h6">
          <EmailIcon size={16} className="shrink-0 text-ods-text-secondary" aria-hidden />
          {/* The sender stays whole while it can (Figma tickets 8036-36714): the recipients give way first. */}
          <span className="min-w-0 max-w-[60%] shrink-0 truncate text-ods-text-primary" title={email.from?.address}>
            {email.from?.address ?? ''}
          </span>
          {to && (
            <>
              <span className="shrink-0 text-ods-text-secondary">to</span>
              <span className="min-w-0 truncate text-ods-text-primary" title={to}>
                {to}
              </span>
            </>
          )}
          {cc && (
            // Who was copied opens on hover, keyboard focus and tap alike; the button also names them to a screen reader.
            <TouchFriendlyTooltip content={cc} side="top">
              <button
                type="button"
                aria-label={`${ccCount}: ${cc}`}
                className="shrink-0 cursor-default rounded-sm text-ods-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
              >
                {ccCount}
              </button>
            </TouchFriendlyTooltip>
          )}
          {email.automatic && <span className="ml-auto shrink-0 text-ods-text-secondary">Automatic reply</span>}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-sf)] py-[var(--spacing-system-sf)]">
          {body.trim() !== '' && (
            <p className="whitespace-pre-wrap break-words text-ods-text-primary text-h4">{body.trim()}</p>
          )}
          {email.quotedText && (
            <div className="grid min-w-0 grid-cols-1 gap-[var(--spacing-system-xsf)]">
              <button
                type="button"
                className="justify-self-start text-ods-text-secondary underline-offset-2 text-h6 hover:underline"
                aria-expanded={quoteOpen}
                onClick={() => setQuoteOpen(open => !open)}
              >
                {quoteOpen ? 'Hide quoted text' : 'Show quoted text'}
              </button>
              {quoteOpen && (
                <p className="whitespace-pre-wrap break-words border-l-2 border-ods-border pl-[var(--spacing-system-sf)] text-ods-text-secondary text-h6">
                  {email.quotedText.trim()}
                </p>
              )}
            </div>
          )}
          {delivery && (
            <p
              className={cn('text-h6', email.deliveryState === 'FAILED' ? 'text-ods-error' : 'text-ods-text-secondary')}
            >
              {delivery}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
