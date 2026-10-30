'use client';

/**
 * A link in a chat answer's markdown, through the host's `NavLinkAnchor` exactly as every chat link is routed. What it
 * draws follows the navigation decision (`navLinkTarget`): a link the runtime keeps in this window is a place in the
 * app, drawn as the inline box the host's entity mentions use (`InlineChip`); any other link (another site, a hub page
 * from an embedded chat, a `mailto:`), and any link outside a chat runtime, stays a plain link.
 */

import type React from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { BrowserWindowIcon } from '../icons-v2-generated/coding/browser-window-icon';
import { InlineChip } from './inline-chip';
import type { NavLinkAnchorComponent } from './types/component.types';
import { navLinkTarget } from './utils/nav-anchor-props';

export function ChatMarkdownLink({
  anchor: Anchor,
  href,
  className,
  children,
  ...anchorProps
}: {
  anchor: NavLinkAnchorComponent;
  href: string;
  className?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const runtime = useChatRuntime();
  if (!runtime || navLinkTarget(runtime, href).isNewTab) {
    return (
      <Anchor href={href} className={className} {...anchorProps}>
        {children}
      </Anchor>
    );
  }
  return (
    <Anchor href={href} {...anchorProps} className="no-underline">
      <InlineChip icon={<BrowserWindowIcon />} label={children} className="hover:bg-ods-bg-hover" />
    </Anchor>
  );
}
