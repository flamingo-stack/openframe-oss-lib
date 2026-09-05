'use client';

import React from 'react';
import { cn } from '../../utils';

interface BenefitCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  variant?: 'default' | 'dark' | 'auth-figma' | 'icon-top';
  className?: string;
}

export const BenefitCard: React.FC<BenefitCardProps> = ({
  icon,
  title,
  description,
  variant = 'default',
  className = '',
}) => {
  // Direction and cross-axis alignment only — every other per-variant value
  // (including `gap`, which used to hide in a ternary here) lives in
  // `variantStyles` so one variant is one place.
  const getBaseStyles = (cardVariant: string) =>
    cardVariant === 'icon-top'
      ? 'flex flex-col items-center text-center relative'
      : 'flex items-start justify-start relative';

  const variantStyles = {
    default: {
      container: 'gap-2 bg-ods-bg p-2 md:p-4',
      title: 'font-body font-bold text-body-md md:text-body-lg text-ods-text-primary',
      description: 'font-body font-medium text-body-sm md:text-body-md text-ods-text-secondary',
    },
    dark: {
      container: 'gap-2 bg-transparent p-0 shadow-[0px_48px_80px_0px_rgba(0,0,0,0.24)]',
      title: 'font-mono font-semibold text-heading-4 leading-[40px] text-ods-text-primary tracking-[-0.64px]',
      description: 'font-body font-medium text-body-lg leading-6 text-ods-text-tertiary',
    },
    'auth-figma': {
      container: 'gap-4 bg-transparent p-6',
      title: 'text-h3 text-ods-text-primary tracking-[-0.36px]',
      description: 'text-h4 text-ods-text-secondary',
    },
    // Icon stacked ABOVE centred copy (campaign "How it works" cards).
    // Typography follows auth-figma, the only ODS-compliant pair here —
    // `default`/`dark` use text-body-*/font-body, which the token rules forbid.
    'icon-top': {
      container: 'gap-6 bg-transparent p-6',
      title: 'text-h3 text-ods-text-primary tracking-[-0.36px]',
      description: 'text-h4 text-ods-text-secondary',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn(getBaseStyles(variant), styles.container, className)}>
      {icon && <div>{icon}</div>}
      <div className={cn('flex min-w-0 flex-col gap-1', variant !== 'icon-top' && 'flex-1')}>
        <h3 className={cn(styles.title)}>{title}</h3>
        <p className={cn(styles.description)}>{description}</p>
      </div>
    </div>
  );
};

interface BenefitCardGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4; // Support 2, 3, or 4 columns
}

export const BenefitCardGrid: React.FC<BenefitCardGridProps> = ({ children, className = '', columns = 2 }) => {
  const childrenArray = React.Children.toArray(children);

  const gridClass =
    columns === 4
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      : columns === 3
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        : 'flex flex-col md:flex-row';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-ods-border bg-ods-card shadow-ods-card',
        gridClass,
        className,
      )}
    >
      {childrenArray.map((child, index) => {
        const totalItems = childrenArray.length;
        const isLastItem = index === totalItems - 1;

        // Dynamic border logic based on columns
        let borderClass = '';
        if (columns === 4) {
          // 4-column grid borders
          const isLastInRow = (index + 1) % 4 === 0;
          const isInLastRow = index >= totalItems - 4;
          borderClass = cn(
            !isLastInRow && 'border-ods-border md:border-r',
            !isInLastRow && 'border-b md:border-b lg:border-b-0',
            index < 2 && 'lg:border-b-0',
          );
        } else if (columns === 3) {
          // 3 columns lay out 1-up / 2-up / 3-up, so the row a card sits in
          // differs per breakpoint and a single rule cannot describe it. The
          // old shared 2-3 branch assumed one row and, at `md` (grid-cols-2),
          // gave card 1 a trailing `md:border-r` while suppressing the divider
          // between the two rows.
          const isLastInMdRow = (index + 1) % 2 === 0;
          const isInLastMdRow = index >= totalItems - (totalItems % 2 === 0 ? 2 : 1);
          const isLastInLgRow = (index + 1) % 3 === 0;
          const isInLastLgRow = index >= totalItems - (totalItems % 3 === 0 ? 3 : totalItems % 3);
          borderClass = cn(
            'border-ods-border',
            !isLastItem && 'border-b',
            isInLastMdRow && 'md:border-b-0',
            !isLastInMdRow && !isLastItem && 'md:border-r',
            isLastInMdRow && 'md:border-r-0',
            isInLastLgRow && 'lg:border-b-0',
            !isInLastMdRow && !isInLastLgRow && 'lg:border-b',
            !isLastInLgRow && !isLastItem && 'lg:border-r',
            isLastInLgRow && 'lg:border-r-0',
          );
        } else {
          // 2 columns: a flex row, so one rule genuinely does describe it.
          borderClass = isLastItem ? 'border-b-0' : 'border-b md:border-b-0 md:border-r border-ods-border';
        }

        return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
          key: index,
          className: borderClass,
        });
      })}
    </div>
  );
};
