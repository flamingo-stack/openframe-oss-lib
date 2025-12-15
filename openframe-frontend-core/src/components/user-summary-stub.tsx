"use client";

import Image from "next/image";
import { getProxiedImageUrl } from "../utils/image-proxy-stub";

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
  /** Path to navigate when Edit button clicked (default "/profile/edit") */
  editHref?: string;
  /** Optional userId/profile passed through to EditProfileButton (for analytics) */
  userId?: string;
  profileData?: any;
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

  /** When true, replaces the static avatar with the ProfilePhotoUpload widget */
  editablePhoto?: boolean;
  /** Required when editablePhoto=true – receives new photo URL */
  onPhotoChange?: (url: string | null) => void;
}

const getAuthProviderIcon = (provider: string) => {
  const p = provider.toLowerCase();
  switch (p) {
    case "google":
      return <Image src="/icons/google-logo.svg" alt="Google" width={16} height={16} className="w-4 h-4" />;
    case "microsoft":
    case "azure":
      return <Image src="/icons/microsoft-logo.svg" alt="Microsoft" width={16} height={16} className="w-4 h-4" />;
    case "slack":
    case "slack_oidc":
      return <div className="w-4 h-4 bg-[#888888] rounded-full" />; // Slack icon stub
    default:
      return <div className="w-4 h-4 bg-[#888888] rounded-full" />;
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
  editHref = "/profile/edit",
  userId,
  profileData,
  mspPreview,
  compact = false,
  avatarSize = 40,
  editablePhoto = false,
  onPhotoChange,
}: Props) {
  // Compact variant: minimal horizontal row
  if (compact) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0" style={{ width: avatarSize, height: avatarSize }}>
          <div className="rounded-lg overflow-hidden bg-ods-card border border-ods-border w-full h-full relative">
            {avatarUrl ? (
              <Image src={getProxiedImageUrl(avatarUrl) ?? avatarUrl} alt={name} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex items-center justify-center h-full w-full bg-[#FFC008] text-[#161616] font-['Azeret_Mono'] font-bold">
                {name.split(' ').map((n: string) => n.charAt(0)).join('').slice(0, 2)}
              </div>
            )}
          </div>
          {mspPreview && mspPreview.logoUrl && (
            <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-[#FAFAFA] ring-1 ring-[#161616] overflow-hidden flex items-center justify-center select-none z-10">
              <img src={getProxiedImageUrl(mspPreview.logoUrl) ?? mspPreview.logoUrl} alt={mspPreview.name || 'MSP'} className="object-cover w-full h-full" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-['DM_Sans'] text-[16px] leading-[1.3] text-ods-text-primary truncate">
            {name}
            {mspPreview?.name && (
              <span className="text-ods-text-secondary"> • {mspPreview.name}</span>
            )}
          </p>
          <p className="font-['DM_Sans'] text-[14px] leading-none text-ods-text-secondary truncate">
            {subtitle && subtitle.trim().length > 0 ? subtitle : (email && email.trim().length > 0 ? email : '\u00A0')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header Row */}
    <div className="flex gap-6 w-full items-start">
        {/* Avatar with badge wrapper */}
        <div className="relative shrink-0 h-24 w-24 overflow-visible">
          <div className="rounded-full overflow-hidden bg-ods-card border border-ods-border w-full h-full relative">
            {avatarUrl ? (
              <Image src={getProxiedImageUrl(avatarUrl) ?? avatarUrl} alt={name} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex items-center justify-center h-full w-full text-3xl text-ods-text-secondary font-['Azeret_Mono']">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* MSP logo badge (show only when MSP exists) */}
          {mspPreview && (
            <div className="absolute -bottom-1 -right-1 size-10 rounded-full bg-[#FAFAFA] ring-2 ring-[#161616] overflow-hidden flex items-center justify-center select-none">
              {mspPreview.logoUrl ? (
                <Image
                  src={getProxiedImageUrl(mspPreview.logoUrl) ?? mspPreview.logoUrl}
                  alt={mspPreview.name || 'MSP Logo'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-[#161616] font-['Azeret_Mono'] text-sm font-bold">
                  {mspPreview.name?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Info + actions block */}
        <div className="flex-1 grid grid-cols-[1fr_auto] gap-4">
          {/* LEFT : text stack */}
          <div className="min-h-[6rem] flex flex-col justify-center space-y-3 truncate">
          <p className="font-['Azeret_Mono'] text-[24px] md:text-[32px] font-semibold text-ods-text-primary leading-none truncate">
            {name}
          </p>
            <p className="font-['DM_Sans'] text-[18px] text-ods-text-secondary leading-none break-all truncate">
              {(subtitle && subtitle.trim().length > 0) ? subtitle : (email && email.trim().length > 0 ? email : '\u00A0')}
            </p>
            {mspPreview && (
              <p className="font-['DM_Sans'] text-[14px] text-ods-text-primary leading-none truncate">
                {/* Build string with separators */}
                {[
                  mspPreview.name ?? '—',
                  typeof mspPreview.seatCount === 'number'
                    ? `${formatNumber(mspPreview.seatCount)} Seats`
                    : null,
                  typeof mspPreview.technicianCount === 'number'
                    ? `${formatNumber(mspPreview.technicianCount)} Technicians`
                    : null,
                  typeof mspPreview.annualRevenue === 'number'
                    ? `$${formatNumber(mspPreview.annualRevenue)}`
                    : null,
                ]
                  .filter(Boolean)
                  .flatMap((txt, idx) => (idx === 0 ? [txt] : [' • ', txt]))
                  .map((seg, idx) => (
                    <span key={idx} className={seg === ' • ' ? 'text-ods-text-secondary' : ''}>{seg}</span>
                  ))}
              </p>
            )}
          </div>

          {/* RIGHT (desktop) */}
          {(authProviders?.length || showEditButton) && (
            <div className="hidden md:flex flex-col items-end justify-between flex-shrink-0 min-h-[6rem]">
              {/* top part */}
          {authProviders && authProviders.length > 0 && (
                <div className="flex items-center gap-2">
              <span className="text-[12px] text-ods-text-secondary whitespace-nowrap select-none">
                Authorized by
              </span>
              <div className="flex items-center gap-2">
                {authProviders.map((p) => (
                  <div key={p} className="flex items-center justify-center w-4 h-4">
                    {getAuthProviderIcon(p)}
                  </div>
                ))}
              </div>
            </div>
          )}

              {/* bottom part - Edit button would go here */}
          {showEditButton && (
                <div className="text-xs text-ods-text-secondary">Edit Profile</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile row: Authorized by left, Edit btn right */}
      {(authProviders?.length || showEditButton) && (
        <div className="flex md:hidden items-center justify-between w-full gap-4">
          {authProviders && authProviders.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ods-text-secondary whitespace-nowrap select-none">Authorized by</span>
              <div className="flex items-center gap-2">
                {authProviders.map((p) => (
                  <div key={p} className="flex items-center justify-center w-4 h-4">
                    {getAuthProviderIcon(p)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showEditButton && (
            <div className="text-xs text-ods-text-secondary">Edit Profile</div>
          )}
        </div>
      )}
    </div>
  );
}