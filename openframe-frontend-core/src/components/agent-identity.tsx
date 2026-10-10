'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** An icon as an agent's identity holds it: a library glyph name, an uploaded picture, or both unset. */
export interface AgentIdentityIcon {
  name?: string | null;
  url?: string | null;
  props?: Record<string, unknown> | null;
}

/**
 * The AI agents' identity icons, by agent slug.
 *
 * An agent's picture is a record its host keeps (the product's agent identity:
 * its name and icon). A host mounts this provider once with what it read, and
 * from then on every mark of that agent, wherever a component of this library
 * or of the host draws one (`AgentMark`, `EntityIcon`), is the icon its
 * identity holds. A change to the identity reaches every mark with no edit to a
 * call site. With no provider (an embed that has no identities, a story, a
 * test) each agent keeps the mark packaged with the library.
 */
const AgentIdentityContext = createContext<ReadonlyMap<string, AgentIdentityIcon>>(new Map());

export function AgentIdentityProvider({
  icons,
  children,
}: {
  /** Each agent's identity icon, keyed by the agent's slug. */
  icons: Readonly<Record<string, AgentIdentityIcon | null | undefined>>;
  children: ReactNode;
}) {
  const bySlug = useMemo(() => {
    const map = new Map<string, AgentIdentityIcon>();
    for (const [slug, icon] of Object.entries(icons)) if (icon) map.set(slug, icon);
    return map;
  }, [icons]);
  return <AgentIdentityContext.Provider value={bySlug}>{children}</AgentIdentityContext.Provider>;
}

/** The icon the identity of the agent with this slug holds; undefined when the host named none. */
export function useAgentIdentityIcon(slug: string | null | undefined): AgentIdentityIcon | undefined {
  return useContext(AgentIdentityContext).get(slug ?? '');
}
