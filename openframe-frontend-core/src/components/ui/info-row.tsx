'use client';

interface InfoRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex gap-2 items-center w-full">
      <div className="text-h4 text-[var(--ods-system-greys-white)] overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </div>
      <div className="flex-1 bg-[var(--ods-system-greys-soft-grey)] h-px min-h-px min-w-px" />
      <div className="text-h4 text-[var(--ods-system-greys-white)] overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
        {value}
        {icon}
      </div>
    </div>
  );
}
