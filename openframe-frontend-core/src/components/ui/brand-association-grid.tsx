'use client';

import React from 'react';
import { BrandAssociationCard, type BrandAssociationItem } from './brand-association-card';

export interface BrandAssociationGridProps {
  items: BrandAssociationItem[];
  columns?: 2 | 3;
  className?: string;
  cardClassName?: string;
}

export function BrandAssociationGrid({
  items,
  columns = 2,
  className = '',
  cardClassName = 'bg-ods-card border border-ods-border rounded-lg p-0 overflow-hidden'
}: BrandAssociationGridProps) {
  const gridCols = columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3';
  const itemsPerRow = columns;
  const rows = Math.ceil(items.length / itemsPerRow);

  const getBorderClasses = (isLastRow: boolean, isLastInRow: boolean, globalIndex: number) => {
    let classes = '';
    
    // Right border - responsive logic
    if (!isLastInRow) {
      // On mobile (1 column), never show right border
      // On desktop (2/3 columns), show right border except for last in row
      classes += ' md:border-r border-ods-border';
    }
    
    // Bottom border logic
    const isLastItem = globalIndex === items.length - 1;
    
    // Mobile: bottom border for all except last item
    if (!isLastItem) {
      classes += ' border-b border-ods-border';
    }
    
    // Desktop: override mobile border, show bottom border for all rows except last
    if (!isLastRow) {
      classes += ' md:border-b border-ods-border';
    } else {
      // Last row on desktop - remove bottom border
      classes += ' md:border-b-0';
    }
    
    return classes;
  };

  return (
    <div className={`${cardClassName} ${className}`}>
      {Array.from({ length: rows }, (_, rowIndex) => {
        const startIndex = rowIndex * itemsPerRow;
        const rowItems = items.slice(startIndex, startIndex + itemsPerRow);
        const isLastRow = rowIndex === rows - 1;

        return (
          <div key={rowIndex} className={`grid ${gridCols}`}>
            {rowItems.map((item, itemIndex) => {
              const globalIndex = startIndex + itemIndex;
              const isLastInRow = itemIndex === rowItems.length - 1;
              const borderClasses = getBorderClasses(isLastRow, isLastInRow, globalIndex);

              return (
                <BrandAssociationCard
                  key={globalIndex}
                  item={item}
                  className={borderClasses}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}