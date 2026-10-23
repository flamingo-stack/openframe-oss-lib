/**
 * The window events a page opens the chat with. A leaf: the launcher that
 * sends them and the chat that hears them read the names from here.
 */

/** Open the chat (and, with a `prompt` in the detail, ask it). */
export const ASK_AI_OPEN_EVENT = 'ask-ai:open';

/** Open the chat with a record to ask about (a search result with no page of its own). */
export const ASK_AI_OPEN_WITH_REF_EVENT = 'ask-ai:open-with-ref';

/** Every event that opens the chat. Each carries the chat `source` it is addressed to in its detail. */
export const ASK_AI_OPEN_EVENTS = [ASK_AI_OPEN_EVENT, ASK_AI_OPEN_WITH_REF_EVENT] as const;

/** The last open sent while no chat was listening yet (its code is loaded on its own, after the page's). */
let heldOpen: { type: string; detail: unknown } | null = null;
let holding = false;
/** The chats listening for opens right now. */
let listening = 0;

const holdOpen = (event: Event): void => {
  heldOpen = { type: event.type, detail: (event as CustomEvent<unknown>).detail };
};

const stopHolding = (): void => {
  if (!holding) return;
  holding = false;
  for (const name of ASK_AI_OPEN_EVENTS) window.removeEventListener(name, holdOpen);
};

/** Remember an open sent before a chat is listening, so the click that came too early is not lost. */
export function holdAskAiOpens(): void {
  if (holding || listening > 0 || typeof window === 'undefined') return;
  holding = true;
  for (const name of ASK_AI_OPEN_EVENTS) window.addEventListener(name, holdOpen);
}

/** An open came before any chat was listening, and waits to be delivered: the chat must load now. */
export function askAiOpenIsHeld(): boolean {
  return heldOpen !== null;
}

/**
 * A chat is listening now: stop holding, and send it the open that came before
 * it was. Returns what to call when that chat stops listening.
 */
export function chatListensForAskAiOpens(): () => void {
  listening += 1;
  stopHolding();
  const held = heldOpen;
  heldOpen = null;
  if (held) window.dispatchEvent(new CustomEvent(held.type, { detail: held.detail }));
  return () => {
    listening -= 1;
  };
}

/**
 * The attribute every element that opens the chat carries (the Mingo button, an ask prompt). A pointer or focus
 * reaching one is the visitor's intent to open it: the chat starts loading then, a moment before the click, instead
 * of on every page view (`onAskAiIntent`).
 */
export const ASK_AI_TRIGGER_ATTRIBUTE = 'data-ask-ai-trigger';

/** Runs `run` once a pointer, a touch or the focus reaches an element carrying `ASK_AI_TRIGGER_ATTRIBUTE`. */
export function onAskAiIntent(run: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const selector = `[${ASK_AI_TRIGGER_ATTRIBUTE}]`;
  const onIntent = (event: Event) => {
    if (event.target instanceof Element && event.target.closest(selector)) run();
  };
  const kinds = ['pointerover', 'focusin', 'touchstart'] as const;
  for (const kind of kinds) document.addEventListener(kind, onIntent, { capture: true, passive: true });
  return () => {
    for (const kind of kinds) document.removeEventListener(kind, onIntent, { capture: true });
  };
}
