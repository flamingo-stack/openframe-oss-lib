'use client';

import type React from 'react';
import { cn } from '../../../utils/cn';

export interface AIWarningsSectionProps {
  warnings: string[];
  title?: string;
  className?: string;
}

export const AIWarningsSection: React.FC<AIWarningsSectionProps> = ({ warnings, title = 'AI Warnings', className }) => {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border border-ods-warning/30 bg-ods-warning/10 p-4', className)}>
      <div className="flex items-start gap-2">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-ods-warning"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h4 className="mb-2 font-semibold text-ods-warning text-h6">{title}</h4>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li key={index} className="list-inside list-disc text-ods-warning/80 text-h6">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
