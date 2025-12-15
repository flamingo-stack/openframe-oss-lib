"use client";

import { useState } from 'react';
import { Button } from "../ui/button";
import { MicrosoftIcon, GoogleLogo, SlackIcon, GitHubIcon } from "../icons";

interface ProviderButtonProps {
  provider: 'microsoft' | 'google' | 'slack' | 'github';
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  loading?: boolean;
}

const PROVIDER_CONFIG = {
  microsoft: {
    displayName: 'Continue with Microsoft',
    icon: MicrosoftIcon,
  },
  google: {
    displayName: 'Continue with Google',
    icon: GoogleLogo,
  },
  slack: {
    displayName: 'Continue with Slack',
    icon: SlackIcon,
  },
  github: {
    displayName: 'Continue with GitHub',
    icon: GitHubIcon,
  },
};

export function ProviderButton({ provider, onClick, disabled = false, loading = false }: ProviderButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const config = PROVIDER_CONFIG[provider];
  const IconComponent = config.icon;

  // Use external loading state if provided, otherwise use internal state
  const isLoading = loading || internalLoading;

  const handleClick = async (e: React.MouseEvent) => {
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
      size="lg"
      leftIcon={isLoading ? null : <IconComponent className="w-5 h-5" />}
      className={`
        w-full sm:!w-full h-[56px] 
        !text-[16px] !font-bold !leading-tight
        hover:bg-ods-bg-hover
        ${isLoading ? 'cursor-wait' : 'cursor-pointer'}
      `}
      aria-label={config.displayName}
    >
      {isLoading ? 'Signing in...' : config.displayName}
    </Button>
  );
}