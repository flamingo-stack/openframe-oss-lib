'use client';

import { createElement } from 'react';

import { FAE_AVATAR_DATA_URI } from '../assets/fae-avatar';
import { useAgentIdentityIcon } from './agent-identity';
import { resolveIcon } from './chat/utils/icon-library';
import { MingoIcon, type MingoIconProps } from './icons/mingo-icon';

export type AgentName = 'fae' | 'mingo';

export interface AgentMarkProps extends Pick<MingoIconProps, 'color' | 'eyesColor' | 'outerColor' | 'cornerColor'> {
  /** Which AI agent's mark to render. */
  agent: AgentName;
  /** Sizing/positioning classes applied to the mark (e.g. `w-5 h-5`). */
  className?: string;
  /** Override Fae's packaged avatar. The agent's identity icon, when the host provides one, still wins. */
  faeAvatarSrc?: string;
}

/**
 * Unified Fae/Mingo agent mark — the ONE place that knows how each agent is drawn.
 *
 * The mark is the icon the agent's IDENTITY holds, when the host provides the
 * identities (`AgentIdentityProvider`): an uploaded picture, or a library glyph
 * it names. Only with no identity icon does the agent's packaged mark answer:
 * Mingo's vector (tinted by the colour props), Fae's avatar. Just the glyph —
 * the caller sizes/boxes it. Decorative in every form.
 */
export function AgentMark({
  agent,
  className = '',
  faeAvatarSrc = FAE_AVATAR_DATA_URI,
  ...mingoColors
}: AgentMarkProps) {
  const identity = useAgentIdentityIcon(agent);
  if (identity?.url) {
    return <img src={identity.url} alt="" className={className} loading="lazy" decoding="async" />;
  }
  // The identity names a library glyph of its own (not this agent's packaged mark).
  if (identity?.name && identity.name !== agent) {
    const glyphProps: Record<string, unknown> = { className, 'aria-hidden': true, ...(identity.props ?? {}) };
    return createElement(resolveIcon(identity.name), glyphProps);
  }
  return agent === 'mingo' ? (
    <MingoIcon className={className} aria-hidden="true" focusable="false" {...mingoColors} />
  ) : (
    <img src={faeAvatarSrc} alt="" className={className} />
  );
}
