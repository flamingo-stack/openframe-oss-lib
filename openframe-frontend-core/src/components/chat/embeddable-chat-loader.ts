'use client';

import { createElement, forwardRef, lazy, Suspense, useEffect, useState } from 'react';
import type { EmbeddableChatHandle, EmbeddableChatProps } from './embeddable-chat';
import { ASK_AI_OPEN_EVENTS, askAiOpenIsHeld, holdAskAiOpens, onAskAiIntent } from './utils/ask-ai-events';

// EmbeddableChat — THE chat. Hosts mount it once at the root after providing a
// <ChatRuntimeContext.Provider>. Its module is loaded on its own (`lazy`), and
// only when the visitor shows they want it: a pointer, a touch or the focus on
// an element that opens it (`onAskAiIntent`, `ASK_AI_TRIGGER_ATTRIBUTE`), or at
// once when something asks for it (an open event, `open` or `defaultOpen`). A
// chat that starts closed costs a page nothing: it used to load on every page
// once the browser was idle, about 650 KB of script most visitors never opened.
// An open sent before it has loaded is held and delivered (`ask-ai-events`). The host's own stylesheet
// for it loads at the same moment (`loadStyles`), so a page does not block on the chat's classes.
//
// It lives in a module of its own so `components/chat/index` stays a pure barrel: the lib's export map
// (scripts/build-export-map.mjs) maps only entries that hold no code, and with this wrapper in the index
// the whole chat entry was left out, so every `import { … } from '…/components/chat'` in a consumer
// loaded the barrel and everything it re-exports (on flamingo.run's home page, about 350 KB of chat
// code before anyone opened the chat).
const LoadedEmbeddableChat = lazy(() =>
  import('./embeddable-chat').then(module => ({ default: module.EmbeddableChat })),
);
export const EmbeddableChat = forwardRef<EmbeddableChatHandle, EmbeddableChatProps>((props, ref) => {
  const [loadRequested, setLoadRequested] = useState(false);
  const load = loadRequested || Boolean(props.open) || Boolean(props.defaultOpen);
  useEffect(() => holdAskAiOpens(), []);
  const { loadStyles } = props;
  useEffect(() => {
    if (load) loadStyles?.();
  }, [load, loadStyles]);
  useEffect(() => {
    if (load) return undefined;
    const start = () => setLoadRequested(true);
    // An open sent before this mounted (a deep link, an early click) is waiting: load now to deliver it.
    if (askAiOpenIsHeld()) queueMicrotask(start);
    for (const name of ASK_AI_OPEN_EVENTS) window.addEventListener(name, start);
    const cancel = onAskAiIntent(start);
    return () => {
      cancel();
      for (const name of ASK_AI_OPEN_EVENTS) window.removeEventListener(name, start);
    };
  }, [load]);
  if (!load) return null;
  return createElement(Suspense, { fallback: null }, createElement(LoadedEmbeddableChat, { ...props, ref }));
});
EmbeddableChat.displayName = 'EmbeddableChat';
