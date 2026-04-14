"use client";

import React from 'react';
import { cn } from '../../utils/cn';
import type { ModelDisplayProps } from './types';
import { AnthropicLogoGreyIcon, GeminiLogoGreyIcon, OpenaiLogoGreyIcon } from '../icons-v2-generated';

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

const ModelDisplay = React.forwardRef<HTMLDivElement, ModelDisplayProps>(
  ({ className, provider, modelName, displayName, usedTokens, contextWindow, ...props }, ref) => {
    const icon = getProviderIcon(provider);
    const name = displayName || modelName;

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-1 text-ods-text-secondary",
          "text-sm",
          className
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
        {usedTokens != null && contextWindow != null && (
          <span className="font-dm-sans text-xs opacity-70 ml-auto">
            {formatTokenCount(usedTokens)}/{formatTokenCount(contextWindow)} tokens used
          </span>
        )}
      </div>
    );
  }
);

ModelDisplay.displayName = "ModelDisplay";

export { ModelDisplay };