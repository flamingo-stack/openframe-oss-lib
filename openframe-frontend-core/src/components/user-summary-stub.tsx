'use client';

import Image from '../embed-shims/next-image';
import { getProxiedImageUrl } from '../utils/image-proxy-stub';

/**
 * NOTE — this is the STUB user summary (see the filename). Five props below are
 * declared and accepted so host apps can write their call sites against the
 * final shape, but the stub does not act on them yet: `editHref`, `userId`,
 * `profileData` (there is no EditProfileButton here — `showEditButton` renders
 * a plain label), and `editablePhoto` / `onPhotoChange` (no ProfilePhotoUpload
 * widget). Each is marked below. Wiring them up is a feature, not a cleanup.
 */
interface Props {
  name: string;
  email: string;
  avatarUrl?: string | null;
  /** Optional subtitle text (e.g., relative time) to replace email line */
  subtitle?: string | null;
  /** Authentication provider names (e.g. ["google", "microsoft"]) */
  authProviders?: string[];
  /** Show an outline Edit Profile button that routes to editHref */
  showEditButton?: boolean;
  /** NOT IMPLEMENTED in the stub. Path to navigate when Edit is clicked. */
  editHref?: string;
  /** NOT IMPLEMENTED in the stub. Passed through to EditProfileButton for analytics. */
  userId?: string;
  /** NOT IMPLEMENTED in the stub — accepted and ignored, so its shape is the
   *  host's business. */
  profileData?: unknown;
  /** Optional MSP preview info to render below email */
  mspPreview?: {
    name?: string | null;
    seatCount?: number | null;
    technicianCount?: number | null;
    annualRevenue?: number | null;
    logoUrl?: string | null;
  } | null;
  /** Compact mode (avatar + name row, used in comment headers) */
  compact?: boolean;
  /** Avatar size in px for compact mode (defaults 40) */
  avatarSize?: number;

  /** NOT IMPLEMENTED in the stub. Would swap the avatar for ProfilePhotoUpload. */
  editablePhoto?: boolean;
  /** NOT IMPLEMENTED in the stub. Would receive the new photo URL. */
  onPhotoChange?: (url: string | null) => void;
}

const getAuthProviderIcon = (provider: string) => {
  const p = provider.toLowerCase();
  switch (p) {
    case 'google':
      return <Image src="/icons/google-logo.svg" alt="Google" width={16} height={16} className="h-4 w-4" />;
    case 'microsoft':
    case 'azure':
      return <Image src="/icons/microsoft-logo.svg" alt="Microsoft" width={16} height={16} className="h-4 w-4" />;
    case 'slack':
    case 'slack_oidc':
      return <div className="h-4 w-4 rounded-full bg-ods-text-secondary" />;
    default:
      return <div className="h-4 w-4 rounded-full bg-ods-text-secondary" />;
  }
};

// Abbreviate large numbers: 1 200 → 1.2K , 15 000 → 15K , 2 000 000 → 2M
const formatNumber = (n: number) => {
  if (n >= 1_000_000_000) {
    const value = n / 1_000_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const value = n / 1_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}K`;
  }
  return n.toLocaleString();
};

export function UserSummary({
  name,
  email,
  subtitle = null,
  avatarUrl,
  authProviders,
  showEditButton = false,
  mspPreview,
  compact = false,
  avatarSize = 40,
}: Props) {
  // Compact variant: minimal horizontal row
  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <Image
              src={getProxiedImageUrl(avatarUrl) ?? avatarUrl}
              alt={name}
              width={avatarSize}
              height={avatarSize}
              className="rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg bg-ods-accent font-heading font-bold text-ods-text-on-accent"
              style={{ width: avatarSize, height: avatarSize }}
            >
              {name
                .split(' ')
                .map((n: string) => n.charAt(0))
                .join('')
                .slice(0, 2)}
            </div>
          )}
          {mspPreview && mspPreview.logoUrl && (
            <Image
              src={getProxiedImageUrl(mspPreview.logoUrl) ?? mspPreview.logoUrl}
              alt={mspPreview.name || 'MSP'}
              width={24}
              height={24}
              className="absolute -bottom-1 -right-1 z-10 size-6 select-none rounded-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-ods-text-primary text-h4"
            title={mspPreview?.name ? `${name} • ${mspPreview.name}` : name}
          >
            {name}
            {mspPreview?.name && <span className="text-ods-text-secondary"> • {mspPreview.name}</span>}
          </p>
          <p
            className="truncate text-ods-text-secondary text-h6"
            title={
              subtitle && subtitle.trim().length > 0 ? subtitle : email && email.trim().length > 0 ? email : '\u00A0'
            }
          >
            {subtitle && subtitle.trim().length > 0 ? subtitle : email && email.trim().length > 0 ? email : '\u00A0'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header Row */}
      <div className="flex w-full items-start gap-6">
        {/* Avatar with badge wrapper */}
        <div className="relative h-24 w-24 shrink-0 overflow-visible">
          {avatarUrl ? (
            <Image
              src={getProxiedImageUrl(avatarUrl) ?? avatarUrl}
              alt={name}
              width={96}
              height={96}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border border-ods-border bg-ods-card font-heading text-3xl text-ods-text-secondary">
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* MSP logo badge (show only when MSP exists) */}
          {mspPreview && (
            <div className="absolute -bottom-1 -right-1 flex size-10 select-none items-center justify-center overflow-hidden rounded-full bg-ods-bg ring-2 ring-ods-border">
              {mspPreview.logoUrl ? (
                <Image
                  src={getProxiedImageUrl(mspPreview.logoUrl) ?? mspPreview.logoUrl}
                  alt={mspPreview.name || 'MSP Logo'}
                  width={40}
                  height={40}
                  className="object-cover"
                />
              ) : (
                <span className="font-heading text-sm font-bold text-ods-text-primary">
                  {mspPreview.name?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Info + actions block */}
        <div className="grid flex-1 grid-cols-[1fr_auto] gap-4">
          {/* LEFT : text stack */}
          <div className="flex min-h-[6rem] flex-col justify-center space-y-3 truncate">
            <p className="truncate leading-none text-ods-text-primary text-h2" title={name}>
              {name}
            </p>
            <p
              className="truncate break-all text-ods-text-secondary text-h4"
              title={
                subtitle && subtitle.trim().length > 0 ? subtitle : email && email.trim().length > 0 ? email : '\u00A0'
              }
            >
              {subtitle && subtitle.trim().length > 0 ? subtitle : email && email.trim().length > 0 ? email : '\u00A0'}
            </p>
            {mspPreview &&
              (() => {
                const mspSegments = [
                  mspPreview.name ?? '—',
                  typeof mspPreview.seatCount === 'number' ? `${formatNumber(mspPreview.seatCount)} Seats` : null,
                  typeof mspPreview.technicianCount === 'number'
                    ? `${formatNumber(mspPreview.technicianCount)} Technicians`
                    : null,
                  typeof mspPreview.annualRevenue === 'number' ? `$${formatNumber(mspPreview.annualRevenue)}` : null,
                ].filter(Boolean) as string[];
                const mspTitle = mspSegments.join(' • ');
                return (
                  <p className="truncate text-ods-text-primary text-h6" title={mspTitle}>
                    {/* Build string with separators */}
                    {mspSegments
                      .flatMap((txt, idx) => (idx === 0 ? [txt] : [' • ', txt]))
                      .map((seg, idx) => (
                        <span key={idx} className={seg === '•' ? 'text-ods-text-secondary' : ''}>
                          {seg}
                        </span>
                      ))}
                  </p>
                );
              })()}
          </div>

          {/* RIGHT (desktop) */}
          {(authProviders?.length || showEditButton) && (
            <div className="hidden min-h-[6rem] flex-shrink-0 flex-col items-end justify-between md:flex">
              {/* top part */}
              {authProviders && authProviders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="select-none whitespace-nowrap text-ods-text-secondary text-h6">Authorized by</span>
                  <div className="flex items-center gap-2">
                    {authProviders.map(p => (
                      <div key={p} className="flex h-4 w-4 items-center justify-center">
                        {getAuthProviderIcon(p)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* bottom part - Edit button would go here */}
              {showEditButton && <div className="text-ods-text-secondary text-h6">Edit Profile</div>}
            </div>
          )}
        </div>
      </div>

      {/* Mobile row: Authorized by left, Edit btn right */}
      {(authProviders?.length || showEditButton) && (
        <div className="flex w-full items-center justify-between gap-4 md:hidden">
          {authProviders && authProviders.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="select-none whitespace-nowrap text-ods-text-secondary text-h6">Authorized by</span>
              <div className="flex items-center gap-2">
                {authProviders.map(p => (
                  <div key={p} className="flex h-4 w-4 items-center justify-center">
                    {getAuthProviderIcon(p)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showEditButton && <div className="text-ods-text-secondary text-h6">Edit Profile</div>}
        </div>
      )}
    </div>
  );
}
