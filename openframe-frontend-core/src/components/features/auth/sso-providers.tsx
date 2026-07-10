'use client'

import * as React from 'react'
import { OpenFrameLogo } from '../../icons'
import { GoogleLogoIcon } from '../../icons-v2-generated/brand-logos/google-logo-icon'
import { MicrosoftLogoIcon } from '../../icons-v2-generated/brand-logos/microsoft-logo-icon'
import { Button } from '../../ui/button'

/** SSO providers offered on the auth forms. */
export type AuthSsoProvider = 'openframe' | 'google' | 'microsoft'

export const PROVIDER_META: Record<
  AuthSsoProvider,
  { name: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  openframe: {
    name: 'OpenFrame SSO',
    Icon: ({ className }) => (
      <OpenFrameLogo
        className={className}
        lowerPathColor="var(--color-accent-primary)"
        upperPathColor="var(--color-text-primary)"
      />
    ),
  },
  google: { name: 'Google', Icon: GoogleLogoIcon },
  microsoft: { name: 'Microsoft', Icon: MicrosoftLogoIcon },
}

export interface SsoProviderButtonsProps {
  providers: AuthSsoProvider[]
  onSsoClick?: (provider: AuthSsoProvider) => void
  /** Verb prefix for provider buttons, e.g. "Continue with". Ignored for "openframe". */
  actionLabel?: string
  disabled?: boolean
}

/** Stacked full-width SSO provider buttons shared by the auth forms. */
export function SsoProviderButtons({
  providers,
  onSsoClick,
  actionLabel = 'Continue with',
  disabled = false,
}: SsoProviderButtonsProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {providers.map((provider) => {
        const meta = PROVIDER_META[provider]
        const Icon = meta.Icon
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            fullWidth
            disabled={disabled}
            // Disabled buttons recede to the page background (like a disabled input), per design
            className="disabled:bg-ods-bg"
            leftIcon={<Icon className="h-5 w-5" />}
            onClick={() => onSsoClick?.(provider)}
          >
            {provider === 'openframe' ? meta.name : `${actionLabel} ${meta.name}`}
          </Button>
        )
      })}
    </div>
  )
}
