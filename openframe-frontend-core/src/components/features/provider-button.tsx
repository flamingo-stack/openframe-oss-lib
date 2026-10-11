'use client';

import { createElement, useState } from 'react';
import type { MouseEvent } from 'react';
import { requireIcon, type IconRef } from '../chat/utils/icon-loading';
import { Button } from '../ui/button';

interface ProviderButtonProps {
  provider: 'microsoft' | 'google' | 'slack' | 'github' | 'apple';
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  loading?: boolean;
}

/** Each provider's label and the NAME of its mark: the mark is loaded when the button is drawn. */
const PROVIDER_CONFIG: Record<ProviderButtonProps['provider'], { displayName: string; icon: IconRef }> = {
  microsoft: {
    displayName: 'Continue with Microsoft',
    icon: { set: 'MicrosoftIcon' },
  },
  google: {
    displayName: 'Continue with Google',
    icon: { set: 'GoogleLogoClassicIcon' },
  },
  slack: {
    displayName: 'Continue with Slack',
    icon: { set: 'SlackIcon' },
  },
  github: {
    displayName: 'Continue with GitHub',
    icon: { set: 'GithubClassicIcon' },
  },
  apple: {
    displayName: 'Continue with Apple',
    icon: { set: 'AppleClassicIcon' },
  },
};

export function ProviderButton({ provider, onClick, disabled = false, loading = false }: ProviderButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const config = PROVIDER_CONFIG[provider];

  // Use external loading state if provided, otherwise use internal state
  const isLoading = loading || internalLoading;

  const handleClick = async (e: MouseEvent) => {
    // Prevent the click from bubbling up to parent elements (like modal backdrop)
    e.stopPropagation();
    e.preventDefault();

    if (disabled || isLoading) {
      return;
    }

    try {
      // Only set internal loading if no external loading is managed
      if (!loading) {
        setInternalLoading(true);
      }
      await onClick();
    } catch (error) {
      console.error(`${provider} sign-in error:`, error);
    } finally {
      if (!loading) {
        setInternalLoading(false);
      }
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      variant="outline"
      size="default"
      leftIcon={isLoading ? null : createElement(requireIcon(config.icon), { className: 'h-5 w-5' })}
      className={`h-[56px] w-full !font-bold !text-h6 hover:bg-ods-bg-hover content-md:!w-full ${isLoading ? 'cursor-wait' : 'cursor-pointer'} `}
      aria-label={config.displayName}
    >
      {isLoading ? 'Signing in...' : config.displayName}
    </Button>
  );
}
