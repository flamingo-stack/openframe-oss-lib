import { cn } from '../../utils/cn';
import { LoadingRegion } from './loading-region';
import { InteractiveSkeleton, TextSkeleton, UnifiedSkeleton } from './unified-skeleton';

export interface SettingsFormSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  /**
   * How many fields each card holds, one entry per card, so the skeleton has the
   * real shape of the screen behind it rather than a generic block.
   */
  cards?: number[];
  className?: string;
}

/**
 * A settings FORM while it loads: cards of labelled controls (a title and a
 * line, then label, help line and control per field), and the save row under
 * them.
 *
 * @deprecated Render the settings form itself inside a `LoadingScope`: its cards and fields draw their own skeletons. Kept so hosts on an older release keep compiling; nothing in the lib uses it.
 */
export function SettingsFormSkeleton({ region = true, cards = [2, 3, 2, 2], className }: SettingsFormSkeletonProps) {
  return (
    <LoadingRegion
      label="Loading settings"
      announce={region}
      className={cn('space-y-[var(--spacing-system-lf)]', className)}
    >
      {cards.map((fields, cardIndex) => (
        <div
          key={`settings-card-${cardIndex}`}
          className="space-y-[var(--spacing-system-lf)] rounded-lg border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]"
        >
          <div>
            <TextSkeleton.Subheading className="mb-[var(--spacing-system-xsf)] w-32" />
            <TextSkeleton.Caption className="w-full max-w-md" />
          </div>
          {Array.from({ length: fields }, (_, fieldIndex) => (
            <div key={`settings-field-${cardIndex}-${fieldIndex}`} className="space-y-[var(--spacing-system-xsf)]">
              <TextSkeleton.Caption className="w-40" />
              <TextSkeleton.Caption className="w-full max-w-lg" />
              <UnifiedSkeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-[var(--spacing-system-mf)]">
        <InteractiveSkeleton.Button className="w-32" />
        <TextSkeleton.Caption className="w-64" />
      </div>
    </LoadingRegion>
  );
}
