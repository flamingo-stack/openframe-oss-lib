import { cn } from '../utils/cn';
import { MingoIcon } from './icons';

export type AgentName = 'fae' | 'mingo';

export interface AgentMarkProps {
  /** Which AI agent's mark to render. */
  agent: AgentName;
  /** Sizing/positioning classes applied to the mark (e.g. `w-5 h-5`). */
  className?: string;
  /** Draw Fae from this picture instead of the one packaged with the library's styles. */
  faeAvatarSrc?: string;
}

/**
 * Unified Fae/Mingo agent mark — the ONE place that knows how each agent is drawn:
 * Mingo = its vector `MingoIcon`; Fae = its avatar (Fae has no vector), packaged with the
 * library's styles (`styles/agent-marks.css`), so every consumer renders it without serving
 * a host asset and a page that draws it twenty times carries the picture once.
 * Just the glyph — the caller sizes/boxes it. Both branches are decorative.
 */
export function AgentMark({ agent, className = '', faeAvatarSrc }: AgentMarkProps) {
  if (agent === 'mingo') return <MingoIcon className={className} aria-hidden="true" focusable="false" />;
  if (faeAvatarSrc) return <img src={faeAvatarSrc} alt="" className={className} loading="lazy" decoding="async" />;
  return <span aria-hidden="true" className={cn('ods-agent-mark-fae', className)} />;
}
