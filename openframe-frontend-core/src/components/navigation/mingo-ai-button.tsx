'use client';

import type React from 'react';
import { useEffect } from 'react';
import { useVisitorOs } from '../../hooks/ui/use-visitor-os';
import { cn } from '../../utils';
import { shortcutLabel, usesCommandKey } from '../../utils/visitor-os';
import { MingoIcon } from '../icons';
import { Button } from '../ui/button';

export interface MingoAiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  source?: string;
  /** The platform's Mingo identity glyph: pass the SAME server-configured
   *  icon the chat panel renders (host-side: `EntityIcon` fed by the admin
   *  `assistantIcon`), so the launcher and the panel can never diverge.
   *  Falls back to the packaged Mingo mark when the server has none. */
  icon?: React.ReactNode;
  /** The launcher's wordmark + aria-label: pass the server-configured
   *  assistant name (same `assistantName` the chat panel shows) so the
   *  launcher never hardcodes an identity the admin has renamed. */
  label?: string;
  /** Bind Cmd+K (Ctrl+K off Apple platforms) to open the chat, and show the
   *  key cap beside the label. Default false. */
  shortcutHint?: boolean;
  /** `inline` (default): the header launcher, the height and type of the menu
   *  items beside it. `field`: the full-width row that opens the mobile menu
   *  (the name reads as the field's prompt). ONE component, so every Mingo
   *  launcher carries the same identity, ring and event. */
  variant?: 'inline' | 'field';
}

const MINGO_ACCENT = 'var(--ods-flamingo-cyan-base)';

/** The event the mounted chat panel (`EmbeddableChat`) opens on. */
export const ASK_AI_OPEN_EVENT = 'ask-ai:open';

/** What an `ask-ai:open` event carries. */
export interface AskAiOpenDetail {
  source: string;
  /** A question to send as soon as the chat is open. Absent: the chat only opens. */
  prompt?: string;
}

/**
 * Open the chat of `source`, and with `prompt` ask it that question once.
 * `source` is coalesced to '' so a source-less call still matches the panel's
 * own `runtime.source ?? ''` comparison (undefined !== '' would make the panel
 * silently ignore the event).
 */
export function openAskAi(source?: string, options?: { prompt?: string }): void {
  const prompt = options?.prompt?.trim();
  const detail: AskAiOpenDetail = prompt ? { source: source ?? '', prompt } : { source: source ?? '' };
  window.dispatchEvent(new CustomEvent<AskAiOpenDetail>(ASK_AI_OPEN_EVENT, { detail }));
}

/**
 * THE Mingo AI launcher, in the site header's right cluster and at the top of
 * the mobile menu (`variant="field"`): the round identity glyph, the
 * assistant's name and an optional shortcut hint, sized like the menu items
 * beside it. Stateless: clicking dispatches an `ask-ai:open`
 * CustomEvent (source-filtered) that the mounted `EmbeddableChat` panel
 * listens for.
 *
 * It carries the AI edge light (`.mingo-edge-frame` / `.mingo-edge` in
 * `styles/chat-animations.css`): an accent arc travelling around its outline,
 * with a one-shot shimmer on hover. Static under reduced motion.
 *
 * Distinct from `header-mingo-button.tsx` (`HeaderMingoButton`), the
 * dashboard/AppHeader controlled toggle; different surface and contract, do
 * not merge them.
 *
 * It is the lib `Button` (`transparent`, or `glyph` for the menu row, at the
 * `wrap` size): the launcher's own box, ring and collapse are classes on it.
 */
export function MingoAiButton({
  source,
  icon,
  label = 'Mingo AI',
  shortcutHint = false,
  variant = 'inline',
  className,
  onClick,
  ...props
}: MingoAiButtonProps) {
  // Known after hydration only: until then the hint keeps its space, empty.
  const visitor = useVisitorOs();
  const field = variant === 'field';

  const commandKey = visitor.known && usesCommandKey(visitor.os);

  // The shortcut the key cap shows opens the same chat the click opens.
  useEffect(() => {
    if (!shortcutHint) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      // Something on the page already took the shortcut (an editor's link shortcut): leave it alone.
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      // The modifier the key cap shows, and only that one: on a Mac Ctrl+K is
      // the text fields' own "delete to the end of the line".
      const modifier = commandKey ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (event.key.toLowerCase() !== 'k' || !modifier) return;
      event.preventDefault();
      openAskAi(source);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutHint, source, commandKey]);

  return (
    <Button
      {...props}
      type="button"
      variant={field ? 'glyph' : 'transparent'}
      size="wrap"
      font="regular"
      aria-label={label}
      aria-keyshortcuts={shortcutHint && visitor.known ? (commandKey ? 'Meta+K' : 'Control+K') : undefined}
      onClick={e => {
        openAskAi(source);
        onClick?.(e);
      }}
      className={cn(
        'group/mingo flex shrink-0 justify-start focus-visible:ring-ods-accent',
        field
          ? // A row of the mobile menu like the groups under it: same height,
            // type and divider, no surface and no ring of its own.
            'min-h-14 w-full gap-[var(--spacing-system-sf)] rounded-none border-b border-ods-border text-left text-h4 [&_svg]:h-6 [&_svg]:w-6'
          : // Transparent at rest so it inherits the bar's background; the hover
            // wash is the menu items' own.
            'h-10 gap-[var(--spacing-system-xsf)] rounded-md pl-[var(--spacing-system-xsf)] pr-2.5 text-ods-text-secondary hover:text-ods-text-primary',
        className,
      )}
    >
      {!field && (
        <>
          {/* AI edge light (Apple-Intelligence-style): a rotating accent-gradient
          arc clipped to a hairline ring on the outline via CSS mask
          (.mingo-edge-frame). NO opaque cover, so the launcher inherits
          whatever background sits behind it. Platform-tinted via the accent
          token. */}
          <span aria-hidden="true" className="mingo-edge-frame pointer-events-none absolute inset-0 rounded-md">
            <span className="mingo-edge" />
          </span>
          {/* One-shot light-streak shimmer on hover, clipped to the outline. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
            <span
              className="mingo-shimmer absolute inset-y-0 left-0 w-1/2"
              style={{
                background:
                  'linear-gradient(105deg, transparent, color-mix(in srgb, var(--ods-system-greys-white) 12%, transparent), transparent)',
              }}
            />
          </span>
        </>
      )}
      {icon ? (
        <span
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
            field ? 'size-6' : 'size-5',
          )}
        >
          {icon}
        </span>
      ) : (
        <MingoIcon
          color="currentColor"
          eyesColor={MINGO_ACCENT}
          cornerColor={MINGO_ACCENT}
          className={cn('relative shrink-0 text-ods-text-primary', field ? 'size-6' : 'size-5')}
        />
      )}
      {/* In the header the name collapses below lg, with the menus: on a phone
          the launcher is its glyph alone (the name stays the accessible name). */}
      <span
        className={cn('relative whitespace-nowrap', field ? 'min-w-0 flex-1 truncate' : 'hidden text-h6 lg:inline')}
      >
        {label}
      </span>
      {shortcutHint && !field && (
        // A key cap in the label's own type (never smaller: a hint nobody can
        // read is decoration) and the label's colour, which clears 4.5:1 on
        // the bar. It keeps its width before the platform is known.
        <kbd className="relative hidden h-6 min-w-9 items-center justify-center rounded border border-ods-border px-[var(--spacing-system-xxs)] text-h6 lg:inline-flex">
          {visitor.known ? shortcutLabel(visitor.os, 'K') : ''}
        </kbd>
      )}
    </Button>
  );
}

export default MingoAiButton;
