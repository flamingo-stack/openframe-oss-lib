/**
 * CveLink Component
 *
 * Displays a CVE ID with an external link icon that links to the NIST NVD database.
 * Part of the ODS (OpenFrame Design System) platform components.
 *
 * @example
 * ```tsx
 * <CveLink cveId="CVE-2024-1234" />
 * ```
 */

import type React from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { CustomExternalLinkIcon } from '../icons-v2-generated/interface/custom-external-link-icon';

export interface CveLinkProps {
  /** CVE ID (e.g., "CVE-2024-1234") */
  cveId: string;
  /** Additional CSS classes */
  className?: string;
}

export const CveLink: React.FC<CveLinkProps> = ({ cveId, className }) => {
  const nistUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`;

  return (
    <Link
      href={nistUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center gap-2 text-ods-text-primary transition-colors text-code hover:text-ods-accent',
        className,
      )}
    >
      <span>{cveId}</span>
      <CustomExternalLinkIcon
        color="var(--color-text-secondary)"
        className="h-4 w-4 text-ods-text-secondary transition-colors group-hover:text-ods-accent"
      />
    </Link>
  );
};

CveLink.displayName = 'CveLink';
