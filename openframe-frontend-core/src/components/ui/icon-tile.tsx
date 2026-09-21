import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * The inset icon tile — the bordered `ods-bg` square (or panel) an icon sits
 * in. The one home for the chrome going forward (older inline tiles migrate as
 * they are touched); the size is the caller's (`size-16` in a card row,
 * `h-40 w-full` as a step panel).
 */
export function IconTile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg',
        className,
      )}
    >
      {children}
    </div>
  );
}
