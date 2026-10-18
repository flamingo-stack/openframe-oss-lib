'use client';

import { requireIcon, type IconComponent } from '../../chat/utils/icon-loading';
import { Button } from '../../ui/button';
import { StatusBadge } from '../../ui/status-badge';

/** SSO providers offered on the auth forms. */
export type AuthSsoProvider = 'openframe' | 'google' | 'microsoft' | 'apple';

/** Each provider's name and its mark. The mark is named, not imported: it is loaded when a button draws it. */
export const PROVIDER_META: Record<AuthSsoProvider, { name: string; Icon: IconComponent }> = {
  openframe: {
    name: 'OpenFrame',
    Icon: requireIcon({
      set: 'OpenframeLogoIcon',
      color: 'var(--color-text-primary)',
      secondaryColor: 'var(--color-accent-primary)',
      ownColor: true,
    }),
  },
  google: { name: 'Google', Icon: requireIcon({ set: 'GoogleLogoIcon' }) },
  microsoft: { name: 'Microsoft', Icon: requireIcon({ set: 'MicrosoftLogoIcon' }) },
  apple: { name: 'Apple', Icon: requireIcon({ set: 'AppleLogoIcon' }) },
};

export interface SsoProviderButtonsProps {
  providers: AuthSsoProvider[];
  onSsoClick?: (provider: AuthSsoProvider) => void;
  /** Verb prefix for provider buttons, e.g. "Continue with". */
  actionLabel?: string;
  disabled?: boolean;
  /**
   * When set, only these providers are clickable and the rest render disabled —
   * e.g. unlock just the providers a discovered tenant actually offers.
   * `disabled` still wins over this list.
   */
  enabledProviders?: AuthSsoProvider[];
  /**
   * A stamp on every button naming who configured these providers — e.g. the organization whose
   * own Google Workspace a "Continue with Google" button signs in through, which is not the same
   * button as the generic one.
   */
  tag?: string;
}

/** Stacked full-width SSO provider buttons shared by the auth forms. */
export function SsoProviderButtons({
  providers,
  onSsoClick,
  actionLabel = 'Continue with',
  disabled = false,
  enabledProviders,
  tag,
}: SsoProviderButtonsProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {providers.map(provider => {
        const meta = PROVIDER_META[provider];
        const Icon = meta.Icon;
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            fullWidth
            disabled={disabled || (enabledProviders ? !enabledProviders.includes(provider) : false)}
            // Disabled buttons recede to the page background (like a disabled input), per design
            className="disabled:bg-ods-bg"
            leftIcon={<Icon className="h-5 w-5" />}
            onClick={() => onSsoClick?.(provider)}
          >
            {`${actionLabel} ${meta.name}`}
            {tag && (
              // A child, not `rightIcon`: the Button lays its children out through a `contents` span,
              // so the badge is a flex item of the button itself and can give up width (`min-w-0`)
              // where a long organization name would otherwise push the label out of a phone-width
              // button. `block` over its inline-flex, because an ellipsis only renders on a block box.
              <StatusBadge
                text={tag}
                variant="button"
                singleLine
                title={tag}
                className="block min-w-0 max-w-32 truncate"
              />
            )}
          </Button>
        );
      })}
    </div>
  );
}
