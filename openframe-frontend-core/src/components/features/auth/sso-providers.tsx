'use client';

import { requireIcon, type IconComponent } from '../../chat/utils/icon-loading';
import { InteractiveSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../../ui/button';
import { LoadingItems, useLoadingScope } from '../../ui/loading-scope';
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
  /** The providers are still being read: the buttons draw their boxes (`SSO_PROVIDERS_SKELETON_COUNT`, the typical
   *  offer). A loading scope does the same. */
  loading?: boolean;
}

/** The column the provider buttons stack in, read by the buttons and by their skeleton. */
const SSO_PROVIDER_BUTTONS_CLASS = 'flex flex-col gap-[var(--spacing-system-l)]';

/**
 * How many provider buttons a form draws while the providers are read: the typical offer, Google and Microsoft
 * (Apple is offered only on Apple devices).
 */
export const SSO_PROVIDERS_SKELETON_COUNT = 2;

/** The provider buttons while the providers are read: full-width boxes of the outline button, in the same column. */
function SsoProviderButtonsSkeleton() {
  return (
    <div className={SSO_PROVIDER_BUTTONS_CLASS} aria-hidden>
      <LoadingItems count={SSO_PROVIDERS_SKELETON_COUNT}>
        {() => <InteractiveSkeleton.Button className="w-full" data-loading-item />}
      </LoadingItems>
    </div>
  );
}

/** Stacked full-width SSO provider buttons shared by the auth forms. */
export function SsoProviderButtons({
  providers,
  onSsoClick,
  actionLabel = 'Continue with',
  disabled = false,
  enabledProviders,
  tag,
  loading,
}: SsoProviderButtonsProps) {
  if (useLoadingScope() || loading) return <SsoProviderButtonsSkeleton />;
  return (
    <div className={SSO_PROVIDER_BUTTONS_CLASS}>
      {providers.map(provider => {
        const meta = PROVIDER_META[provider];
        const Icon = meta.Icon;
        return (
          <Button
            key={provider}
            data-loading-item
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
