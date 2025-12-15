"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

interface SimpleMarkdownRendererProps {
  content: string;
  className?: string;
}

export const SimpleMarkdownRenderer: React.FC<SimpleMarkdownRendererProps> = ({ 
  content, 
  className = ""
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize components to prevent React from losing event handlers
  const components = useMemo(() => ({
    // Custom code renderer
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!inline && match) {
        return (
          <div className="code-block-container border rounded-lg my-6 overflow-hidden bg-ods-card border-ods-border">
            <div className="code-header border-b px-4 py-2 bg-ods-card border-ods-border">
              <span className="font-sans text-xs uppercase tracking-wide text-ods-text-tertiary">
                {language || 'code'}
              </span>
            </div>
            <div className="p-4 overflow-hidden">
              <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                <code 
                  className={`language-${language} hljs`}
                  style={{
                    fontSize: '14px',
                    fontFamily: "JetBrains Mono', 'SF Mono', Consolas, monospace",
                    background: 'transparent',
                    color: 'var(--ods-text-primary)',
                    wordBreak: 'break-all',
                    overflowWrap: 'anywhere'
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
          className="font-mono text-[0.9em] px-1.5 py-0.5 rounded border bg-ods-card text-ods-text-primary border-ods-border"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Style blockquotes
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-ods-accent ml-0 pl-6 my-8 py-4 rounded-r-lg bg-ods-bg-secondary">
        <div className="font-sans text-[1.125em] leading-relaxed text-ods-text-secondary">
          {children}
        </div>
      </blockquote>
    ),

    // Style headings
    h1: ({ children }: any) => (
      <h1 className="font-sans font-bold text-[24px] md:text-[28px] leading-[1.25] mt-6 mb-3 first:mt-0 text-ods-text-primary">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="font-sans font-semibold text-[20px] md:text-[24px] mt-5 mb-3 pb-1 border-b text-ods-text-primary border-ods-border">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="font-sans font-semibold text-[18px] md:text-[20px] mt-4 mb-2 text-ods-text-primary">
        {children}
      </h3>
    ),

    // Style paragraphs
    p: ({ children }: any) => (
      <p className="font-dm-sans text-[18px] font-normal leading-[24px] my-3 break-words overflow-wrap-anywhere text-ods-text-primary">
        {children}
      </p>
    ),

    // Style links
    a: ({ href, children }: any) => (
      <a
        href={href}
        className="text-ods-accent no-underline relative transition-colors duration-200 hover:after:w-full after:content-[''] after:absolute after:w-0 after:h-0.5 after:-bottom-0.5 after:left-0 after:bg-ods-accent after:transition-all after:duration-300 break-all"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    ),

    // Style lists
    ul: ({ children }: any) => (
      <ul className="list-disc list-outside my-3 ml-6 space-y-1 text-ods-text-primary">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-outside my-3 ml-6 space-y-1 text-ods-text-primary">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="text-[18px] leading-relaxed pl-1">
        {children}
      </li>
    ),

    // Style horizontal rules
    hr: () => (
      <hr className="border-0 border-t my-6 border-ods-border" />
    ),
  }), []);

  // Show loading state during hydration to prevent mismatch
  if (!mounted) {
    return (
      <div className={`simple-markdown-renderer ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-ods-bg-secondary rounded mb-2"></div>
          <div className="h-4 bg-ods-bg-secondary rounded mb-2"></div>
          <div className="h-4 bg-ods-bg-secondary rounded mb-2 w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`simple-markdown-renderer ${className} w-full overflow-hidden`}>
      <div className="content-wrapper max-w-none min-w-0">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[
            rehypeRaw, 
            [rehypeHighlight, { 
              detect: true,
              ignoreMissing: true
            }]
          ]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};