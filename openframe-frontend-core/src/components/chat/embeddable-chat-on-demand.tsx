'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import type { EmbeddableChatProps } from './embeddable-chat';
import { ASK_AI_OPEN_EVENTS } from './utils/ask-ai-events';

/**
 * `<EmbeddableChat>` for a host that mounts the chat on every page and opens
 * it from a launcher: the panel's code is fetched the first time the chat is
 * asked for, not with the page.
 *
 * Until then this renders nothing and listens for the open events addressed to
 * its chat source (`ask-ai:open`, `ask-ai:open-with-ref`). The first one loads
 * the panel, and is sent again once the panel is listening, so the click that
 * loaded it also opens it and asks its question. From then on the panel hears
 * the events itself and this stays out of the way.
 *
 * Same props as `<EmbeddableChat>`, plus `panelProps` for the ones whose code
 * should load with the panel. A host that opens the chat itself
 * (`open` / `defaultOpen`) gets the panel as soon as it asks for it open.
 * It takes no ref: a host that drives the panel through its handle mounts
 * `<EmbeddableChat>` directly.
 */
const loadPanel = () => import('./embeddable-chat').then(module => module.EmbeddableChat);

export interface EmbeddableChatOnDemandProps extends EmbeddableChatProps {
  /**
   * Props whose own code should load WITH the panel instead of with the page: a
   * host's card registry, its mode config. Called once, when the chat is first
   * asked for; what it answers is merged over the props given directly.
   */
  panelProps?: () => Promise<Partial<EmbeddableChatProps>>;
}

interface PendingOpen {
  type: string;
  detail: unknown;
}

interface LoadedPanel {
  Panel: Awaited<ReturnType<typeof loadPanel>>;
  props: Partial<EmbeddableChatProps>;
}

/** Tells the shell the panel has mounted. A parent's effect runs after its children's, so the panel is listening by then. */
function PanelReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

export function EmbeddableChatOnDemand({ panelProps, ...props }: EmbeddableChatOnDemandProps) {
  const source = useRequiredChatRuntime().source ?? '';
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState<LoadedPanel | null>(null);
  const pending = useRef<PendingOpen | null>(null);
  const wanted = requested || Boolean(props.open ?? props.defaultOpen);

  useEffect(() => {
    if (wanted) return undefined;
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string } | null>).detail;
      if (!detail || detail.source !== source) return;
      pending.current = { type: event.type, detail };
      setRequested(true);
    };
    for (const name of ASK_AI_OPEN_EVENTS) window.addEventListener(name, onOpen);
    return () => {
      for (const name of ASK_AI_OPEN_EVENTS) window.removeEventListener(name, onOpen);
    };
  }, [wanted, source]);

  // The loader is read once, when the chat is first asked for: a host's inline arrow must not load it twice.
  const panelPropsRef = useRef(panelProps);
  useEffect(() => {
    if (!wanted) return undefined;
    let current = true;
    void Promise.all([loadPanel(), panelPropsRef.current?.() ?? {}]).then(([Panel, extra]) => {
      if (current) setLoaded({ Panel, props: extra });
    });
    return () => {
      current = false;
    };
  }, [wanted]);

  /** The open that loaded the panel, handed to the panel now that it listens. */
  const replay = useCallback(() => {
    const open = pending.current;
    pending.current = null;
    if (open) window.dispatchEvent(new CustomEvent(open.type, { detail: open.detail }));
  }, []);

  if (!loaded) return null;
  const { Panel } = loaded;
  return (
    <>
      <Panel {...props} {...loaded.props} />
      <PanelReady onReady={replay} />
    </>
  );
}
