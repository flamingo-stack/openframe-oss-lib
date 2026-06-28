import { MingoIcon } from './icons';
import { FAE_AVATAR_DATA_URI } from '../assets/fae-avatar';

export type AgentName = 'fae' | 'mingo';

export interface AgentMarkProps {
  /** Which AI agent's mark to render. */
  agent: AgentName;
  /** Sizing/positioning classes applied to the mark (e.g. `w-5 h-5`). */
  className?: string;
  /** Override Fae's avatar source. Defaults to the avatar PACKAGED with the library (a
   *  base64 data URI), so every consumer renders it without serving any host asset. */
  faeAvatarSrc?: string;
}

/**
 * Unified Fae/Mingo agent mark — the ONE place that knows how each agent is drawn:
 * Mingo = its vector `MingoIcon`; Fae = its avatar (Fae has no vector), shipped with the
 * library. Just the glyph — the caller sizes/boxes it. Both branches are decorative.
 */
export function AgentMark({ agent, className = '', faeAvatarSrc = FAE_AVATAR_DATA_URI }: AgentMarkProps) {
  return agent === 'mingo'
    ? <MingoIcon className={className} aria-hidden="true" focusable="false" />
    : <img src={faeAvatarSrc} alt="" className={className} />;
}
