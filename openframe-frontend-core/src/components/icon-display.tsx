'use client';

import type { ReactElement } from 'react';
import Image from '../embed-shims/next-image';
import { useAgentIdentityIcon } from './agent-identity';
import { AgentMark, type AgentName } from './agent-mark';
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

const BRAND_MARK_NAMES = new Set<string>(['fae', 'mingo']);

/**
 * THE single icon-display path for the whole app. Resolution order:
 *   1. `url` → uploaded image
 *   2. `name` = an agent's slug → that agent's identity icon when the host provides
 *      it (`AgentIdentityProvider`), else its packaged `AgentMark` (fae, mingo)
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
  // An agent named by its slug is drawn from its identity, when the host provides it
  // (`AgentIdentityProvider`): its uploaded picture wins over the packaged mark.
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
  if (icon?.name && BRAND_MARK_NAMES.has(icon.name)) {
    // Size via `className` when provided (so responsive Tailwind sizing like
    // `w-6 content-md:w-8` works); fall back to a fixed `size` px box ONLY when no
    // className is given — an inline `style` would otherwise override the class.
    return (
      <span
        className={`inline-flex${className ? ` ${className}` : ''}`}
        style={className ? undefined : { width: size, height: size }}
      >
        <AgentMark agent={icon.name as AgentName} className="h-full w-full" />
      </span>
    );
  }
  const Glyph = resolveIcon(icon?.name ?? undefined);
  return <Glyph size={size} className={className} {...(icon?.props ?? {})} />;
}
