'use client';

import { createElement } from 'react';

import Image from '../embed-shims/next-image';
import { cn } from '../utils/cn';
import { AGENT_GLYPH_COLOR, useAgentIdentityIcon } from './agent-identity';
import { resolveIcon } from './chat/utils/icon-library';

/** The agents the product ships. A mark is drawn for any agent slug the server has an identity for. */
export type AgentName = 'fae' | 'mingo';

export interface AgentMarkProps {
  /** The slug of the AI agent whose mark to draw. */
  agent: AgentName | (string & {});
  /** Sizing/positioning classes applied to the mark (e.g. `w-5 h-5`). */
  className?: string;
}

// A mark is at most 48px on screen; twice that covers dense screens.
const MARK_IMAGE_SIZES = '96px';

/**
 * An AI agent's mark: the icon its IDENTITY holds, and nothing else.
 *
 * An agent's picture is a record the product keeps (its identity: a name and an
 * icon), served to every host (`AgentIdentityProvider`). The mark is that icon:
 * an uploaded picture, or the library glyph the identity names, with the props
 * the identity gives it, in one colour wherever it sits (`AGENT_GLYPH_COLOR`). The library packages no picture of an agent, so an
 * agent the server names no icon for draws nothing: its box is kept empty, at
 * the size the caller gave it, so nothing around it moves while the identities
 * are on their way. Decorative in every form; the caller sizes and boxes it.
 */
export function AgentMark({ agent, className = '' }: AgentMarkProps) {
  const identity = useAgentIdentityIcon(agent);
  if (identity?.url) {
    return (
      <span aria-hidden="true" className={cn('relative inline-block overflow-hidden', className)}>
        <Image src={identity.url} alt="" fill sizes={MARK_IMAGE_SIZES} className="object-cover" />
      </span>
    );
  }
  if (identity?.name) {
    // The identity's glyph, drawn through `createElement`: it is the icon set's component, not one made here.
    return createElement(resolveIcon(identity.name), {
      className,
      'aria-hidden': true,
      color: AGENT_GLYPH_COLOR,
      ...(identity.props ?? {}),
    } as Record<string, unknown>);
  }
  return <span aria-hidden="true" className={className} />;
}
