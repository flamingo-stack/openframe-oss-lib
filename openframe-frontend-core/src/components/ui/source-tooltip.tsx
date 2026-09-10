'use client';

import { ExternalLink, Info } from 'lucide-react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Button } from './button';
import { FloatingTooltip } from './floating-tooltip';

/**
 * Source-reference tooltip — a (i) info icon whose tooltip lists every source
 * behind a cited figure as a Button link row (value · short label,
 * external-link glyph) with an optional "where it lives in the research" line
 * under it. Rows are clickable because the FloatingTooltip's safePolygon
 * keeps it open while the pointer travels into the content; the (i) itself
 * opens the first source so the click-the-icon habit still works.
 *
 * The trigger renders inline (`as="span"`) — a source (i) always sits inside
 * a line of text (a statement's last line, a money tail, a value line).
 * Hosts style the icon via `iconClassName`; the tooltip CONTENT is
 * self-contained ODS styling (it portals to <body>, outside any host-scoped
 * CSS variables).
 */

export interface SourceRef {
  /** The figure this source backs, e.g. "$121.2B" — leads the button label. */
  value: string;
  /** Short source name after the value (buttons are nowrap — keep it tight). */
  label: string;
  /** Exactly where the number lives in the research (report · table/figure ·
   *  column) — "click the link and can't find the number" is a credibility
   *  bug. Rendered as a fine-print line under the button. */
  where?: string;
  href: string;
}

export interface SourceTooltipProps {
  /** One-line setup above the source rows (e.g. how the figures add up). */
  intro?: ReactNode;
  sources: SourceRef[];
  /** Fine print under the rows (e.g. what the cited segment covers). */
  note?: ReactNode;
  /** Classes for the trigger's <Info> icon (size/color live with the host). */
  iconClassName?: string;
  /** Extra attributes for the trigger anchor — e.g. a host's click-intercept
   *  opt-out vocabulary like the deck's `data-no-nav`. */
  triggerAnchorProps?: AnchorHTMLAttributes<HTMLAnchorElement> & {
    [k: `data-${string}`]: string | boolean | undefined;
  };
}

export function SourceTooltip({ intro, sources, note, iconClassName, triggerAnchorProps }: SourceTooltipProps) {
  return (
    <FloatingTooltip
      as="span"
      side="top"
      delayDuration={0}
      className="max-w-sm"
      content={
        <span className="flex flex-col gap-2 py-0.5">
          {intro && <span className="font-semibold text-ods-text-primary">{intro}</span>}
          {sources.map(s => (
            <span key={s.href} className="flex flex-col gap-1">
              <Button
                variant="outline"
                size="compact"
                fullWidth
                linkProps={{ href: s.href, target: '_blank', rel: 'noopener noreferrer' }}
                rightIcon={<ExternalLink />}
              >
                {s.value} · {s.label}
              </Button>
              {s.where && <span className="text-ods-text-secondary">{s.where}</span>}
            </span>
          ))}
          {note && <span className="text-ods-text-secondary">{note}</span>}
        </span>
      }
    >
      <a href={sources[0].href} target="_blank" rel="noreferrer" aria-label="Source research" {...triggerAnchorProps}>
        <Info className={iconClassName} />
      </a>
    </FloatingTooltip>
  );
}
