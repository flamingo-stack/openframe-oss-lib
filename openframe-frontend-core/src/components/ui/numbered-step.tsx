import { cn } from '../../utils/cn';

export interface StepNumberProps {
  /** The step's number, as shown (1-based). */
  number: number;
  /** The step being shown now: its ring and number take the accent. */
  current?: boolean;
  /** The lit colour (a CSS colour, such as the hex an agent's identity stores). Omitted, it is the platform's accent. */
  accent?: string;
  className?: string;
}

/**
 * THE number of a numbered step, wherever a page counts steps: a bold number
 * in a ring. Grey at rest, the accent when it is the current one.
 */
export function StepNumber({ number, current = false, accent, className }: StepNumberProps) {
  return (
    <span
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 font-bold transition-colors duration-200 text-h6 motion-reduce:transition-none',
        current ? !accent && 'border-ods-accent text-ods-accent' : 'border-ods-text-secondary text-ods-text-secondary',
        className,
      )}
      style={current && accent ? { borderColor: accent, color: accent } : undefined}
    >
      {number}
    </span>
  );
}

export interface NumberedStepProps extends StepNumberProps {
  title: string;
  description?: string;
  /** The title's element. Default `h3`. */
  titleAs?: 'h3' | 'h4' | 'p';
}

/**
 * THE head of a numbered step: its number (`StepNumber`), its title and one
 * line under it. One look everywhere steps are counted (a list of steps beside
 * a demo, the head of a column of a flow). At rest the title reads at full
 * strength and the description steps back; the current one's number and title
 * take the accent and its description reads at full strength.
 */
export function NumberedStep({
  number,
  title,
  description,
  current = false,
  accent,
  titleAs: Title = 'h3',
  className,
}: NumberedStepProps) {
  return (
    <div className={cn('flex items-start gap-[var(--spacing-system-xs)]', className)}>
      <StepNumber number={number} current={current} accent={accent} />
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Title
          className={cn(
            'm-0 transition-colors duration-200 text-h3 motion-reduce:transition-none',
            current ? !accent && 'text-ods-accent' : 'text-ods-text-primary',
          )}
          style={current && accent ? { color: accent } : undefined}
        >
          {title}
        </Title>
        {description && (
          <p
            className={cn(
              'm-0 transition-colors duration-200 text-h4 motion-reduce:transition-none',
              current ? 'text-ods-text-primary' : 'text-ods-text-secondary',
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
