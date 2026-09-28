/**
 * FullscreenSwitchController — the ONE place fullscreen enter/exit lives.
 *
 * Framework-agnostic (no React): the consumer passes callbacks (and, for
 * page-level surfaces, the <html> mask classes); the controller owns the
 * Fullscreen API calls, webkit fallbacks, and the flicker-free switch
 * choreography. Originally extracted from the hub's company-hub deck (PR
 * #737); moved into the lib so EVERY fullscreen surface — the deck, the
 * embed viewers — shares one implementation instead of re-deriving the
 * event-ordering lessons below. The hub's `lib/utils/fullscreen-switch.ts`
 * re-exports from here (extractItems shim precedent).
 *
 * Two shapes of consumer:
 *   - PAGE-LEVEL (the deck): no `target` — fullscreens
 *     `document.documentElement`, uses the mask classes + geometry pulses.
 *   - ELEMENT-LEVEL (embed viewers): pass `target` — fullscreens one
 *     element; classes/pulses are optional and simply skipped when absent.
 *
 * Invariants (each guards a bug found while building the deck's fullscreen):
 * - Fullscreen STATE follows the fullscreenchange event exclusively (never
 *   set optimistically): Esc, keyboard shortcuts, buttons and browser
 *   chrome all converge on one listener.
 * - The switching mask (when configured) goes up PRE-EMPTIVELY:
 *   Chrome/Safari PAINT resized frames BEFORE fullscreenchange fires
 *   (whatwg/fullscreen#74), so masking inside the change event is already
 *   too late. `toggle()` masks before requesting; an Escape keydown
 *   listener (capture) masks the one exit path that skips toggle(); the
 *   change event remains the fallback for browser-chrome-initiated
 *   transitions.
 * - The swap is a multi-frame viewport animation (macOS especially): one
 *   rAF re-anchor is NOT enough. While masked, every resize fires
 *   onGeometryPulse (re-measure + re-anchor under a constant scrollY);
 *   quiet resizes for `quietMs` (or the `capMs` hard cap — a rejected
 *   fullscreen request after a pre-emptive mask must never wedge the mask
 *   up) end the switch.
 */

/** Webkit-prefixed Fullscreen API fallbacks (Safari < 16.4 desktop, older
 *  iPadOS; iOS 26+ ships the standard API — isSupported() gates elsewhere). */
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const fullscreenElementOf = (doc: FsDocument) => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

export interface FullscreenSwitchOptions {
  /** The element to fullscreen. Omit for page-level surfaces (the deck):
   *  `document.documentElement` — window scrolling survives, which
   *  element-level fullscreen would freeze. A callback so refs resolve at
   *  toggle time, not construction time. */
  target?: () => HTMLElement | null;
  /** Held on <html> while fullscreen is ACTIVE (steady-state styling).
   *  Optional — element-level consumers style off their own state. */
  activeClass?: string;
  /** Held on <html> for the DURATION of an enter/exit swap (the
   *  mask/curtain). Optional — see `activeClass`. */
  switchingClass?: string;
  /** New fullscreen state, straight from the change event. For a `target`
   *  consumer this is "MY element is the fullscreen element". */
  onFullscreenChange: (isFullscreen: boolean) => void;
  /** Geometry moved under a constant scrollY — re-measure + re-anchor.
   *  Optional; fired once per resize during the swap and once more when
   *  the switch ends. */
  onGeometryPulse?: () => void;
  /** Switch ends after resizes have been quiet this long (default 200ms). */
  quietMs?: number;
  /** Hard cap on a switch, mask-wedge failsafe (default 1000ms). */
  capMs?: number;
}

const DEFAULT_QUIET_MS = 200;
const DEFAULT_CAP_MS = 1000;

export class FullscreenSwitchController {
  private quietTimer = 0;
  private capTimer = 0;
  private attached = false;

  constructor(private readonly opts: FullscreenSwitchOptions) {}

  /** SSR-safe feature detection — call post-mount to gate the affordance. */
  static isSupported(): boolean {
    if (typeof document === 'undefined') return false;
    const doc = document as FsDocument;
    const el = document.documentElement as FsElement;
    return (
      Boolean(el.requestFullscreen || el.webkitRequestFullscreen) &&
      (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true) !== false
    );
  }

  get isFullscreen(): boolean {
    const fs = fullscreenElementOf(document);
    const target = this.opts.target?.();
    return target ? fs === target : Boolean(fs);
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    const doc = document as FsDocument;
    doc.addEventListener('fullscreenchange', this.onChange);
    doc.addEventListener('webkitfullscreenchange', this.onChange);
    window.addEventListener('keydown', this.onEscape, true);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    const doc = document as FsDocument;
    doc.removeEventListener('fullscreenchange', this.onChange);
    doc.removeEventListener('webkitfullscreenchange', this.onChange);
    window.removeEventListener('keydown', this.onEscape, true);
    window.removeEventListener('resize', this.onResize);
    window.clearTimeout(this.quietTimer);
    window.clearTimeout(this.capTimer);
    if (this.opts.activeClass) doc.documentElement.classList.remove(this.opts.activeClass);
    if (this.opts.switchingClass) doc.documentElement.classList.remove(this.opts.switchingClass);
  }

  /** Mask first (pre-emptive — see header), then request/exit. */
  toggle = (): void => {
    const doc = document as FsDocument;
    this.beginSwitch();
    if (fullscreenElementOf(doc)) {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
    } else {
      const el = (this.opts.target?.() ?? document.documentElement) as FsElement;
      // navigationUI:'hide' = prefer screen space over browser nav chrome.
      if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      else el.webkitRequestFullscreen?.();
    }
  };

  /** Raise the mask + start tracking. Idempotent — safe from the pre-emptive
   *  paths (toggle, Escape) AND again from the change event. */
  private beginSwitch = (): void => {
    if (this.opts.switchingClass) document.documentElement.classList.add(this.opts.switchingClass);
    window.addEventListener('resize', this.onResize);
    window.clearTimeout(this.capTimer);
    this.capTimer = window.setTimeout(this.endSwitch, this.opts.capMs ?? DEFAULT_CAP_MS);
  };

  private endSwitch = (): void => {
    window.clearTimeout(this.quietTimer);
    window.clearTimeout(this.capTimer);
    window.removeEventListener('resize', this.onResize);
    this.opts.onGeometryPulse?.();
    if (this.opts.switchingClass) document.documentElement.classList.remove(this.opts.switchingClass);
  };

  private armQuiet = (): void => {
    window.clearTimeout(this.quietTimer);
    this.quietTimer = window.setTimeout(this.endSwitch, this.opts.quietMs ?? DEFAULT_QUIET_MS);
  };

  private onResize = (): void => {
    this.opts.onGeometryPulse?.();
    this.armQuiet();
  };

  /** Escape is the one exit path that skips toggle() — pre-mask on the
   *  keydown (capture phase), before the browser begins the swap. */
  private onEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isFullscreen) this.beginSwitch();
  };

  private onChange = (): void => {
    const fs = this.isFullscreen;
    if (this.opts.activeClass) document.documentElement.classList.toggle(this.opts.activeClass, fs);
    this.beginSwitch();
    requestAnimationFrame(() => this.opts.onGeometryPulse?.());
    this.armQuiet();
    this.opts.onFullscreenChange(fs);
  };
}
