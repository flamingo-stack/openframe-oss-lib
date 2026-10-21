'use client';

/**
 * DesignDocCard (pure presentation) — a design doc as the entity card every surface shows it with: the full card
 * (`default`, the `RoadmapCard` layout without its image slot, since a doc has no image of its own and a constant glyph
 * says nothing: title, DRI and date, readiness (the hub's own wording, `design-doc-readiness`), summary, sign-off caption and the people) for admin surfaces, and the chat's compact card (`DesignDocChatCard` in `dispatch.tsx`, which reads
 * the same readiness and meta). The card writes no click logic beyond its `href` anchor.
 */

import Link from '../../../embed-shims/next-link';
import { TEXT_LINES_MIN } from '../../../styles/component-sizes';
import type { DesignDoc } from '../../../types/design-doc';
import { cn } from '../../../utils/cn';
import { formatDateShort } from '../../../utils/date-formatters';
import {
  DESIGN_DOC_READINESS_DISPLAY,
  designDocReadiness,
  formatCompletionLabelWithBlockers,
} from '../../../utils/design-doc-readiness';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { AvatarStack, type AvatarStackPerson } from '../../ui/avatar-stack';
import { useLoadingScope } from '../../ui/loading-scope';
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

// The card's boxes, read by the card AND its skeleton, so the two are one size at every width.
const DESIGN_DOC_CARD_BODY = 'flex h-full flex-col gap-[var(--spacing-system-mf)] p-[var(--spacing-system-lf)]';
const DESIGN_DOC_CARD_HEADER = 'flex w-full items-center gap-[16px]';
const DESIGN_DOC_CARD_HEADING = 'flex min-w-0 flex-1 flex-col';
/** Two `text-h3` lines. */
const DESIGN_DOC_CARD_TITLE_ROW = `flex items-center text-h3 ${TEXT_LINES_MIN[2]}`;
const DESIGN_DOC_CARD_META_ROW = `flex items-center text-h5 ${TEXT_LINES_MIN[1]}`;
/** Three `text-h4` lines. */
const DESIGN_DOC_CARD_SUMMARY_ROW = `flex items-center text-h4 ${TEXT_LINES_MIN[3]}`;
const DESIGN_DOC_CARD_FOOTER = 'flex w-full items-center justify-between gap-2';

/**
 * The card while it is read, in the card's own boxes: the title as two `text-h3` lines, the meta as a `text-h5`
 * line, the readiness badge's box (beside the title from md, its own row below), the summary as three `text-h4` lines,
 * the sign-off caption as a `text-h6` line and the people as a 24px avatar.
 */
export function DesignDocCardSkeleton({ className }: { className?: string } = {}) {
  return (
    <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, DESIGN_DOC_CARD_BODY, className)} aria-hidden>
      <div className={DESIGN_DOC_CARD_HEADER}>
        <div className={DESIGN_DOC_CARD_HEADING}>
          <div className={DESIGN_DOC_CARD_TITLE_ROW}>
            <TextLineSkeleton type="h3" lines={2} className="w-3/4" />
          </div>
          <div className={DESIGN_DOC_CARD_META_ROW}>
            <TextLineSkeleton type="h5" className="w-1/3" />
          </div>
        </div>
        <StatusBadge loading text="" variant="button" className="hidden md:inline-flex" />
      </div>
      <div className="md:hidden">
        <StatusBadge loading text="" variant="button" />
      </div>
      <div className={DESIGN_DOC_CARD_SUMMARY_ROW}>
        <TextLineSkeleton type="h4" lines={3} className="w-full" />
      </div>
      <div className="flex-1" />
      <div className={DESIGN_DOC_CARD_FOOTER}>
        <TextLineSkeleton type="h6" className="w-1/3" />
        <AvatarStack loading people={[]} max={1} size="xs" className="shrink-0" />
      </div>
    </div>
  );
}

export function DesignDocCard({ doc, href, target, rel, className }: DesignDocCardProps) {
  const readiness = DESIGN_DOC_READINESS_DISPLAY[designDocReadiness(doc.completion)];
  const people = designDocPeople(doc);
  const link = safeHref(href ?? null);
  if (useLoadingScope()) return <DesignDocCardSkeleton className={className} />;
  const body = (
    <>
      <div className={DESIGN_DOC_CARD_HEADER}>
        <div className={DESIGN_DOC_CARD_HEADING}>
          <div className={DESIGN_DOC_CARD_TITLE_ROW}>
            <h3 className="line-clamp-2 flex-1 text-ods-text-primary text-h3">{doc.title || 'Untitled design doc'}</h3>
          </div>
          <div className={DESIGN_DOC_CARD_META_ROW}>
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
      <div className={DESIGN_DOC_CARD_SUMMARY_ROW}>
        <p className="line-clamp-3 text-ods-text-secondary text-h4">{doc.summary || ''}</p>
      </div>
      <div className="flex-1" />
      <div className={DESIGN_DOC_CARD_FOOTER}>
        <span className="truncate text-ods-text-secondary text-h6">
          {formatCompletionLabelWithBlockers(doc.completion)}
        </span>
        {people.length > 0 ? <AvatarStack size="xs" people={people} className="shrink-0" /> : null}
      </div>
    </>
  );
  const outer = cn(CONTENT_CARD_FRAME_CLASS, DESIGN_DOC_CARD_BODY, className);
  return link ? (
    <Link href={link} target={target} rel={rel} className={outer}>
      {body}
    </Link>
  ) : (
    <div className={outer}>{body}</div>
  );
}
