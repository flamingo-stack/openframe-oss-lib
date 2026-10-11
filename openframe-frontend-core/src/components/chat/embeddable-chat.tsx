'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import type { EmbeddableChatHandle, EmbeddableChatPanelProps } from './embeddable-chat-panel';
import { ASK_AI_OPEN_EVENTS } from './utils/ask-ai-events';

export type { ChatPrefillDraft, EmbeddableChatHandle } from './embeddable-chat-panel';

/**
 * `<EmbeddableChat>`: THE chat, for every host. Mounted once at the root (after
 * a `<ChatRuntimeContext.Provider>`), it fetches the panel's code when the chat
 * is first NEEDED, never with the page:
 *
 *   - a host that opens the chat from a launcher gets nothing until the first
 *     open event addressed to its chat source (`ask-ai:open`,
 *     `ask-ai:open-with-ref`). That open loads the panel and is sent again once
 *     the panel is listening, so the click that loaded it also opens it and
 *     asks its question. From then on the panel hears the events itself;
 *   - a host that needs the panel on screen gets it at once: it asks for it
 *     open (`open` / `defaultOpen`), draws it inside its own surface (`shell`
 *     other than the drawer), shows it as a static visual (`previewMode`) or
 *     keeps the panel's own floating trigger (`showInternalTrigger`);
 *   - a command through the handle (`startNewChat`, `prefillDraft`) loads the
 *     panel too, and runs once the panel has mounted.
 *
 * `panelProps` carries the props whose own code should load with the panel.
 */
const loadPanel = () => import('./embeddable-chat-panel').then(module => module.EmbeddableChatPanel);

export interface EmbeddableChatProps extends EmbeddableChatPanelProps {
  /**
   * Props whose own code should load WITH the panel instead of with the page: a
   * host's card registry, its mode config. Called once, when the chat is first
   * needed; what it answers is merged over the props given directly.
   */
  panelProps?: () => Promise<Partial<EmbeddableChatPanelProps>>;
}

interface PendingOpen {
  type: string;
  detail: unknown;
}

interface LoadedPanel {
  Panel: Awaited<ReturnType<typeof loadPanel>>;
  props: Partial<EmbeddableChatPanelProps>;
}

type PanelCommand = (panel: EmbeddableChatHandle) => void;

/** Tells the shell the panel has mounted. A parent's effect runs after its children's, so the panel is listening by then. */
function PanelReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

export const EmbeddableChat = forwardRef<EmbeddableChatHandle, EmbeddableChatProps>(function EmbeddableChatShell(
  { panelProps, ...props },
  ref,
) {
  const source = useRequiredChatRuntime().source ?? '';
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState<LoadedPanel | null>(null);
  const pendingOpen = useRef<PendingOpen | null>(null);
  const pendingCommands = useRef<PanelCommand[]>([]);
  const panel = useRef<EmbeddableChatHandle>(null);
  // The panel has to be on screen without anyone asking for the chat: the host
  // holds it open, hosts its body, shows it as a visual, or keeps its own trigger.
  const onScreen =
    Boolean(props.open ?? props.defaultOpen) ||
    (props.shell ?? 'drawer') !== 'drawer' ||
    Boolean(props.previewMode) ||
    props.showInternalTrigger !== false;
  const wanted = requested || onScreen;

  useEffect(() => {
    if (wanted) return undefined;
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string } | null>).detail;
      if (!detail || detail.source !== source) return;
      pendingOpen.current = { type: event.type, detail };
      setRequested(true);
    };
    for (const name of ASK_AI_OPEN_EVENTS) window.addEventListener(name, onOpen);
    return () => {
      for (const name of ASK_AI_OPEN_EVENTS) window.removeEventListener(name, onOpen);
    };
  }, [wanted, source]);

  // The loader is read once, when the chat is first needed: a host's inline arrow must not load it twice.
  const panelPropsRef = useRef(panelProps);
  useEffect(() => {
    if (!wanted) return undefined;
    let current = true;
    Promise.all([loadPanel(), panelPropsRef.current?.() ?? {}])
      .then(([Panel, extra]) => {
        if (current) setLoaded({ Panel, props: extra });
      })
      .catch((error: unknown) => {
        // The panel's script or the host's props could not be loaded (a deploy
        // replaced the script, the network dropped). The request is forgotten, so
        // the next open asks again instead of leaving the chat dead until a reload.
        console.error('[EmbeddableChat] the chat panel could not be loaded:', error);
        if (!current) return;
        pendingOpen.current = null;
        pendingCommands.current = [];
        setRequested(false);
      });
    return () => {
      current = false;
    };
  }, [wanted]);

  // The host's handle: a command runs on the panel, or loads it and waits for it.
  useImperativeHandle(ref, () => {
    const run = (command: PanelCommand) => {
      if (panel.current) {
        command(panel.current);
        return;
      }
      pendingCommands.current.push(command);
      setRequested(true);
    };
    return {
      startNewChat: () => run(mounted => mounted.startNewChat()),
      prefillDraft: draft => run(mounted => mounted.prefillDraft(draft)),
    };
  }, []);

  /** What was asked of the chat while its panel loaded, handed to the panel now that it has mounted. */
  const replay = useCallback(() => {
    const open = pendingOpen.current;
    pendingOpen.current = null;
    if (open) window.dispatchEvent(new CustomEvent(open.type, { detail: open.detail }));
    const commands = pendingCommands.current;
    pendingCommands.current = [];
    if (panel.current) for (const command of commands) command(panel.current);
  }, []);

  if (!loaded) return null;
  const { Panel } = loaded;
  return (
    <>
      <Panel ref={panel} {...props} {...loaded.props} />
      <PanelReady onReady={replay} />
    </>
  );
});
EmbeddableChat.displayName = 'EmbeddableChat';
