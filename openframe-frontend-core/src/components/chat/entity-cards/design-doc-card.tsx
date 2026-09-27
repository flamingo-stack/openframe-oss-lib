'use client';

/**
 * DesignDocCard (pure presentation) — a design doc as the entity card every surface shows it with: the full card
 * (`default`, the `RoadmapCard` layout: glyph slot, title, DRI and date, sign-off status, summary, sign-off count and
 * the people) for admin surfaces, and the chat's compact card (`DesignDocChatCard` in `dispatch.tsx`, which reads
 * the same status and meta through the helpers below). The card writes no click logic beyond its `href` anchor.
 */

import type { DesignDoc, DesignDocCompletion } from '../../../types/design-doc';
import { formatDateShort } from '../../../utils/date-formatters';
import { FileContentIcon } from '../../icons-v2-generated/documents/file-content-icon';
import { AvatarStack, type AvatarStackPerson } from '../../ui/avatar-stack';
import { StatusBadge, type StatusBadgeProps } from '../../ui/status-badge';
import { safeHref } from '../utils/compact-card-classes';

/** A doc's sign-off state: ready (every section signed off), blocked (an open blocking comment or a blocked section), else in review. */
export function designDocSignOffStatus(completion: DesignDocCompletion): {
  label: string;
  scheme: NonNullable<StatusBadgeProps['colorScheme']>;
  tag: 'success' | 'error' | 'warning';
} {
  if (completion.isComplete) return { label: 'Ready', scheme: 'success', tag: 'success' };
  if (completion.openBlocking > 0 || completion.blocked > 0) return { label: 'Blocked', scheme: 'error', tag: 'error' };
  return { label: 'In review', scheme: 'warning', tag: 'warning' };
}

/** "3/4 reviews signed off" — the count the design-docs screen prints. */
export function designDocSignOffLabel(completion: DesignDocCompletion): string {
  return `${completion.completed}/${completion.total} review${completion.total === 1 ? '' : 's'} signed off`;
}

/** The people behind a doc: the DRI first, then the implementation owners (display only). */
export function designDocPeople(doc: Pick<DesignDoc, 'author' | 'feature_leads'>): AvatarStackPerson[] {
  const people: AvatarStackPerson[] = [];
  if (doc.author?.full_name)
    people.push({
      key: `dri-${doc.author.id ?? doc.author.full_name}`,
      name: doc.author.full_name,
      avatarUrl: doc.author.avatar_url,
    });
  for (const p of doc.feature_leads ?? []) {
    if (!p.full_name) continue;
    people.push({ key: `lead-${p.id}`, name: p.full_name, avatarUrl: p.avatar_url });
  }
  return people;
}

/** "DRI Jane Doe · updated Sep 24, 2026" — the card's subtitle. */
export function designDocMetaLine(doc: Pick<DesignDoc, 'author' | 'updated_at'>): string {
  return [doc.author?.full_name ? `DRI ${doc.author.full_name}` : null, `updated ${formatDateShort(doc.updated_at)}`]
    .filter(Boolean)
    .join(' · ');
}

export interface DesignDocCardProps {
  doc: DesignDoc;
  /** The doc's page. */
  href?: string | null;
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  className?: string;
}

export function DesignDocCardSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col gap-[16px] rounded-[6px] border border-ods-border bg-ods-card p-[24px]">
      <div className="flex items-center gap-[16px]">
        <div className="h-16 w-16 rounded-lg bg-ods-bg" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-5 w-3/4 rounded bg-ods-bg" />
          <div className="h-4 w-1/3 rounded bg-ods-bg/70" />
        </div>
      </div>
      <div className="h-4 w-full rounded bg-ods-bg/60" />
      <div className="h-4 w-5/6 rounded bg-ods-bg/60" />
    </div>
  );
}

export function DesignDocCard({ doc, href, target, rel, className }: DesignDocCardProps) {
  const status = designDocSignOffStatus(doc.completion);
  const people = designDocPeople(doc);
  const link = safeHref(href ?? null);
  const body = (
    <>
      <div className="flex w-full items-center gap-[16px]">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-bg text-ods-accent">
          <FileContentIcon size={32} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[48px] items-center">
            <h3 className="line-clamp-2 flex-1 text-ods-text-primary text-h3">{doc.title || 'Untitled design doc'}</h3>
          </div>
          <div className="flex min-h-[20px] items-center">
            <p className="truncate text-ods-text-secondary text-h5">{designDocMetaLine(doc)}</p>
          </div>
        </div>
        <StatusBadge
          text={status.label.toUpperCase()}
          colorScheme={status.scheme}
          className="hidden border border-ods-border md:inline-flex"
        />
      </div>
      <div className="md:hidden">
        <StatusBadge
          text={status.label.toUpperCase()}
          colorScheme={status.scheme}
          className="border border-ods-border"
        />
      </div>
      <div className="flex min-h-[72px] items-center">
        <p className="line-clamp-3 text-ods-text-secondary text-h4">{doc.summary || ''}</p>
      </div>
      <div className="flex-1" />
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-ods-text-secondary text-h6">{designDocSignOffLabel(doc.completion)}</span>
        {people.length > 0 ? <AvatarStack size="xs" people={people} className="shrink-0" /> : null}
      </div>
    </>
  );
  const outer = `flex h-full flex-col gap-[16px] rounded-[6px] border border-ods-border bg-ods-card p-[24px] transition-all hover:border-ods-accent ${className ?? ''}`;
  return link ? (
    <a href={link} target={target} rel={rel} className={outer}>
      {body}
    </a>
  ) : (
    <div className={outer}>{body}</div>
  );
}
