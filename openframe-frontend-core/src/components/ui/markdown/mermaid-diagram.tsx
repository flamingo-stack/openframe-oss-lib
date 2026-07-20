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
import { AlertCircleIcon } from '../../icons-v2-generated';

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

export const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
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
          flowchart: { useMaxWidth: true, htmlLabels: true, rankSpacing: 50, nodeSpacing: 30, curve: 'basis' },
          sequence: { useMaxWidth: true, width: 150 },
          pie: { useMaxWidth: true, useWidth: undefined },
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          securityLevel: 'loose',
        });

        const { svg: renderedSvg } = await mermaid.render(`mermaid-${Date.now()}`, chart);
        setSvg(renderedSvg);
        setIsLoading(false);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(`Failed to render diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    if (mounted) { renderMermaid(); }
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
