'use client';

import { createElement } from 'react';

import Image from '../embed-shims/next-image';
import { cn } from '../utils/cn';
import { AGENT_GLYPH_COLOR, AGENT_PICTURE_CLASS, useAgentIdentityIcon } from './agent-identity';
import { resolveIcon } from './chat/utils/icon-library';

/** The agents the product ships. A mark is drawn for any agent slug the server has an identity for. */
export type AgentName = 'fae' | 'mingo';

export interface AgentMarkProps {
  /** The slug of the AI agent whose mark to draw. */
  agent: AgentName | (string & {});
  /** Sizing/positioning classes applied to the mark (e.g. `w-5 h-5`). */
  className?: string;
  /**
   * The colour of the mark when it is a GLYPH, for a mark that sits in a row of icons and must
   * match them (`currentColor` takes the row's text colour). Omitted, the glyph is the theme's
   * text colour everywhere. A colour the identity itself names still wins; a picture ignores it.
   */
  color?: string;
}

// A mark is at most 48px on screen; twice that covers dense screens.
const MARK_IMAGE_SIZES = '96px';

/**
 * An AI agent's mark: the icon its IDENTITY holds, and nothing else.
 *
 * An agent's picture is a record the product keeps (its identity: a name and an
 * icon), served to every host (`AgentIdentityProvider`). The mark is that icon:
 * an uploaded picture (a square file, cropped to a circle here), or the library glyph the identity names, with the props
 * the identity gives it, in one colour wherever it sits (`AGENT_GLYPH_COLOR`). The library packages no picture of an agent, so an
 * agent the server names no icon for draws nothing: its box is kept empty, at
 * the size the caller gave it, so nothing around it moves while the identities
 * are on their way. Decorative in every form; the caller sizes and boxes it.
 */
export function AgentMark({ agent, className = '', color = AGENT_GLYPH_COLOR }: AgentMarkProps) {
  const identity = useAgentIdentityIcon(agent);
  if (identity?.url) {
    return (
      <span aria-hidden="true" className={cn('relative inline-block overflow-hidden rounded-full', className)}>
        <Image src={identity.url} alt="" fill sizes={MARK_IMAGE_SIZES} className={AGENT_PICTURE_CLASS} />
      </span>
    );
  }
  if (identity?.name) {
    // The identity's glyph, drawn through `createElement`: it is the icon set's component, not one made here.
    return createElement(resolveIcon(identity.name), {
      className,
      'aria-hidden': true,
      color,
      ...(identity.props ?? {}),
    } as Record<string, unknown>);
  }
  return <span aria-hidden="true" className={className} />;
}

export interface AgentAvatarProps {
  /** The slug of the AI agent to picture. */
  agent: AgentName | (string & {});
  /** The avatar's width and height, in pixels. */
  size: number;
  className?: string;
}

/**
 * THE picture of an AI agent wherever a page shows one speaking, acting or
 * named: the agent's mark (`AgentMark`, its identity's icon) in a round frame of
 * a given size. The twin of a person's avatar. A caller names the agent by its
 * slug and never a picture, so an agent looks the same in a card, a log row, a
 * command bar and an example, and a new icon in its identity reaches all of them.
 */
export function AgentAvatar({ agent, size, className }: AgentAvatarProps) {
  return (
    <span
      className={cn('inline-flex shrink-0 overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <AgentMark agent={agent} className="h-full w-full" />
    </span>
  );
}
