'use client';

import React from 'react';

export interface HighlightCardItem {
  category: string;
  categoryColor: string;
  highlightBg: string;
  description: string;
}

export interface HighlightCardProps {
  item: HighlightCardItem;
  className?: string;
}

export function HighlightCard({
  item,
  className = ''
}: HighlightCardProps) {
  // Calculate width for mobile and desktop
  const mobileWidth = item.category.length * 12;
  const desktopWidth = item.category.length * 14;
  
  return (
    <div className={`bg-ods-bg p-6 md:p-10 relative ${className}`}>
      <div className="relative">
        {/* Mobile highlight */}
        <div
          className="absolute rounded-md h-8 left-[80px] top-0 md:hidden"
          style={{
            backgroundColor: item.highlightBg,
            width: `${mobileWidth}px`
          }}
        />
        {/* Desktop highlight */}
        <div
          className="absolute rounded-md h-10 left-[95px] top-0 hidden md:block"
          style={{
            backgroundColor: item.highlightBg,
            width: `${desktopWidth}px`
          }}
        />
        <h3 className="font-['Azeret_Mono'] font-semibold text-[24px] md:text-[28px] lg:text-[32px] leading-[1.25] tracking-[-0.64px] text-ods-text-primary relative z-10">
          Your{' '}
          <span style={{ color: item.categoryColor }}>
            {item.category}
          </span>
          {' '}{item.description}
        </h3>
      </div>
    </div>
  );
}

export interface HighlightCardGridProps {
  items: HighlightCardItem[];
  columns?: 2 | 3;
  className?: string;
  cardClassName?: string;
}

export function HighlightCardGrid({
  items,
  columns = 2,
  className = '',
  cardClassName = 'bg-ods-card border border-ods-border rounded-lg p-0 overflow-hidden'
}: HighlightCardGridProps) {
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
                <HighlightCard
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