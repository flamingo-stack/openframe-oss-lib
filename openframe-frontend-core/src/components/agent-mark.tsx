import { MingoIcon } from './icons';

export type AgentName = 'fae' | 'mingo';

/**
 * Mingo renders its vector icon (no asset). Fae has no vector — its avatar IS its mark —
 * so the consumer MUST supply `faeAvatarSrc`; the shared component never assumes a host
 * asset path. Discriminated so `agent="fae"` can't compile without a source.
 */
export type AgentMarkProps =
  | { agent: 'mingo'; className?: string; faeAvatarSrc?: never }
  | { agent: 'fae'; className?: string; faeAvatarSrc: string };

/**
 * Unified Fae/Mingo agent mark — the ONE place that knows how each agent is drawn:
 * Mingo = its vector `MingoIcon`; Fae = its avatar image (caller-supplied src). Just the
 * glyph — the caller sizes/boxes it. Both branches are decorative (assistive-tech hidden).
 */
export function AgentMark({ agent, className = '', faeAvatarSrc }: AgentMarkProps) {
  return agent === 'mingo'
    ? <MingoIcon className={className} aria-hidden="true" focusable="false" />
    : <img src={faeAvatarSrc} alt="" className={className} />;
}
