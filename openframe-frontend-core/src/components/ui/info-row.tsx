'use client';

import type { ReactNode } from 'react';

interface InfoRowProps {
  label: string;
  value: string;
  icon?: ReactNode;
}

export function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-ods-text-primary text-h4">{label}</div>
      <div className="h-px min-h-px min-w-px flex-1 bg-ods-border" />
      <div className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-ods-text-primary text-h4">
        {value}
        {icon}
      </div>
    </div>
  );
}
