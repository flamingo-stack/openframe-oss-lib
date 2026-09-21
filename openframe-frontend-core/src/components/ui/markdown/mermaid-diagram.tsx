'use client';

/**
 * Single MermaidDiagram for the unified markdown engine (dark theme only —
 * the old RichMarkdownRenderer's light-theme branch was dead code behind a
 * hardcoded `isDarkMode = true` and is deleted, not carried over).
 *
 * `mermaid` stays a dynamic import so neither chat nor content bundles pay
 * for it unless a diagram is actually rendered.
 */
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { MermaidConfig } from 'mermaid';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIsHydrated } from '../../../hooks/ui/use-is-hydrated';
import { AlertCircleIcon } from '../../icons-v2-generated';
import { Button } from '../button';

/**
 * SECURITY SSOT for the mermaid renderer — the ONLY place these knobs are
 * written. `./__tests__/mermaid-security.test.ts` imports THIS constant and
 * spreads it into its own `mermaid.initialize`, so the fixture and the
 * component can no longer drift: flipping `securityLevel` to `'loose'` here
 * fails the suite (verified by doing exactly that).
 *
 * This renderer sits on the CHAT path, so the diagram source is MODEL output
 * — untrusted by construction — and the rendered SVG goes through
 * `dangerouslySetInnerHTML`. The pre-unification renderer used `'loose'`,
 * which permits raw HTML inside labels and enables mermaid's `click`
 * interaction directive: a node label like `A["<img src=x onerror=...>"]`
 * would have produced LIVE HTML.
 *
 *  - `securityLevel: 'strict'` encodes HTML tags in text and disables click
 *    handlers.
 *  - `htmlLabels: false` renders labels as SVG `<text>` instead of a
 *    foreignObject HTML subtree, so there is no HTML surface at all. Verified:
 *    no authored diagram in this repo or in the consuming hub's markdown uses
 *    HTML labels (not even `<br/>`), so 'antiscript' (which still allows tags)
 *    is not needed. (`htmlLabels` is set at the ROOT — `flowchart.htmlLabels`
 *    is deprecated in mermaid 11 and the root value takes precedence.)
 *  - `secure` is the allowlist of config keys a `%%{init}%%` directive in the
 *    diagram SOURCE may NOT override. mermaid's default list covers
 *    `securityLevel` but NOT `htmlLabels`, so model-authored source could
 *    otherwise re-enable HTML labels while `securityLevel` stayed locked.
 *    Adding `htmlLabels` (plus `secure` itself and the resource limits) closes
 *    that hole.
 *
 * jsdom NOTE: with `htmlLabels` unlocked, a `%%{init: {"htmlLabels": true}}%%`
 * directive was observed to make `mermaid.render` never settle under jsdom
 * (>60s, against a passing two-render control). This was NOT reproduced in a
 * real browser and may well be an artifact of jsdom having no layout — do not
 * read it as a confirmed browser DoS. Either way the render below is wrapped
 * in a timeout so a non-settling render surfaces the error state instead of
 * sitting on "Rendering diagram…" forever.
 */
export const MERMAID_SECURITY_OPTIONS = {
  htmlLabels: false,
  securityLevel: 'strict',
  secure: [
    'securityLevel',
    'htmlLabels',
    'secure',
    'startOnLoad',
    'maxTextSize',
    'maxEdges',
    // `themeCSS` is RAW CSS that mermaid emits into a `<style>` inside the
    // SVG this component injects with `dangerouslySetInnerHTML`. Locking
    // `securityLevel`/`htmlLabels` closes the HTML surface but left CSS wide
    // open, and mermaid's own directive sanitizer does not help: `themeCSS`
    // is a normal config key, and `sanitizeCss` only brace-balances it.
    // Two demonstrated payloads (verified against real mermaid 11.14.0):
    //   - `%%{init:{"themeCSS":"position:fixed;top:0;left:0;width:100vw;
    //     height:100vh;z-index:2147483647;background:#fff"}}%%` — bare
    //     declarations land on the `#svgId` selector itself, so the diagram
    //     becomes an opaque, top-most, viewport-filling overlay whose visible
    //     text the author controls via node labels (UI redress / phishing);
    //   - `themeCSS: "@font-face{src:url(https://evil.example/f.woff)}"` —
    //     at-rules escape the `#svgId` prefix entirely and land
    //     document-global, i.e. an unconditional outbound request to an
    //     attacker host on every render.
    // The diagram source on the chat path is MODEL output, so both are
    // reachable from untrusted input. Nothing in this repo authors `themeCSS`.
    'themeCSS',
  ],
} satisfies Pick<MermaidConfig, 'htmlLabels' | 'securityLevel' | 'secure'>;

/** Upper bound on a single `mermaid.render`. Generous enough that no honest
 *  diagram hits it; short enough that a wedged render becomes a visible error
 *  instead of a permanent skeleton.
 *
 *  NOTE: `Promise.race` below only stops the CALLER from waiting past this
 *  bound — it cannot cancel `mermaid.render` itself (mermaid exposes no abort
 *  hook), so a pathological diagram keeps burning CPU in the background after
 *  the UI has already moved to the error state. See `withRenderTimeout`. */
export const MERMAID_RENDER_TIMEOUT_MS = 15_000;

/** `Promise.race` with a rejecting timer, timer always cleared. Kept local —
 *  the only caller is the render below.
 *
 *  LIMITATION (tracked, not fixed here): this races the render, it does not
 *  abort it. `mermaid.render` has no cancellation API, so on timeout the
 *  underlying work keeps running to completion (or forever) even though the
 *  caller has already stopped waiting and shown an error. On the chat surface
 *  the diagram source is untrusted (model output), so a diagram engineered to
 *  be pathologically slow to render (e.g. very large node/edge counts) can
 *  still consume CPU/memory per message after its own timeout fires, and
 *  repeated messages each spawn an independent, uncancelled render. A
 *  complete fix needs an actual cancellation mechanism (e.g. running
 *  `mermaid.render` in a Worker that can be terminated, or upstream support
 *  for aborting a render) — out of scope for this component alone. */
async function withRenderTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Diagram rendering timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * ODS-TOKENS FLAG (ODS_TOKEN_RULES §Colors / §Typography / §General):
 * `mermaidStyles` below and the `themeVariables` / `fontFamily` / `fontSize`
 * block in `MermaidDiagram` carry RAW hex colors, a literal font-family and
 * literal px font sizes.
 *
 * Reason: mermaid's configuration is not CSS — `themeVariables` is a
 * JavaScript API whose values are baked into the generated SVG as literal
 * attribute strings, so a `var(--color-…)` reference resolves to nothing
 * there. On top of that, ODS has NO 10-step categorical color ramp, and
 * mermaid's `cScale0…cScale9` requires exactly one. The palette is carried
 * over VERBATIM from the pre-unification RichMarkdownRenderer, so this is
 * parity, not new divergence; the missing categorical-ramp tokens are
 * flagged here for addition to ODS.
 *
 * MULTIPLA-002 tracking: this is a DOCUMENTED, INTENTIONAL exemption, not a
 * silent violation — per MULTIPLA-002 any hardcoded hex needs a tracked
 * ESLint-allowlist justification rather than only an inline comment.
 * `eslint-disable` markers below are that formal record (in addition to this
 * comment) for every raw hex/px/font-family literal in this file's mermaid
 * config surface, so tooling can enforce/allowlist this exemption instead of
 * relying on convention. Follow-up: add the missing categorical-ramp tokens
 * to ODS and replace the `eslint-disable` markers with real token refs.
 *
 * Scope: this exemption covers THIS file only, and only the mermaid config
 * surface. Do NOT copy this pattern — every other style in the markdown
 * module uses ODS semantic classes.
 */
/* eslint-disable multipla-002/no-hardcoded-colors -- ODS-TOKENS FLAG: mermaid
   themeCSS/SVG output has no CSS var resolution; see comment above. Tracked
   exemption, not a silent bypass. */
export const mermaidStyles = `
  /* The pan surface is a scroll region with NO scrollbars: drag, wheel,
     arrows and the toolbar move it (a canvas, the way dbdiagram, Figma and
     Excalidraw draw one). Two mechanisms for one motion read as a bug. */
  .mermaid-frame-pan { scrollbar-width: none; -ms-overflow-style: none; }
  .mermaid-frame-pan::-webkit-scrollbar { display: none; }
  .mermaid-svg-container svg {
    max-width: 100%;
    height: auto;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 14px !important;
  }
  .mermaid-svg-container .node rect,
  .mermaid-svg-container .node circle,
  .mermaid-svg-container .node ellipse,
  .mermaid-svg-container .node polygon { stroke-width: 2px !important; }
  .mermaid-svg-container .edgePath path { stroke-width: 2px !important; }
  @media (min-width: 768px) {
    .mermaid-svg-container .node text,
    .mermaid-svg-container .edgeLabel text { font-size: 14px !important; }
  }
  @media (min-width: 1520px) {
    .mermaid-svg-container .node text,
    .mermaid-svg-container .edgeLabel text { font-size: 16px !important; }
  }
`;
/* eslint-enable multipla-002/no-hardcoded-colors */

/**
 * The VIEWER — every rendered diagram gets it, here in the ONE component, so
 * a markdown fence in the knowledge base and a server-rendered admin diagram
 * behave the same way. The contract is the one diagram tools converge on
 * (dbdiagram, Excalidraw, Mermaid Live):
 *  - drag to pan (mouse / pen; touch pans the frame natively) — the frame
 *    shows NO scrollbars, so panning has one visible mechanism;
 *  - ⌘/Ctrl + wheel (and trackpad pinch, which browsers deliver the same
 *    way) zooms TOWARD THE CURSOR — the point under the pointer stays put;
 *    a plain wheel scrolls the frame, like any other scroll region;
 *  - toolbar: zoom out, the percentage (click = back to 100%), zoom in, fit;
 *  - keyboard, with the frame focused: arrows scroll (native), `+` / `-`
 *    zoom, `0` resets, `f` fits.
 * Applied through the CSS `zoom` property (a LAYOUT scale, unlike
 * `transform`), so the frame's own scrollbars reach every corner of a
 * magnified diagram and the zoom math is plain arithmetic on scroll offsets.
 */
export const MERMAID_ZOOM_MIN = 0.25;
export const MERMAID_ZOOM_MAX = 4;
export const MERMAID_ZOOM_STEP = 1.25;
const clampZoom = (z: number) => Math.min(MERMAID_ZOOM_MAX, Math.max(MERMAID_ZOOM_MIN, z));

/** Monotonic render id. `Date.now()` was ambiguous: two renders started in the
 *  same millisecond (routine while a diagram streams in) share an id, and
 *  mermaid removes any pre-existing element with that id at the start of a
 *  render — so one render would delete the other's working container. */
let mermaidRenderSeq = 0;

/**
 * How tall the diagram's FRAME is. The frame is a scroll container in both
 * modes, so a zoomed diagram scrolls inside it instead of growing the page:
 *  - `content`: as tall as the diagram, capped at 70svh (markdown, chat);
 *  - `fold`: a fixed 70svh, skeleton and diagram alike — a page whose main
 *    element is the diagram never jumps when it lands (the admin graphs).
 */
export type MermaidFrame = 'content' | 'fold';
const FRAME_CLASS: Record<MermaidFrame, string> = {
  content: 'min-h-[200px] max-h-[70svh] md:min-h-[250px]',
  fold: 'h-[70svh] min-h-[320px]',
};

export const MermaidDiagram: React.FC<{ chart: string; zoomable?: boolean; frame?: MermaidFrame }> = ({
  chart,
  zoomable = true,
  frame = 'content',
}) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [dragging, setDragging] = useState(false);
  const empty = !chart.trim();
  // Mermaid (`useMaxWidth`) states the diagram's natural width as an inline
  // `max-width: <n>px` on the SVG. The container takes that width, capped at
  // the frame, so CSS `zoom` has a fixed box to scale: an auto-width block
  // would re-fit the frame at every zoom and never overflow into it. Inside a
  // zoomed element `100%` is the frame divided by the zoom, so the cap is
  // `calc(100% * zoom)` — the frame's real width — and what fit at 100% is
  // what grows: at 200% a frame-wide diagram is two frames wide and scrolls.
  const naturalWidth = useMemo(() => {
    const px = Number(svg.match(/max-width:\s*([\d.]+)px/)?.[1]);
    return Number.isFinite(px) && px > 0 ? Math.ceil(px) : null;
  }, [svg]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Anchor-preserving zoom: the content scales linearly with `zoom`, so the
  // point under the anchor stays put when the scroll offset is scaled by the
  // same ratio around it. The offset is applied in a layout effect, AFTER
  // React has re-rendered the new zoom, so the scroll range already exists.
  const pendingAnchor = useRef<{ ratio: number; ax: number; ay: number } | null>(null);
  const applyZoom = useCallback((next: number, anchor?: { ax: number; ay: number }) => {
    setZoom(current => {
      const target = clampZoom(Math.round(next * 100) / 100);
      if (target === current) return current;
      const el = scrollRef.current;
      const ax = anchor?.ax ?? (el ? el.clientWidth / 2 : 0);
      const ay = anchor?.ay ?? (el ? el.clientHeight / 2 : 0);
      pendingAnchor.current = { ratio: target / current, ax, ay };
      return target;
    });
  }, []);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pending = pendingAnchor.current;
    if (!el || !pending) return;
    pendingAnchor.current = null;
    el.scrollLeft = (el.scrollLeft + pending.ax) * pending.ratio - pending.ax;
    el.scrollTop = (el.scrollTop + pending.ay) * pending.ratio - pending.ay;
  }, [zoom]);
  const zoomBy = useCallback(
    (factor: number, anchor?: { ax: number; ay: number }) => applyZoom(zoom * factor, anchor),
    [applyZoom, zoom],
  );

  // Fit: the whole diagram inside the frame, never above 100% — the natural
  // size is the rendered box divided by the zoom it was measured under.
  const fit = useCallback(() => {
    const el = scrollRef.current;
    const svgEl = el?.querySelector('svg');
    if (!el || !svgEl) return;
    const box = svgEl.getBoundingClientRect();
    const w = box.width / zoom;
    const h = box.height / zoom;
    if (!(w > 0 && h > 0)) return;
    const next = Math.min(1, el.clientWidth / w, el.clientHeight / h);
    pendingAnchor.current = null;
    setZoom(clampZoom(Math.floor(next * 100) / 100));
    el.scrollTo({ left: 0, top: 0 });
  }, [zoom]);

  // ⌘/Ctrl + wheel (and pinch) zooms toward the cursor instead of scrolling
  // the page. A native listener registered non-passive: React attaches
  // `wheel` passively, so `preventDefault` from an `onWheel` prop is ignored.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !zoomable) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // Exponential in deltaY: a wheel notch is one step, a pinch is smooth.
      applyZoom(zoom * Math.exp(-e.deltaY * 0.0025), { ax: e.clientX - rect.left, ay: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // `svg` is a dependency on purpose: the scroll container mounts with the diagram.
  }, [zoomable, svg, zoom, applyZoom]);

  // Drag to pan — scrolls the frame, so the scrollbars, the wheel and the
  // keyboard stay the source of truth for the position. Mouse and pen only:
  // a finger already pans a scroll region natively.
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomable || e.button !== 0 || e.pointerType === 'touch') return;
    const el = scrollRef.current;
    if (!el) return;
    // The default action of a press on text is to start a selection — the
    // one thing a pan must never do. Focus is restored by hand below.
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture?.(e.pointerId);
    el.focus({ preventScroll: true });
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = scrollRef.current;
    if (!d || !el) return;
    el.scrollLeft = d.left - (e.clientX - d.x);
    el.scrollTop = d.top - (e.clientY - d.y);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    scrollRef.current?.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!zoomable || !svg) return;
    if (e.key === '+' || e.key === '=') zoomBy(MERMAID_ZOOM_STEP);
    else if (e.key === '-') zoomBy(1 / MERMAID_ZOOM_STEP);
    else if (e.key === '0') applyZoom(1);
    else if (e.key === 'f' || e.key === 'F') fit();
    else return;
    e.preventDefault();
  };
  // `useSyncExternalStore` hydration gate rather than the `useState(false)` +
  // `useEffect(setMounted)` idiom — same one extra render, no setState inside
  // an effect body.
  const mounted = useIsHydrated();

  useEffect(() => {
    // This effect re-runs on every `chart` change, and during STREAMING the
    // chart text grows chunk by chunk — so several `mermaid.render` calls are
    // in flight at once. Without this flag a slower EARLIER render can resolve
    // last and overwrite the newer output (or paint an error for a chart that
    // is no longer displayed). The timeout above bounds that window at 15s but
    // cannot close it: `Promise.race` rejects, it does not abort the render.
    let cancelled = false;
    const renderId = `mermaid-${(mermaidRenderSeq += 1)}`;

    // Nothing to draw yet (a host whose chart is still loading, a stream that
    // has not produced its first token): never ask mermaid to parse an empty
    // string — that is an "UnknownDiagramError" it would paint as a failure.
    // The render below shows the skeleton for an empty chart on its own.
    if (empty) {
      return () => {
        cancelled = true;
      };
    }

    const renderMermaid = async () => {
      try {
        setIsLoading(true);
        // `mermaid` is a declared `dependencies` entry and ships its own
        // types, so this specifier resolves — the suppression that used to sit
        // here (`@ts-ignore`, justified as "optional runtime dependency") was
        // dead AND factually wrong. It is kept as a DYNAMIC import purely for
        // bundle size: neither the chat nor the content bundle should pay for
        // mermaid unless a diagram actually renders. Import failures surface
        // through the surrounding try/catch as the diagram error state.
        const { default: mermaid } = await import('mermaid');

        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark' as const,
          // eslint-disable-next-line multipla-002/no-hardcoded-colors -- ODS-TOKENS FLAG: mermaid `themeVariables` is baked into SVG attribute strings, not CSS — `var()` does not resolve here. See file-level exemption note above.
          themeVariables: {
            primaryColor: '#FFC008',
            primaryTextColor: '#FAFAFA',
            primaryBorderColor: '#3A3A3A',
            lineColor: '#888888',
            secondaryColor: '#212121',
            tertiaryColor: '#2A2A2A',
            background: 'transparent',
            mainBkg: 'transparent',
            secondBkg: 'transparent',
            tertiaryBkg: 'transparent',
            cScale0: '#FFC008',
            cScale1: '#4ECDC4',
            cScale2: '#45B7D1',
            cScale3: '#96CEB4',
            cScale4: '#FFEAA7',
            cScale5: '#DDA0DD',
            cScale6: '#98D8C8',
            cScale7: '#F7DC6F',
            cScale8: '#BB8FCE',
            cScale9: '#85C1E9',
            taskTextColor: '#FAFAFA',
            taskTextOutsideColor: '#FAFAFA',
            activeTaskTextColor: '#1A1A1A',
            nodeTextColor: '#FAFAFA',
          },
          flowchart: { useMaxWidth: true, rankSpacing: 50, nodeSpacing: 30, curve: 'basis' },
          sequence: { useMaxWidth: true, width: 150 },
          pie: { useMaxWidth: true, useWidth: undefined },
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          // SECURITY: single source of truth, shared with the fixture.
          // See MERMAID_SECURITY_OPTIONS above and
          // ./__tests__/mermaid-security.test.ts.
          ...MERMAID_SECURITY_OPTIONS,
        });

        const { svg: renderedSvg } = await withRenderTimeout(
          mermaid.render(renderId, chart),
          MERMAID_RENDER_TIMEOUT_MS,
        );
        if (cancelled) return;
        setSvg(renderedSvg);
        // A new diagram starts at 100%, top-left — zoom is per diagram, not per host.
        pendingAnchor.current = null;
        setZoom(1);
        // CLEAR the previous failure. The render body checks `error` BEFORE
        // `svg`, so a stale message pins the "Diagram Error" card forever and
        // the diagram that just rendered successfully never appears. Transient
        // failures are ROUTINE on this component's own hot path: every
        // streaming frame re-renders a partial chart, and a partial chart is a
        // mermaid parse error until the closing tokens arrive.
        setError('');
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Mermaid rendering error:', err);
        setError(`Failed to render diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    if (mounted) {
      // Never rejects — try/catch, every write gated on `cancelled`.
      void renderMermaid();
    }
    return () => {
      cancelled = true;
      // An abandoned render (superseded chart, or one wedged past the timeout)
      // keeps mermaid's temporary `#d<id>` working container attached to
      // <body> forever, since mermaid only removes it on a successful finish.
      // Cheap to reap here because the id is ours. If the render is still live
      // it will fail on the missing node — caught, and discarded by `cancelled`.
      document.getElementById(`d${renderId}`)?.remove();
      document.getElementById(renderId)?.remove();
    };
  }, [chart, empty, mounted]);

  // `safe center` on both axes: a zoomed diagram larger than the frame scrolls
  // from its top-left corner instead of losing those edges to flex centering.
  const frameClass = `${FRAME_CLASS[frame]} flex w-full overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-ods-accent ${
    zoomable && svg ? `mermaid-frame-pan select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}` : ''
  }`;
  const frameStyle = { justifyContent: 'safe center', alignItems: 'safe center' } as const;
  const body =
    error && !empty ? (
      <div className="error-state m-auto rounded-lg border border-ods-border bg-ods-card p-6">
        <div className="error-icon mb-4 flex justify-center">
          <AlertCircleIcon className="h-12 w-12 text-ods-error" />
        </div>
        <div className="error-title mb-2 text-center font-sans text-lg font-semibold text-ods-error">Diagram Error</div>
        <div className="error-description mb-4 max-w-full overflow-hidden break-words text-center font-sans text-sm text-ods-text-secondary">
          <div className="overflow-x-auto">
            <pre className="whitespace-pre-wrap break-words text-xs">{error}</pre>
          </div>
        </div>
      </div>
    ) : empty || isLoading || !svg ? (
      <div className="skeleton-code m-auto animate-pulse font-sans text-ods-text-tertiary">
        {isLoading ? 'Loading diagram renderer...' : 'Rendering diagram...'}
      </div>
    ) : (
      <div
        className="mermaid-svg-container flex shrink-0 justify-center"
        // The class is a styling hook for the injected SVG (see the <style>
        // block above); the test id is the stable handle for "which SVG is
        // mounted right now", which the stale-render guard has to assert on.
        data-testid="mermaid-svg-container"
        data-zoom={zoom}
        style={{
          fontSize: '14px',
          zoom,
          width: naturalWidth ? `min(${naturalWidth}px, calc(100% * ${zoom}))` : '100%',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );

  return (
    <div className="mermaid-container relative my-6 rounded-lg border border-ods-border bg-ods-card p-4 md:p-6 lg:p-8">
      {/* Scoped to `.mermaid-svg-container`, so it only needs to exist when a
          diagram is actually mounted. The engine used to emit this once per
          instance — i.e. once per chat segment, almost never with a diagram. */}
      <style dangerouslySetInnerHTML={{ __html: mermaidStyles }} />
      {zoomable && (
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-[var(--spacing-system-xxs)] rounded-md bg-ods-card"
          role="group"
          aria-label="Diagram zoom"
        >
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            title="Zoom out (−, ⌘/Ctrl + wheel)"
            disabled={!svg || zoom <= MERMAID_ZOOM_MIN}
            onClick={() => zoomBy(1 / MERMAID_ZOOM_STEP)}
          >
            <ZoomOut />
          </Button>
          <Button
            variant="outline"
            size="compact"
            aria-label="Reset zoom"
            title="Back to 100% (0)"
            disabled={!svg || zoom === 1}
            onClick={() => applyZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            title="Zoom in (+, ⌘/Ctrl + wheel)"
            disabled={!svg || zoom >= MERMAID_ZOOM_MAX}
            onClick={() => zoomBy(MERMAID_ZOOM_STEP)}
          >
            <ZoomIn />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Fit to frame"
            title="Fit the whole diagram in the frame (f)"
            disabled={!svg}
            onClick={fit}
          >
            <Maximize2 />
          </Button>
        </div>
      )}
      {/* The frame: the scroll region, the pan surface and the keyboard target. */}
      <div
        ref={scrollRef}
        className={frameClass}
        style={frameStyle}
        data-testid="mermaid-frame"
        data-frame={frame}
        tabIndex={zoomable && svg ? 0 : -1}
        role={zoomable && svg ? 'region' : undefined}
        aria-label={
          zoomable && svg
            ? 'Diagram. Drag to pan; Ctrl or Cmd plus wheel, or + and -, to zoom; 0 resets; f fits.'
            : undefined
        }
        title={zoomable && svg ? 'Drag to pan · ⌘/Ctrl + wheel to zoom' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {body}
      </div>
    </div>
  );
};
