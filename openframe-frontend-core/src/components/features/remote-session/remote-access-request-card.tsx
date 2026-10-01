'use client';

import { ExternalLinkIcon, InfoCircleIcon } from '../../icons-v2-generated';
import { Button } from '../../ui/button/button';
import { RemoteSessionOrgLogo } from './remote-session-parts';
import type { RemoteAccessDecision, RemoteSessionParty } from './types';

export interface RemoteAccessRequestCardProps {
  party: RemoteSessionParty;
  /** The notice that the session will be recorded. */
  showRecordingNotice?: boolean;
  /** The decision in flight, if any; both buttons lock while it is set. */
  deciding?: RemoteAccessDecision | null;
  /** Replaces the "you can end the session" line, e.g. when the decision could not be sent. */
  error?: string | null;
  onDecide: (decision: RemoteAccessDecision) => void;
  /**
   * Opens the organization's site. The button only shows for an https URL:
   * the URL comes from the server, so no other scheme is ever handed out.
   */
  onOpenSite?: (url: string) => void;
}

/** `https://www.techflow.com/` -> `www.techflow.com`. */
function displaySiteUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** The end user's consent dialog for a remote access request: who is asking, what they get, Decline / Allow Access. */
export function RemoteAccessRequestCard({
  party,
  showRecordingNotice = false,
  deciding = null,
  error,
  onDecide,
  onOpenSite,
}: RemoteAccessRequestCardProps) {
  const { organizationName } = party;
  const siteUrl = party.organizationSiteUrl ?? undefined;
  const openableSite = siteUrl?.startsWith('https://') ? siteUrl : undefined;

  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
      <h1 className="w-full text-ods-text-primary text-h2">Your IT support team is requesting remote access</h1>

      <div className="flex w-full items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]">
        <RemoteSessionOrgLogo name={organizationName} logoUrl={party.organizationLogoUrl} sizePx={64} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="w-full truncate text-ods-text-primary text-h3">{organizationName}</p>
          {siteUrl && <p className="w-full truncate text-ods-text-secondary text-h4">{displaySiteUrl(siteUrl)}</p>}
        </div>
        {openableSite && onOpenSite && (
          <Button variant="outline" size="icon" aria-label="Open website" onClick={() => onOpenSite(openableSite)}>
            <ExternalLinkIcon size={24} color="currentColor" />
          </Button>
        )}
      </div>

      <p className="w-full text-ods-text-primary text-h4">
        A technician from <span className="text-ods-accent">{organizationName}</span> will be able to view your screen
        and control your mouse and keyboard during this session.
      </p>

      <div className="flex w-full flex-col gap-[var(--spacing-system-xs)]">
        {showRecordingNotice && (
          <div className="flex w-full items-center gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-s)]">
            <InfoCircleIcon size={24} color="currentColor" className="shrink-0 text-ods-accent" />
            <p className="min-w-0 flex-1 text-ods-text-primary text-h6">
              This session will be recorded and available upon request.
            </p>
          </div>
        )}
        {error ? (
          <p className="w-full text-ods-text-primary text-h6">{error}</p>
        ) : (
          <p className="w-full text-ods-text-secondary text-h6">You can end the session at any time.</p>
        )}
      </div>

      <div className="flex w-full items-stretch gap-[var(--spacing-system-l)]">
        <Button
          variant="outline"
          fullWidth
          loading={deciding === 'DENIED'}
          disabled={deciding !== null}
          onClick={() => onDecide('DENIED')}
        >
          Decline
        </Button>
        <Button
          variant="accent"
          fullWidth
          loading={deciding === 'APPROVED'}
          disabled={deciding !== null}
          onClick={() => onDecide('APPROVED')}
        >
          Allow Access
        </Button>
      </div>
    </div>
  );
}
