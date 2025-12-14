'use client';

import React from 'react';
import { Card } from './card';
import { StatusBadge } from './status-badge';

export interface FeatureCardItem {
  icon?: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  iconColor?: string;
  title: string;
  badge?: {
    text: string;
    variant?: 'card' | 'button';
    colorScheme?: 'cyan' | 'pink' | 'yellow' | 'green' | 'purple' | 'default';
  };
  content: React.ReactNode; // Allow any content to be injected
  // Card-level customization props
  removeAllBorders?: boolean;  // Remove all borders for this card
  noBackground?: boolean;      // Remove default background
  customBackground?: string;   // Custom background color/class
}

export interface FeatureCardGridProps {
  items: FeatureCardItem[];
  columns?: 2 | 3;
  className?: string;
  cardClassName?: string;
  itemClassName?: string;
  showBorders?: boolean;
  roundedCorners?: boolean;  // Flag to enable rounded corners
  cardGap?: string;          // Gap between cards (e.g., 'gap-4', 'gap-6')
}

export function FeatureCardGrid({
  items,
  columns = 3,
  className = '',
  cardClassName = 'bg-ods-card border border-ods-border rounded-lg p-0 overflow-hidden',
  itemClassName = 'bg-ods-bg p-10',
  showBorders = true,
  roundedCorners = false,
  cardGap = ''
}: FeatureCardGridProps) {
  const gridCols = columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3';
  const itemsPerRow = columns;
  const rows = Math.ceil(items.length / itemsPerRow);

  const getBorderClasses = (isLastRow: boolean, isLastInRow: boolean, globalIndex: number) => {
    if (!showBorders) return '';
    
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

  // Check if all cards have noBackground to modify card container
  const allCardsHaveNoBackground = items.every(item => item.noBackground);
  const allCardsHaveNoBorders = items.every(item => item.removeAllBorders);

  let finalCardClassName = cardClassName;
  if (allCardsHaveNoBackground) {
    finalCardClassName = finalCardClassName.replace('bg-ods-card', 'bg-transparent');
  }
  if (allCardsHaveNoBorders) {
    finalCardClassName = 'bg-transparent p-0 overflow-visible border-0 shadow-none rounded-none';
  }

  return (
    <Card className={`${finalCardClassName} ${className}`}>
      {Array.from({ length: rows }, (_, rowIndex) => {
        const startIndex = rowIndex * itemsPerRow;
        const rowItems = items.slice(startIndex, startIndex + itemsPerRow);
        const isLastRow = rowIndex === rows - 1;

        return (
          <div key={rowIndex} className={`grid ${gridCols} ${cardGap}`}>
            {rowItems.map((item, itemIndex) => {
              const globalIndex = startIndex + itemIndex;
              const isLastInRow = itemIndex === rowItems.length - 1;
              const borderClasses = getBorderClasses(isLastRow, isLastInRow, globalIndex);

              // Apply card-level customizations
              let finalItemClassName = itemClassName;
              let finalBorderClasses = borderClasses;

              // Handle background customization
              if (item.noBackground) {
                finalItemClassName = finalItemClassName.replace('bg-ods-bg', 'bg-transparent');
              } else if (item.customBackground) {
                finalItemClassName = finalItemClassName.replace('bg-ods-bg', item.customBackground);
              }

              // Handle border removal
              if (item.removeAllBorders) {
                finalBorderClasses = '';
              }

              // Handle rounded corners
              if (roundedCorners) {
                finalItemClassName += ' rounded-lg';
              }

              return (
                <div
                  key={globalIndex}
                  className={`${finalItemClassName}${finalBorderClasses} relative`}
                  style={item.customBackground ? { backgroundColor: item.customBackground } : undefined}
                >
                  <div className={!item.icon && !item.title ? "flex flex-col h-full" : "space-y-6"}>
                    {item.icon && (
                      <div className="flex items-start justify-between">
                        <item.icon size={80} color={item.iconColor} />
                        {item.badge && (
                          <StatusBadge
                            text={item.badge.text}
                            variant={item.badge.variant || 'card'}
                            colorScheme={item.badge.colorScheme || 'default'}
                          />
                        )}
                      </div>
                    )}

                    {!item.icon && item.badge && (
                      <div className="flex items-start justify-end">
                        <StatusBadge
                          text={item.badge.text}
                          variant={item.badge.variant || 'card'}
                          colorScheme={item.badge.colorScheme || 'default'}
                        />
                      </div>
                    )}

                    <h3 className="font-['Azeret_Mono'] font-semibold text-[28px] md:text-[32px] leading-[1.25] tracking-[-0.64px] text-ods-text-primary whitespace-pre-line">
                      {item.title}
                    </h3>

                    {item.content}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </Card>
  );
}