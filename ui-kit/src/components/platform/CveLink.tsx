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

import React from 'react'
import { CustomExternalLinkIcon } from '../icons'
import { cn } from '../../utils/cn'

export interface CveLinkProps {
  /** CVE ID (e.g., "CVE-2024-1234") */
  cveId: string
  /** Additional CSS classes */
  className?: string
}

export const CveLink: React.FC<CveLinkProps> = ({
  cveId,
  className
}) => {
  const nistUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`

  return (
    <a
      href={nistUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-2 font-["DM_Sans"] font-medium text-[18px] leading-[20px] text-ods-text-primary font-mono hover:text-ods-accent transition-colors group',
        className
      )}
    >
      <span>{cveId}</span>
      <CustomExternalLinkIcon className="w-4 h-4 text-ods-text-secondary group-hover:text-ods-accent transition-colors" />
    </a>
  )
}

CveLink.displayName = 'CveLink'
