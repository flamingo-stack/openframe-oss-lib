'use client';

/**
 * An inline box in the answer's text: the skin every chip a reader can click inside a chat sentence wears. The
 * host's entity mentions (`@device:<id>`, drawn by its `renderMention`) and the links the answer makes to a screen of
 * the app (`[Devices → Add Device](/devices/new)`) both use it, so a link to a place in the app reads as one at a
 * glance (CU-17tkuw61kfy: drawn as a plain link, it was the colour of the text around it).
 *
 * ONE component draws the box, `InlineChip`: the lib's `Tag` badge, rendered as a `<span>` (the chip sits inside
 * markdown's `<p>`, where a `<div>` is invalid), with the inline skin below. A host's chip (the frontend's
 * `MentionTag`, both its segments) draws `InlineChip` too, and adds only its own behaviour (link, new-tab segment).
 */

import type React from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { BrowserWindowIcon } from '../icons-v2-generated/coding/browser-window-icon';
import { Tag } from '../ui/tag';

/**
 * On top of `Tag`'s badge skin, for a chip in a line of text:
 * - `align-middle`: centred on the text line;
 * - `hover:border-ods-border`: no accent border on hover (the badge's default);
 * - `[&_svg]:size-4` and `[&_svg]:text-ods-text-secondary`: a 16px muted lead icon, the label in the primary colour.
 */
const INLINE_CHIP_CLASS =
  'max-w-[16rem] align-middle [&_svg]:size-4 [&_svg]:text-ods-text-secondary hover:border-ods-border';

/**
 * The inline box: an icon and a label in a chat sentence. `className` adds to the skin (a segment's square corner, a
 * hover fill); `loading` draws `Tag`'s own skeleton in the same box.
 */
export function InlineChip({
  icon,
  label,
  className,
  loading,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  className?: string;
  loading?: boolean;
}): React.ReactElement {
  return (
    <Tag
      as="span"
      variant="badge"
      icon={icon}
      label={label}
      loading={loading}
      className={cn(INLINE_CHIP_CLASS, className)}
    />
  );
}

/**
 * A link the answer marked as a screen of the app (`isAppScreenLink`, `chat-protocol/app-screen-link.ts`), drawn as an
 * inline box. `anchor` is the host's link element (its
 * `NavLinkAnchor`, so the click follows the host's routing rule), else the lib's boxed `Link`.
 */
export function InlineAppLinkChip({
  href,
  children,
  anchor: Anchor,
}: {
  href: string;
  children: React.ReactNode;
  anchor?: React.ComponentType<{ href: string; className?: string; children?: React.ReactNode }>;
}): React.ReactElement {
  const chip = <InlineChip icon={<BrowserWindowIcon />} label={children} className="hover:bg-ods-bg-hover" />;
  return Anchor ? (
    <Anchor href={href} className="no-underline">
      {chip}
    </Anchor>
  ) : (
    <Link href={href} className="no-underline">
      {chip}
    </Link>
  );
}
