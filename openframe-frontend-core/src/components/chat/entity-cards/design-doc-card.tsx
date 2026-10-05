'use client';

/**
 * DesignDocCard (pure presentation) — a design doc as the entity card every surface shows it with: the full card
 * (`default`, the `RoadmapCard` layout without its image slot, since a doc has no image of its own and a constant glyph
 * says nothing: title, DRI and date, readiness (the hub's own wording, `design-doc-readiness`), summary, sign-off caption and the people) for admin surfaces, and the chat's compact card (`DesignDocChatCard` in `dispatch.tsx`, which reads
 * the same readiness and meta). The card writes no click logic beyond its `href` anchor.
 */

import type { DesignDoc } from '../../../types/design-doc';
import { cn } from '../../../utils/cn';
import { formatDateShort } from '../../../utils/date-formatters';
import {
  DESIGN_DOC_READINESS_DISPLAY,
  designDocReadiness,
  formatCompletionLabelWithBlockers,
} from '../../../utils/design-doc-readiness';
import { InteractiveSkeleton, MediaSkeleton, TextSkeleton } from '../../loading/unified-skeleton';
import { AvatarStack, type AvatarStackPerson } from '../../ui/avatar-stack';
import { StatusBadge } from '../../ui/status-badge';
import { safeHref } from '../utils/compact-card-classes';
import { CONTENT_CARD_FRAME_CLASS, CONTENT_CARD_SKELETON_FRAME_CLASS } from './content-card-frame';

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

/** The card's loading state, built from the unified skeleton primitives inside the card's own frame. */
export function DesignDocCardSkeleton() {
  return (
    <div
      className={cn(
        CONTENT_CARD_SKELETON_FRAME_CLASS,
        'flex h-full flex-col gap-[var(--spacing-system-mf)] p-[var(--spacing-system-lf)]',
      )}
      role="status"
      aria-label="Loading design doc"
    >
      <div className="flex w-full items-center gap-[16px]">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <TextSkeleton.Subheading className="w-3/4" />
          <TextSkeleton.Caption className="w-1/3" />
        </div>
        <InteractiveSkeleton.Chip className="hidden w-24 md:block" />
      </div>
      <div className="flex min-h-[72px] flex-col justify-center gap-2">
        <TextSkeleton.Body />
        <TextSkeleton.Body />
        <TextSkeleton.Body className="w-5/6" />
      </div>
      <div className="flex-1" />
      <div className="flex w-full items-center justify-between gap-2">
        <TextSkeleton.Caption className="w-1/3" />
        <MediaSkeleton.Avatar size="sm" />
      </div>
    </div>
  );
}

export function DesignDocCard({ doc, href, target, rel, className }: DesignDocCardProps) {
  const readiness = DESIGN_DOC_READINESS_DISPLAY[designDocReadiness(doc.completion)];
  const people = designDocPeople(doc);
  const link = safeHref(href ?? null);
  const body = (
    <>
      <div className="flex w-full items-center gap-[16px]">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[48px] items-center">
            <h3 className="line-clamp-2 flex-1 text-ods-text-primary text-h3">{doc.title || 'Untitled design doc'}</h3>
          </div>
          <div className="flex min-h-[20px] items-center">
            <p className="truncate text-ods-text-secondary text-h5">{designDocMetaLine(doc)}</p>
          </div>
        </div>
        <StatusBadge
          text={readiness.label}
          colorScheme={readiness.scheme}
          variant="button"
          singleLine
          className="hidden md:inline-flex"
        />
      </div>
      <div className="md:hidden">
        <StatusBadge text={readiness.label} colorScheme={readiness.scheme} variant="button" singleLine />
      </div>
      <div className="flex min-h-[72px] items-center">
        <p className="line-clamp-3 text-ods-text-secondary text-h4">{doc.summary || ''}</p>
      </div>
      <div className="flex-1" />
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-ods-text-secondary text-h6">
          {formatCompletionLabelWithBlockers(doc.completion)}
        </span>
        {people.length > 0 ? <AvatarStack size="xs" people={people} className="shrink-0" /> : null}
      </div>
    </>
  );
  const outer = cn(
    CONTENT_CARD_FRAME_CLASS,
    'flex h-full flex-col gap-[var(--spacing-system-mf)] p-[var(--spacing-system-lf)]',
    className,
  );
  return link ? (
    <a href={link} target={target} rel={rel} className={outer}>
      {body}
    </a>
  ) : (
    <div className={outer}>{body}</div>
  );
}
