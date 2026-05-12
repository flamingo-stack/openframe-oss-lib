"use client";

import React from 'react';
import { cn } from '../../utils/cn';
import type { ModelDisplayProps, ModelUsageBreakdown } from './types';
import { AnthropicLogoGreyIcon, GeminiLogoGreyIcon, OpenaiLogoGreyIcon } from '../icons-v2-generated';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../hover-card';

const getProviderIcon = (provider?: string) => {
  if (!provider) return null;

  const providerLower = provider.toLowerCase();

  switch (providerLower) {
    case 'anthropic':
    case 'claude':
      return <AnthropicLogoGreyIcon className="w-4 h-4" />;
    case 'openai':
      return <OpenaiLogoGreyIcon size={16} color="currentColor" />;
    case 'google':
    case 'gemini':
    case 'google-gemini':
    case 'google_gemini':
      return <GeminiLogoGreyIcon size={16} />;
    default:
      return null;
  }
};

const formatTokenCount = (count: number): string => {
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return Number.isInteger(val) ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return Number.isInteger(val) ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return String(count);
};

const hasAnyBreakdownRow = (breakdown?: ModelUsageBreakdown): boolean =>
  !!breakdown && !!(breakdown.haikuRewriter || breakdown.haikuClassifier || breakdown.haikuSummarizer);

const ModelDisplay = React.forwardRef<HTMLDivElement, ModelDisplayProps>(
  (
    {
      className,
      provider,
      modelName,
      displayName,
      usedTokens,
      contextWindow,
      breakdown,
      hitRatePct,
      inputTokens,
      outputTokens,
      ...props
    },
    ref,
  ) => {
    const icon = getProviderIcon(provider);
    const name = displayName || modelName;

    // Inline pill: provider icon + model name + "X / Y tokens used".
    // The "tokens used" tail renders as soon as `contextWindow` is known
    // (typically from the leading metadata frame). `usedTokens` lags by a
    // tick — it only becomes non-null after the first `message_start`
    // usage frame. Showing "— / 200K tokens used" early gives users the
    // model's capacity context without waiting for the first byte.
    const inline = (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-1 text-ods-text-secondary',
          'text-sm',
          className,
        )}
        {...props}
      >
        {icon && (
          <span className="flex items-center justify-center">
            {icon}
          </span>
        )}
        <span className="font-dm-sans font-medium">
          {name}
        </span>
        {contextWindow != null && (
          <span className="font-dm-sans text-xs opacity-70 ml-auto">
            {usedTokens != null ? formatTokenCount(usedTokens) : '—'}/{formatTokenCount(contextWindow)} tokens used
          </span>
        )}
      </div>
    );

    // Without a breakdown there's no story to tell on hover — return the
    // bare inline so we don't add a stray pointer cursor / accessibility
    // chrome on chat surfaces that don't capture cross-call usage.
    if (!hasAnyBreakdownRow(breakdown)) return inline;

    return (
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div className="cursor-help">{inline}</div>
        </HoverCardTrigger>
        <HoverCardContent
          className={cn(
            'w-80 p-3',
            'bg-ods-card border-ods-border text-ods-text-primary',
          )}
          align="end"
          sideOffset={6}
        >
          <div className="font-dm-sans text-xs font-semibold text-ods-text-primary mb-2">
            Token breakdown
          </div>
          {/* Answer-call row — uses the SAME pretty model name as the
              inline pill, plus the input/output split that doesn't fit
              in the inline view. */}
          <BreakdownRow
            label={`Answer (${name ?? 'model'})`}
            input={inputTokens}
            output={outputTokens}
            isAnswer
          />
          {breakdown!.haikuRewriter && (
            <BreakdownRow
              label="Query rewriter (Haiku)"
              input={breakdown!.haikuRewriter.input}
              output={breakdown!.haikuRewriter.output}
            />
          )}
          {breakdown!.haikuClassifier && (
            <BreakdownRow
              label="Intent classifier (Haiku)"
              input={breakdown!.haikuClassifier.input}
              output={breakdown!.haikuClassifier.output}
            />
          )}
          {breakdown!.haikuSummarizer && (
            <BreakdownRow
              label="History summarizer (Haiku)"
              input={breakdown!.haikuSummarizer.input}
              output={breakdown!.haikuSummarizer.output}
            />
          )}
          {typeof hitRatePct === 'number' && hitRatePct > 0 && (
            <div className="mt-2 pt-2 border-t border-ods-border font-dm-sans text-xs text-ods-text-secondary">
              Prompt-cache hit: {hitRatePct}% of answer input
            </div>
          )}
        </HoverCardContent>
      </HoverCard>
    );
  },
);

function BreakdownRow({
  label,
  input,
  output,
  isAnswer,
}: {
  label: string;
  input?: number;
  output?: number;
  isAnswer?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 font-dm-sans text-xs">
      <span
        className={cn(
          'text-ods-text-secondary',
          isAnswer && 'text-ods-text-primary font-medium',
        )}
      >
        {label}
      </span>
      <span className="text-ods-text-secondary tabular-nums">
        {input != null ? formatTokenCount(input) : '—'} in / {output != null ? formatTokenCount(output) : '—'} out
      </span>
    </div>
  );
}

ModelDisplay.displayName = 'ModelDisplay';

export { ModelDisplay };
