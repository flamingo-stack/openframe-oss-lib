"use client";

/**
 * Single MermaidDiagram for the unified markdown engine (dark theme only —
 * the old RichMarkdownRenderer's light-theme branch was dead code behind a
 * hardcoded `isDarkMode = true` and is deleted, not carried over).
 *
 * `mermaid` stays a dynamic import so neither chat nor content bundles pay
 * for it unless a diagram is actually rendered.
 */
import React, { useEffect, useState } from 'react';
import type { MermaidConfig } from 'mermaid';
import { AlertCircleIcon } from '../../icons-v2-generated';

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
  secure: ['securityLevel', 'htmlLabels', 'secure', 'startOnLoad', 'maxTextSize', 'maxEdges'],
} satisfies Pick<MermaidConfig, 'htmlLabels' | 'securityLevel' | 'secure'>;

/** Upper bound on a single `mermaid.render`. Generous enough that no honest
 *  diagram hits it; short enough that a wedged render becomes a visible error
 *  instead of a permanent skeleton. */
export const MERMAID_RENDER_TIMEOUT_MS = 15_000;

/** `Promise.race` with a rejecting timer, timer always cleared. Kept local —
 *  the only caller is the render below. */
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
 * Scope: this exemption covers THIS file only, and only the mermaid config
 * surface. Do NOT copy this pattern — every other style in the markdown
 * module uses ODS semantic classes.
 */
export const mermaidStyles = `
  .mermaid-svg-container svg {
    max-width: 100% !important;
    height: auto !important;
    min-height: 200px;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 14px !important;
  }
  @media (min-width: 1520px) {
    .mermaid-svg-container svg {
      max-width: 900px !important;
      max-height: 700px !important;
      min-height: 300px;
      font-size: 16px !important;
    }
  }
  @media (min-width: 768px) and (max-width: 1519px) {
    .mermaid-svg-container svg {
      max-width: 700px !important;
      max-height: 600px !important;
      min-height: 250px;
      font-size: 15px !important;
    }
  }
  @media (max-width: 767px) {
    .mermaid-svg-container svg {
      max-width: 90vw !important;
      max-height: 400px !important;
      min-height: 200px;
      font-size: 13px !important;
    }
  }
  .mermaid-svg-container svg[width] { width: 100% !important; }
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

/** Monotonic render id. `Date.now()` was ambiguous: two renders started in the
 *  same millisecond (routine while a diagram streams in) share an id, and
 *  mermaid removes any pre-existing element with that id at the start of a
 *  render — so one render would delete the other's working container. */
let mermaidRenderSeq = 0;

export const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // This effect re-runs on every `chart` change, and during STREAMING the
    // chart text grows chunk by chunk — so several `mermaid.render` calls are
    // in flight at once. Without this flag a slower EARLIER render can resolve
    // last and overwrite the newer output (or paint an error for a chart that
    // is no longer displayed). The timeout above bounds that window at 15s but
    // cannot close it: `Promise.race` rejects, it does not abort the render.
    let cancelled = false;
    const renderId = `mermaid-${(mermaidRenderSeq += 1)}`;

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
            cScale0: '#FFC008', cScale1: '#4ECDC4', cScale2: '#45B7D1',
            cScale3: '#96CEB4', cScale4: '#FFEAA7', cScale5: '#DDA0DD',
            cScale6: '#98D8C8', cScale7: '#F7DC6F', cScale8: '#BB8FCE',
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
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Mermaid rendering error:', err);
        setError(`Failed to render diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    if (mounted) { renderMermaid(); }
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
  }, [chart, mounted]);

  if (error) {
    return (
      <div className="error-state bg-ods-card border border-ods-border rounded-lg p-6 my-6">
        <div className="error-icon flex justify-center mb-4">
          <AlertCircleIcon className="w-12 h-12 text-ods-error" />
        </div>
        <div className="error-title text-center font-sans font-semibold text-lg text-ods-error mb-2">
          Diagram Error
        </div>
        <div className="error-description text-center font-sans text-sm text-ods-text-secondary mb-4 break-words overflow-hidden max-w-full">
          <div className="overflow-x-auto">
            <pre className="whitespace-pre-wrap break-words text-xs">{error}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !svg) {
    return (
      <div className="skeleton-code bg-ods-card border border-ods-border rounded-lg p-6 min-h-[120px] flex items-center justify-center">
        <div className="animate-pulse text-ods-text-tertiary font-sans">
          {isLoading ? 'Loading diagram renderer...' : 'Rendering diagram...'}
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-container rounded-lg p-4 md:p-6 lg:p-8 my-6 overflow-x-auto bg-ods-card border border-ods-border">
      {/* Scoped to `.mermaid-svg-container`, so it only needs to exist when a
          diagram is actually mounted. The engine used to emit this once per
          instance — i.e. once per chat segment, almost never with a diagram. */}
      <style dangerouslySetInnerHTML={{ __html: mermaidStyles }} />
      <div className="flex justify-center items-center w-full min-h-[200px] md:min-h-[250px] lg:min-h-[300px]">
        <div
          className="mermaid-svg-container w-full flex justify-center max-w-full"
          style={{ fontSize: '14px' }}
          dangerouslySetInnerHTML={{
            __html: svg.replace(/<svg[^>]*>/, (match) =>
              match.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="auto"')
            ),
          }}
        />
      </div>
    </div>
  );
};
