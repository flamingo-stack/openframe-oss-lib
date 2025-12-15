"use client";

import { ProviderButton } from './provider-button';

export interface SSOConfigStatus {
  provider: string;
  enabled: boolean;
  clientId?: string;
}

interface AuthProvidersListProps {
  /** List of enabled SSO providers */
  enabledProviders: SSOConfigStatus[];
  /** Callback when provider is clicked - implement your auth logic here */
  onProviderClick: (provider: string) => Promise<void>;
  /** Loading state for providers */
  loading?: boolean;
  /** Show divider above providers list */
  showDivider?: boolean;
  /** Custom divider text */
  dividerText?: string;
  /** Layout orientation */
  orientation?: 'vertical' | 'horizontal';
}

export function AuthProvidersList({ 
  enabledProviders,
  onProviderClick,
  loading = false,
  showDivider = true,
  dividerText = "or",
  orientation = "vertical"
}: AuthProvidersListProps) {
  if (!enabledProviders.length) {
    return null;
  }

  const handleProviderClick = async (provider: string) => {
    try {
      await onProviderClick(provider);
    } catch (error) {
      console.error(`❌ Auth Providers List: Error with ${provider}:`, error);
    }
  };

  return (
    <div className="space-y-3">
      {showDivider && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ods-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-ods-card text-ods-text-secondary">{dividerText}</span>
          </div>
        </div>
      )}
      
      <div className={`${orientation === 'horizontal' ? 'flex gap-2' : 'space-y-2'}`}>
        {enabledProviders
          .filter(provider => provider.enabled)
          .map((provider) => (
            <ProviderButton
              key={provider.provider}
              provider={provider.provider as 'microsoft' | 'google' | 'slack' | 'github'}
              onClick={() => handleProviderClick(provider.provider)}
              disabled={loading}
              loading={loading}
            />
          ))}
      </div>
    </div>
  );
}