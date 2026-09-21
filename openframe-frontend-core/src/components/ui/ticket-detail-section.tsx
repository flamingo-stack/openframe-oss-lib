'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface TicketDetailSectionProps {
  /** Section label displayed as uppercase heading */
  label: string;
  children: ReactNode;
  className?: string;
}

export function TicketDetailSection({ label, children, className }: TicketDetailSectionProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-ods-text-secondary text-h5">{label}</p>
      {children}
    </div>
  );
}
