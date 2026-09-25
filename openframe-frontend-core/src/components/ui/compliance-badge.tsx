import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import {
  complianceStandardForName,
  type ComplianceLogoKey,
  type ComplianceStandard,
} from '../../utils/compliance-standards';
import {
  AicpaSoc2LogoIcon,
  CmmcLogoIcon,
  EuLogoIcon,
  HhsLogoIcon,
  IsoIecLogoIcon,
  IsoLogoIcon,
  NistLogoIcon,
} from '../icons-v2-generated/compliance-logos';

/** The official marks (`icons-v2/compliance-logos`), by `ComplianceStandard.logo`. */
const COMPLIANCE_LOGOS: Record<ComplianceLogoKey, ComponentType<{ className?: string; size?: number }>> = {
  'aicpa-soc2': AicpaSoc2LogoIcon,
  iso: IsoLogoIcon,
  'iso-iec': IsoIecLogoIcon,
  nist: NistLogoIcon,
  cmmc: CmmcLogoIcon,
  eu: EuLogoIcon,
  hhs: HhsLogoIcon,
};

/** Font size of the badge's mark, by length, so "HIPAA" and "800-171" both fit inside the ring. */
function markFontSize(mark: string): number {
  if (mark.length <= 4) return 10;
  if (mark.length <= 5) return 8.5;
  return 7;
}

/**
 * A compliance standard's badge, for a standard the icon set has no official
 * mark for: the standard's mark ("CMMC", "FedRAMP") in a plain ring, drawn in
 * ODS tokens so it reads on every theme. The issuing body rides the accessible
 * name only — at 40px any second line is illegible. OUR mark naming the
 * standard, never an imitation of an issuer's seal.
 */
export function ComplianceBadge({ standard, className }: { standard: ComplianceStandard; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-10 shrink-0', className)}
      role="img"
      aria-label={`${standard.body} ${standard.mark}`}
    >
      <circle
        cx="20"
        cy="20"
        r="18.5"
        fill="var(--color-bg-card)"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.5"
      />
      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={markFontSize(standard.mark)}
        fontWeight="700"
        fill="var(--color-text-primary)"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {standard.mark}
      </text>
    </svg>
  );
}

/**
 * THE compliance logo for a framework, by name (`complianceStandardForName`,
 * which also accepts a system's standard id such as Vanta's `soc2`): the
 * standard's OFFICIAL mark when the icon set ships one, else its drawn
 * `ComplianceBadge`; an unknown standard shows `fallback`.
 */
export function ComplianceLogo({
  names,
  fallback = null,
  className,
}: {
  /** The framework's names, best first (e.g. Vanta's `standard`, then its display name). */
  names: ReadonlyArray<string | null | undefined>;
  fallback?: ReactNode;
  className?: string;
}) {
  const standard = complianceStandardForName(...names);
  if (!standard) return <>{fallback}</>;
  const Official = standard.logo ? COMPLIANCE_LOGOS[standard.logo] : null;
  return Official ? (
    <span
      role="img"
      aria-label={`${standard.body} ${standard.mark}`}
      className={cn('flex size-10 shrink-0 items-center justify-center', className)}
    >
      {/* Fills the box, so a caller's size class sizes the mark too (not only its frame). */}
      <Official size={40} className="size-full" aria-hidden="true" />
    </span>
  ) : (
    <ComplianceBadge standard={standard} className={className} />
  );
}
