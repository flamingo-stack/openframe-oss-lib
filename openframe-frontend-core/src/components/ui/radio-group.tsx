'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { type ComponentPropsWithoutRef, type ComponentRef, type ReactNode, forwardRef } from 'react';

import { CONTROL_SIZE } from '../../styles/component-sizes';
import { cn } from '../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { Label } from './label';
import { useLoadingScope } from './loading-scope';

const RadioGroup = forwardRef<
  ComponentRef<typeof RadioGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = forwardRef<
  ComponentRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'group relative h-6 w-6 shrink-0 rounded-full border-2 bg-ods-card',
        'border-[var(--color-border-strong)]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-ods-accent',
        'hover:enabled:border-ods-accent/60',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
        <span className="block h-1/2 w-1/2 rounded-full bg-ods-accent" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

/** A radio dot's box: read by the dot of every option and by its skeleton. */
const RADIO_DOT_SIZE_CLASS = `${CONTROL_SIZE.selection} shrink-0 rounded-full`;
/** An option's label line and description line (the type each is set in). */
const RADIO_OPTION_LABEL_CLASS =
  'font-[family-name:var(--font-h4-family)] text-[length:var(--font-size-h4-body)] font-[number:var(--font-h4-weight)] leading-[24px]';
const RADIO_OPTION_DESCRIPTION_CLASS =
  'font-[family-name:var(--font-h6-family)] text-[length:var(--font-size-h6-caption)] font-[number:var(--font-h6-weight)] leading-[20px]';

/** An option's label and caption bars while they are read (a `null` label or caption, or an option not here yet). */
const RADIO_OPTION_LABEL_BAR_CLASS = 'w-32 max-w-full';
const RADIO_OPTION_DESCRIPTION_BAR_CLASS = 'w-48 max-w-full';

/** How many option rows the block draws while loading when the host passes no options. */
export const RADIO_GROUP_BLOCK_SKELETON_OPTIONS = 3;

interface RadioGroupBlockOption {
  value: string;
  /** The option's label. `null` is a label still read: in a scope or while `loading` it is an `h4` bar. */
  label: ReactNode;
  /** The option's caption. `null` is a caption still read: in a scope or while `loading` it is an `h6` bar
   *  (`undefined`: the option has no caption). */
  description?: ReactNode;
  disabled?: boolean;
  /** Optional trailing slot rendered at the end of the row (e.g. a discount tag) */
  trailing?: ReactNode;
  /**
   * Optional content under the option's row, inside the option and across its
   * full width (e.g. the fields the option needs on a narrow screen). Rendered
   * as given, with no wrapper, so a footer hidden at some widths leaves no gap.
   */
  footer?: ReactNode;
}

interface RadioGroupBlockProps extends Omit<ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'children'> {
  options: RadioGroupBlockOption[];
  /**
   * - `separated` (default): each option is its own bordered card stacked with gaps.
   * - `grouped`: options share a single outer border with dividers between rows.
   */
  variant?: 'separated' | 'grouped';
  /**
   * `vertical` (default): one option per row. `horizontal`: the options side
   * by side in equal columns, for a short choice on a wide form.
   */
  orientation?: 'vertical' | 'horizontal';
  /** Error message displayed below the group (also triggers red borders) */
  error?: string;
  itemClassName?: string;
  /**
   * Which option is chosen is still being read: the options the host passes are drawn for real and inert, each dot
   * a skeleton of the dot's own size. With no options, `skeletonCount` rows with a bar for each label. A loading
   * scope does the same.
   */
  loading?: boolean;
  /** How many option rows to draw while loading when there are no options (defaults to
   *  `RADIO_GROUP_BLOCK_SKELETON_OPTIONS`). */
  skeletonCount?: number;
}

const RadioGroupBlock = forwardRef<ComponentRef<typeof RadioGroupPrimitive.Root>, RadioGroupBlockProps>(
  (
    {
      className,
      options,
      variant = 'separated',
      orientation = 'vertical',
      error,
      itemClassName,
      disabled,
      loading: loadingProp,
      skeletonCount = RADIO_GROUP_BLOCK_SKELETON_OPTIONS,
      ...props
    },
    ref,
  ) => {
    // ONE switch: in a page's loading state (or while the host reads the choice) every dot is its skeleton.
    const loading = useLoadingScope() || !!loadingProp;
    // While loading with no options, rows of label bars stand for the options (`null`: a row with no option yet).
    const rows: Array<RadioGroupBlockOption | null> =
      loading && options.length === 0 ? Array.from({ length: skeletonCount }, () => null) : options;
    const isGrouped = variant === 'grouped';
    const isHorizontal = orientation === 'horizontal';
    return (
      <div className={cn('relative flex w-full flex-col', className)}>
        <RadioGroupPrimitive.Root
          ref={ref}
          // Same marker every field exposes — it is how a form finds (and
          // scrolls to) the first control that failed validation. The GROUP is
          // the field here; the individual options are not separately invalid.
          data-invalid={error ? true : undefined}
          orientation={orientation}
          className={cn(
            'w-full',
            isGrouped
              ? cn(
                  'flex overflow-hidden rounded-[6px] border bg-ods-card',
                  isHorizontal ? 'flex-row items-stretch' : 'flex-col',
                  error ? 'border-ods-error' : 'border-ods-border',
                )
              : cn('grid gap-2', isHorizontal && 'auto-cols-fr grid-flow-col'),
          )}
          disabled={disabled || loading}
          {...props}
        >
          {rows.map((option, index) => {
            const optionKey = option ? option.value : `skeleton-${index}`;
            const itemId = `${props.name ?? 'radio-block'}-${optionKey}`;
            // Loading draws the options as they are, inert: not greyed as disabled, never hovered or chosen.
            const isDisabled = !loading && (disabled || option?.disabled);
            const interactive = !loading && !isDisabled;
            const isLast = index === rows.length - 1;
            const hasFooter = option?.footer != null;
            const row = (
              <>
                {loading || !option ? (
                  <UnifiedSkeleton variant="circular" className={RADIO_DOT_SIZE_CLASS} />
                ) : (
                  <RadioGroupPrimitive.Item
                    id={itemId}
                    value={option.value}
                    disabled={isDisabled}
                    className={cn(
                      RADIO_DOT_SIZE_CLASS,
                      'border-2 bg-ods-card',
                      error ? 'border-ods-error' : 'border-[var(--color-border-strong)]',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card',
                      // Disabled: the EMPTY dot dims with the text; a selected one
                      // keeps its accent so "on but locked" stays readable.
                      'disabled:cursor-not-allowed',
                      'disabled:data-[state=unchecked]:border-ods-border disabled:data-[state=unchecked]:bg-ods-bg',
                      'data-[state=checked]:border-ods-accent',
                    )}
                  >
                    <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
                      <span className="block h-1/2 w-1/2 rounded-full bg-ods-accent" />
                    </RadioGroupPrimitive.Indicator>
                  </RadioGroupPrimitive.Item>
                )}
                <div
                  className={cn(
                    'flex min-w-0 flex-1 flex-col justify-center',
                    // Direct children only — these are the two component-owned
                    // wrappers. `option.label` / `option.description` are
                    // ReactNode, so a descendant rule would repaint content the
                    // caller styled itself.
                    isDisabled && '[&>span]:text-ods-text-disabled',
                  )}
                >
                  <span
                    className={cn(RADIO_OPTION_LABEL_CLASS, 'select-none truncate text-ods-text-primary')}
                    title={typeof option?.label === 'string' ? option.label : undefined}
                  >
                    {option && !(loading && option.label === null) ? (
                      option.label
                    ) : (
                      <TextLineSkeleton as="span" type="inherit" className={RADIO_OPTION_LABEL_BAR_CLASS} />
                    )}
                  </span>
                  {loading && option?.description === null ? (
                    <span className={RADIO_OPTION_DESCRIPTION_CLASS}>
                      <TextLineSkeleton as="span" type="inherit" className={RADIO_OPTION_DESCRIPTION_BAR_CLASS} />
                    </span>
                  ) : (
                    option?.description && (
                      <span className={cn(RADIO_OPTION_DESCRIPTION_CLASS, 'select-none text-ods-text-secondary')}>
                        {option.description}
                      </span>
                    )
                  )}
                </div>
                {option?.trailing && <div className="ml-auto flex shrink-0 items-center">{option.trailing}</div>}
              </>
            );
            return (
              <Label
                variant="surface"
                key={optionKey}
                htmlFor={loading ? undefined : itemId}
                // One option of the list, in the loaded and the loading form alike (the gate compares the two).
                data-loading-item=""
                aria-disabled={isDisabled || undefined}
                className={cn(
                  'flex w-full items-center gap-3',
                  isHorizontal && 'min-w-0 flex-1',
                  'transition-colors duration-200',
                  isDisabled && 'cursor-not-allowed',
                  interactive && 'cursor-pointer',
                  // Hover / active move the BACKGROUND only, like Input and
                  // CheckboxBlock — the border stays put so an unselected row
                  // never flashes "selected" under the cursor.
                  interactive && 'hover:bg-ods-bg-hover active:bg-ods-bg-active',
                  isGrouped
                    ? cn(
                        'bg-ods-card px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs,8px)]',
                        !isLast && (isHorizontal ? 'border-r' : 'border-b'),
                        error ? 'border-ods-error' : 'border-ods-border',
                      )
                    : cn(
                        'rounded-[6px] border bg-ods-card p-[var(--spacing-system-sf)]',
                        interactive && 'has-[[data-state=checked]]:border-ods-accent/40',
                        error ? 'border-ods-error' : 'border-ods-border',
                      ),
                  // Disabled matches a disabled field: flat `ods-bg` fill and
                  // greyed text, not a fade of the whole row. The greying lives
                  // on the TEXT COLUMN below, not here: as a descendant rule on
                  // the row it also repainted whatever `trailing` renders — a
                  // `Tag`'s label is a span too, and it went invisible against
                  // its own fill.
                  isDisabled && 'bg-ods-bg',
                  // With a footer the option stacks: its row, then the footer.
                  hasFooter && 'flex-col items-stretch gap-[var(--spacing-system-sf)]',
                  itemClassName,
                )}
              >
                {hasFooter ? <div className="flex w-full items-center gap-[var(--spacing-system-sf)]">{row}</div> : row}
                {option?.footer}
              </Label>
            );
          })}
        </RadioGroupPrimitive.Root>
        {error && (
          <p
            className="absolute bottom-0 left-0 right-0 translate-y-full truncate text-ods-error text-h6"
            title={error}
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
RadioGroupBlock.displayName = 'RadioGroupBlock';

export { RadioGroup, RadioGroupItem, RadioGroupBlock };
export type { RadioGroupBlockProps, RadioGroupBlockOption };
