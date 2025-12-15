"use client";

import React from 'react';
import { cn } from '../../utils/cn';
import { ClaudeIcon } from '../icons/claude-icon';
import { OpenAiIcon } from '../icons/openai-icon';
import { GoogleGeminiIcon } from '../icons/google-gemini-icon';

export interface ModelDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  provider?: string;
  modelName?: string;
  displayName?: string;
}

const getProviderIcon = (provider?: string) => {
  if (!provider) return null;
  
  const providerLower = provider.toLowerCase();
  
  switch (providerLower) {
    case 'anthropic':
    case 'claude':
      return <ClaudeIcon className="w-4 h-4" />;
    case 'openai':
      return <OpenAiIcon size={16} color="currentColor" />;
    case 'google':
    case 'gemini':
    case 'google-gemini':
    case 'google_gemini':
      return <GoogleGeminiIcon size={16} />;
    default:
      return null;
  }
};

const ModelDisplay = React.forwardRef<HTMLDivElement, ModelDisplayProps>(
  ({ className, provider, modelName, displayName, ...props }, ref) => {
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
      </div>
    );
  }
);

ModelDisplay.displayName = "ModelDisplay";

export { ModelDisplay };