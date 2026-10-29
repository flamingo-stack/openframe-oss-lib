'use client';

/**
 * A link in a chat answer's markdown, through the host's `NavLinkAnchor` exactly as every chat link is routed. What it
 * draws follows the navigation SSOT (`useNavLinkTarget`): a link that stays in the app is drawn as the inline box the
 * host's entity mentions use (`InlineChip`), any other as its plain label.
 */

import type React from 'react';
import { BrowserWindowIcon } from '../icons-v2-generated/coding/browser-window-icon';
import { InlineChip } from './inline-chip';
import { useNavLinkTarget } from './nav-link-anchor-via-runtime';
import type { NavLinkAnchorComponent } from './types/component.types';

export function ChatMarkdownLink({
  anchor: Anchor,
  href,
  children,
  ...anchorProps
}: {
  anchor: NavLinkAnchorComponent;
  href: string;
  className?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const { isNewTab } = useNavLinkTarget(href);
  return (
    <Anchor href={href} {...anchorProps}>
      {isNewTab ? children : <InlineChip icon={<BrowserWindowIcon />} label={children} />}
    </Anchor>
  );
}
