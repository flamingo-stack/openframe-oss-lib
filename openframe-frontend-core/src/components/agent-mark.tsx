import { MingoIcon } from './icons';

export type AgentName = 'fae' | 'mingo';

export interface AgentMarkProps {
  /** Which AI agent's mark to render. */
  agent: AgentName;
  /** Sizing/positioning classes applied to the mark (e.g. `w-5 h-5`). */
  className?: string;
  /** Fae has no vector icon — its avatar IS its mark. Override the source if the
   *  consumer hosts the asset elsewhere; defaults to the conventional hub path. */
  faeAvatarSrc?: string;
}

/**
 * Unified Fae/Mingo agent mark — the ONE place that knows how each of the two
 * agents is drawn: Mingo renders its vector `MingoIcon`; Fae has no vector, so it
 * renders its avatar image. Just the glyph — the caller sizes/boxes it (Fae's photo
 * usually wants a chip background to read on dark surfaces). Pick the agent; the
 * rest is shared so neither mark is hand-rolled per surface again.
 */
export function AgentMark({ agent, className = '', faeAvatarSrc = '/assets/flamingo/fae-avatar.png' }: AgentMarkProps) {
  return agent === 'mingo'
    ? <MingoIcon className={className} />
    : <img src={faeAvatarSrc} alt="" className={className} />;
}
