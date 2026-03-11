'use client';

interface InfoRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex gap-2 items-center w-full">
      <div className="text-h4 text-ods-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </div>
      <div className="flex-1 bg-ods-bg-surface h-px min-h-px min-w-px" />
      <div className="text-h4 text-ods-text-primary overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
        {value}
        {icon}
      </div>
    </div>
  );
}
