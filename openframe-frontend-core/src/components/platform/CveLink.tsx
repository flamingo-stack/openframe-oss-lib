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
import { cn } from '../../utils/cn';
import { CustomExternalLinkIcon } from '../icons';

export interface CveLinkProps {
  /** CVE ID (e.g., "CVE-2024-1234") */
  cveId: string;
  /** Additional CSS classes */
  className?: string;
}

export const CveLink: React.FC<CveLinkProps> = ({ cveId, className }) => {
  const nistUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`;

  return (
    <a
      href={nistUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center gap-2 text-ods-text-primary transition-colors text-code hover:text-ods-accent',
        className,
      )}
    >
      <span>{cveId}</span>
      <CustomExternalLinkIcon className="h-4 w-4 text-ods-text-secondary transition-colors group-hover:text-ods-accent" />
    </a>
  );
};

CveLink.displayName = 'CveLink';
