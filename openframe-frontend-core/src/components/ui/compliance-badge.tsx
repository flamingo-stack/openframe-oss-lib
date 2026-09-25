import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import {
  complianceStandardForName,
  type ComplianceLogoKey,
  type ComplianceStandard,
} from '../../utils/compliance-standards';
import {
  EuLogoIcon,
  HhsLogoIcon,
  IsoIecLogoIcon,
  IsoLogoIcon,
  NistLogoIcon,
} from '../icons-v2-generated/compliance-logos';

/** The official marks (`icons-v2/compliance-logos`), by `ComplianceStandard.logo`. */
const COMPLIANCE_LOGOS: Record<ComplianceLogoKey, ComponentType<{ className?: string; size?: number }>> = {
  iso: IsoLogoIcon,
  'iso-iec': IsoIecLogoIcon,
  nist: NistLogoIcon,
  eu: EuLogoIcon,
  hhs: HhsLogoIcon,
};

/** Font size of the badge's mark, by length, so "SOC 2" and "800-171" both fit the seal. */
function markFontSize(mark: string): number {
  if (mark.length <= 4) return 11;
  if (mark.length <= 6) return 9;
  return 7.5;
}

/**
 * A compliance standard's badge: a seal with the issuing body on top and the
 * standard's mark in the middle ("AICPA · SOC 2", "ISO · 27001"), drawn in ODS
 * tokens so it reads on every theme. OUR mark naming the standard — never an
 * issuer's licensed seal.
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
        r="19"
        fill="var(--color-bg-card)"
        stroke="var(--color-accent-primary)"
        strokeWidth="1.5"
      />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke="var(--color-border-default)" strokeWidth="0.75" />
      <text
        x="20"
        y="13.5"
        textAnchor="middle"
        fontSize="4.6"
        letterSpacing="0.4"
        fill="var(--color-text-secondary)"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {standard.body.toUpperCase()}
      </text>
      <text
        x="20"
        y="24.5"
        textAnchor="middle"
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
      <Official size={40} aria-hidden="true" />
    </span>
  ) : (
    <ComplianceBadge standard={standard} className={className} />
  );
}
