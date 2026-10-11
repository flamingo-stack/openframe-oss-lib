'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  AGENT_IDENTITIES_API_PATH,
  useAgentIdentities,
  type AgentIdentityIcon,
  type AgentIdentityIcons,
} from '../hooks/use-agent-identities';

export { AGENT_IDENTITIES_API_PATH, type AgentIdentityIcon, type AgentIdentityIcons };

/** `null` with no provider above: nothing was asked to supply the identities. */
const AgentIdentityContext = createContext<ReadonlyMap<string, AgentIdentityIcon> | null>(null);

function Provide({ icons, children }: { icons: AgentIdentityIcons | undefined; children: ReactNode }) {
  const bySlug = useMemo(() => {
    const map = new Map<string, AgentIdentityIcon>();
    for (const [slug, icon] of Object.entries(icons ?? {})) if (icon) map.set(slug, icon);
    return map;
  }, [icons]);
  return <AgentIdentityContext.Provider value={bySlug}>{children}</AgentIdentityContext.Provider>;
}

/** The identities read from the server (`useAgentIdentities`); it needs the host's react-query client. */
function ProvideFromServer({ endpoint, children }: { endpoint: string; children: ReactNode }) {
  return <Provide icons={useAgentIdentities(endpoint)}>{children}</Provide>;
}

/**
 * The AI agents' identity icons, by agent slug.
 *
 * An agent's picture is a record the product keeps (its agent identity: its
 * name and icon). Mounted once, this provider makes every mark of an agent,
 * wherever a component of this library or of the host draws one (`AgentMark`,
 * `EntityIcon`), the icon its identity holds. A change to the identity reaches
 * every mark with no edit to a call site.
 *
 * Where the identities come from:
 *   - `icons`: the host's own copy (one it read on the server). No request.
 *   - no `icons`: read FROM THE SERVER by `useAgentIdentities` (`endpoint`,
 *     default `AGENT_IDENTITIES_API_PATH`; an embedder passes its proxy path).
 *
 * The library packages no picture of an agent. Until the answer lands and when
 * it cannot be read a mark's box is empty; with no provider at all that is a
 * mistake of the host, said once in the console outside production.
 */
export function AgentIdentityProvider({
  icons,
  endpoint = AGENT_IDENTITIES_API_PATH,
  children,
}: {
  /** The host's copy of each agent's identity icon. Omit it and the provider reads them from `endpoint`. */
  icons?: AgentIdentityIcons;
  /** GET endpoint for the identities, used when `icons` is not given. */
  endpoint?: string;
  children: ReactNode;
}) {
  if (icons) return <Provide icons={icons}>{children}</Provide>;
  return <ProvideFromServer endpoint={endpoint}>{children}</ProvideFromServer>;
}

/** The icon the identity of the agent with this slug holds; undefined when none is known. */
export function useAgentIdentityIcon(slug: string | null | undefined): AgentIdentityIcon | undefined {
  const identities = useContext(AgentIdentityContext);
  const unprovided = !identities && Boolean(slug);
  useEffect(() => {
    if (!unprovided || process.env.NODE_ENV === 'production') return;
    console.error(
      `[AgentIdentity] the mark of "${slug}" was asked for with no <AgentIdentityProvider> above it: ` +
        'agents are drawn from their server identities only, so mount the provider once at the root.',
    );
  }, [unprovided, slug]);
  return identities?.get(slug ?? '');
}
