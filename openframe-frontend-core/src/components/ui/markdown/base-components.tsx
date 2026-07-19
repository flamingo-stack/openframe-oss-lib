"use client";

/**
 * Default react-markdown component map for the unified markdown engine.
 * ONE implementation of code blocks, headings, links, lists, tables etc.
 * Compositions layer on top via `componentOverrides` (spread LAST by the
 * engine, so caller overrides always win).
 */
import React from 'react';
import type { Components } from 'react-markdown';
import Image from '../../../embed-shims/next-image';
import { cn } from '../../../utils/cn';
import type { ResolveLinkResult } from '../../../types/doc-source';
import type { TextSizeElement } from './text-size';
import { MermaidDiagram } from './mermaid-diagram';
import { isImageSrcAllowed, type MarkdownUrlPolicy } from './sanitize';
import { extractText } from './heading-ids';

export interface BuildBaseComponentsOptions {
  textSizes: Record<TextSizeElement, string>;
  generateHeadingId: (text: string, level: number) => string;
  demoteMarkdownH1ToH2: boolean;
  brokenLinks: string[];
  currentPath?: string;
  onInternalLinkClick?: (path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => void;
  onResolveLink?: (href: string, currentPath: string) => Promise<ResolveLinkResult>;
  urlPolicy?: MarkdownUrlPolicy;
}

export function buildBaseComponents({
  textSizes,
  generateHeadingId,
  demoteMarkdownH1ToH2,
  brokenLinks,
  currentPath: propCurrentPath,
  onInternalLinkClick,
  onResolveLink,
  urlPolicy,
}: BuildBaseComponentsOptions): Components {
  const makeHeading = (
    Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
    level: number,
    headingClassName: string,
  ) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children }: any) => {
      const text = extractText(children);
      const effectiveLevel = Tag === 'h1' && demoteMarkdownH1ToH2 ? 2 : level;
      const id = generateHeadingId(text, effectiveLevel);
      const EffectiveTag = Tag === 'h1' && demoteMarkdownH1ToH2 ? 'h2' : Tag;
      return <EffectiveTag id={id} className={headingClassName}>{children}</EffectiveTag>;
    };

  return {
    // --- code ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: ({ node, inline, className: codeClassName, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';

      if (!inline && language === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
      }

      if (!inline && match) {
        return (
          <div className="code-block-container border rounded-lg my-6 overflow-hidden bg-ods-card border-ods-border">
            <div className="code-header border-b px-4 py-2 bg-ods-card border-ods-border">
              <span className="font-sans text-xs uppercase tracking-wide text-ods-text-tertiary">
                {language || 'code'}
              </span>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto">
                <code
                  className={cn(`language-${language} hljs`, textSizes.code)}
                  style={{
                    fontFamily: "JetBrains Mono', 'SF Mono', Consolas, monospace",
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
        <code className="font-mono text-[0.9em] px-1.5 py-0.5 rounded border bg-ods-card text-ods-text-primary border-ods-border" {...props}>
          {children}
        </code>
      );
    },

    // --- div (pass-through, overridable for embeds) ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ node, className: divClassName, children, ...props }: any) => (
      <div className={divClassName} {...props}>{children}</div>
    ),

    // --- blockquote ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-ods-accent ml-0 pl-6 my-8 py-4 rounded-r-lg bg-ods-bg-surface">
        <div className={cn('font-sans leading-relaxed text-ods-text-secondary', textSizes.blockquote)}>
          {children}
        </div>
      </blockquote>
    ),

    // --- headings ---
    h1: makeHeading('h1', 1, cn('font-sans font-bold mt-8 mb-4 first:mt-0 text-ods-text-primary', textSizes.h1)),
    h2: makeHeading('h2', 2, cn('font-sans font-semibold mt-8 mb-4 pb-2 border-b text-ods-text-primary border-ods-border', textSizes.h2)),
    h3: makeHeading('h3', 3, cn('font-sans font-semibold mt-6 mb-3 text-ods-text-primary', textSizes.h3)),
    h4: makeHeading('h4', 4, cn('font-sans font-semibold mt-4 mb-2 text-ods-text-primary', textSizes.h4)),
    h5: makeHeading('h5', 5, cn('font-sans font-semibold mt-3 mb-2 text-ods-text-primary', textSizes.h5)),
    h6: makeHeading('h6', 6, cn('font-sans font-semibold mt-3 mb-1 text-ods-text-primary', textSizes.h6)),

    // --- paragraph ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p: ({ children }: any) => (
      <p className={cn('leading-relaxed mb-4 first:mt-0 last:mb-0 text-ods-text-primary', textSizes.p)}>
        {children}
      </p>
    ),

    // --- links ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    a: ({ href, children, className: linkClassName }: any) => {
      const isBroken = brokenLinks.includes(href);
      const isInternalDocLink =
        propCurrentPath !== undefined &&
        propCurrentPath !== null &&
        href &&
        !href.startsWith('http') &&
        !href.startsWith('#');

      if (isBroken) {
        return (
          <span className="text-ods-accent cursor-not-allowed">
            {children}
            <sup className="ml-1 text-xs font-bold text-ods-error">[BROKEN]</sup>
          </span>
        );
      }

      if (isInternalDocLink && onInternalLinkClick) {
        const currentPath = propCurrentPath ?? '';
        return (
          <span
            className="text-ods-accent no-underline relative transition-colors duration-200 hover:after:w-full after:content-[''] after:absolute after:w-0 after:h-0.5 after:-bottom-0.5 after:left-0 after:bg-ods-accent after:transition-all after:duration-300 cursor-pointer"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onResolveLink) {
                try {
                  const result = await onResolveLink(href, currentPath);
                  if (result.type === 'folder-no-readme' && result.action === 'expand_folder') {
                    onInternalLinkClick(result.resolvedPath!, { expandFolder: true, fromInternalLink: true });
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                (e.currentTarget as HTMLElement).click();
              }
            }}
          >
            {children}
          </span>
        );
      }

      return (
        <a
          href={href}
          className={`text-ods-accent no-underline relative transition-colors duration-200 hover:after:w-full after:content-[''] after:absolute after:w-0 after:h-0.5 after:-bottom-0.5 after:left-0 after:bg-ods-accent after:transition-all after:duration-300 ${linkClassName || ''}`}
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },

    // --- images ---
    // Inline content image renderer (blog, docs, chat attachments).
    // CAP at 400x400 with natural-size rendering for small images —
    // click-to-expand surfaces provide full resolution. Next.js <Image>
    // via the embed shim gives WebP/AVIF + lazy-loading on Next hosts and
    // a plain <img> elsewhere. The `urlPolicy` gate is the LLM-surface
    // exfiltration defense — evaluated only on completed URL tokens.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    img: ({ src, alt }: any) => {
      if (!src || typeof src !== 'string' || src.trim() === '') return null;
      if (!isImageSrcAllowed(src, urlPolicy)) {
        if (urlPolicy?.onBlockedUrl === 'placeholder') {
          return (
            <span className="inline-block rounded border border-ods-border bg-ods-card px-2 py-1 text-xs text-ods-text-tertiary">
              image blocked: external origin
            </span>
          );
        }
        return null;
      }
      return (
        <Image
          src={src}
          alt={alt ?? 'No image available'}
          width={400}
          height={400}
          sizes="(max-width: 400px) 100vw, 400px"
          className="max-w-full max-h-[400px] w-auto h-auto rounded-lg object-contain"
          style={{ width: 'auto', height: 'auto' }}
        />
      );
    },

    // --- lists ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ul: ({ children }: any) => (
      <ul className="list-disc list-outside my-4 ml-8 space-y-2 text-ods-text-primary">{children}</ul>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ol: ({ children }: any) => (
      <ol className="list-decimal list-outside my-4 ml-8 space-y-2 text-ods-text-primary">{children}</ol>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    li: ({ children }: any) => (
      <li className={cn('leading-relaxed pl-2', textSizes.li)}>{children}</li>
    ),

    // --- tables ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: ({ children }: any) => (
      <div className="table-container my-6 overflow-x-auto">
        <div className="min-w-full border rounded-lg border-ods-border bg-ods-card">
          <table className="w-full table-fixed md:table-auto">{children}</table>
        </div>
      </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thead: ({ children }: any) => (
      <thead className="bg-ods-bg-surface">{children}</thead>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    th: ({ children }: any) => (
      <th className={cn('px-2 md:px-4 py-3 text-left font-semibold text-ods-accent border-r last:border-r-0 break-words border-ods-border', textSizes.th)}>
        {children}
      </th>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    td: ({ children }: any) => (
      <td className={cn('px-2 md:px-4 py-3 border-r last:border-r-0 border-b break-words whitespace-normal text-ods-text-primary border-ods-border', textSizes.td)}>
        {children}
      </td>
    ),

    // --- horizontal rule ---
    hr: () => <hr className="border-0 border-t my-8 border-ods-border" />,
  };
}
