'use client';

export interface LabeledDividerProps {
  label: string;
}

/** A horizontal rule with a centred label. */
export function LabeledDivider({ label }: LabeledDividerProps) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-s)]">
      <div className="h-px flex-1 bg-ods-border" />
      <span className="text-ods-text-secondary text-h6">{label}</span>
      <div className="h-px flex-1 bg-ods-border" />
    </div>
  );
}
