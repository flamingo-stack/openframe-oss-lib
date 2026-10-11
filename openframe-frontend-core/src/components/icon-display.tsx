'use client';

import type { ReactElement } from 'react';
import Image from '../embed-shims/next-image';
import { useAgentIdentityIcon } from './agent-identity';
import { resolveIcon } from './chat/utils/icon-library';

/** Unified icon value used across the app (announcement bar, chat quick actions,
 *  AI-agent identity). Exactly one of `name`/`url` is typically set. */
export interface EntityIconValue {
  /** Library glyph name resolved via {@link resolveIcon} (icons-v2 + curated aliases). */
  name?: string | null;
  /** Uploaded image URL — wins over `name`. */
  url?: string | null;
  /** Props spread onto the resolved glyph (e.g. `{ color }`). */
  props?: Record<string, unknown> | null;
}

/**
 * THE single icon-display path for the whole app. Resolution order:
 *   1. `url` → uploaded image
 *   2. `name` = an agent's slug → that agent's identity icon (`AgentIdentityProvider`):
 *      its picture, or the glyph its identity names
 *   3. `name` → library glyph via `resolveIcon` (+ `props`)
 *
 * Replaces the old per-surface logic (the announcement bar's `renderSvgIcon`
 * map and the chat's ad-hoc `resolveIcon` calls) so every surface renders an
 * icon identically.
 */
export function EntityIcon({
  icon,
  size = 20,
  className,
}: {
  icon?: EntityIconValue | null;
  size?: number;
  className?: string;
}): ReactElement {
  // An agent named by its slug is drawn from its identity (`AgentIdentityProvider`):
  // its uploaded picture, or the glyph the identity names with the identity's props.
  const identity = useAgentIdentityIcon(icon?.url ? null : icon?.name);
  const url = icon?.url ?? identity?.url;
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain' }}
        unoptimized
      />
    );
  }
  const Glyph = resolveIcon(identity?.name ?? icon?.name ?? undefined);
  return <Glyph size={size} className={className} {...(identity?.props ?? {})} {...(icon?.props ?? {})} />;
}
