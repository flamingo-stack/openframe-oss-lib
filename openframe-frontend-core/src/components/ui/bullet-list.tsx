'use client';

import React from 'react';
import { ShapeCircleDashIcon } from '../icons';

export interface BulletListItem {
  text: string;
  id?: string;
}

export interface BulletListProps {
  items: string[] | BulletListItem[];
  bulletColor?: string;
  bulletIcon?: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  bulletSize?: number;
  textClassName?: string;
  itemClassName?: string;
  containerClassName?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

const spacingMap = {
  sm: 'space-y-2',
  md: 'space-y-3',
  lg: 'space-y-4'
};

export function BulletList({
  items,
  bulletColor = 'var(--ods-text-primary)',
  bulletIcon: BulletIcon = ShapeCircleDashIcon,
  bulletSize = 16,
  textClassName = "font-['DM_Sans'] font-medium text-[16px] md:text-[18px] leading-[24px] md:leading-[28px] text-ods-text-primary",
  itemClassName = 'flex items-start gap-3',
  containerClassName = '',
  spacing = 'md'
}: BulletListProps) {
  const normalizedItems = items.map(item =>
    typeof item === 'string' ? { text: item, id: undefined } : item
  );

  return (
    <div className={`${spacingMap[spacing]} ${containerClassName}`}>
      {normalizedItems.map((item, index) => (
        <div key={item.id || index} className={itemClassName}>
          {/* <div className="flex-shrink-0 mt-[0.75rem]"> */}
          <div className="flex-shrink-0 mt-1">
            <BulletIcon size={bulletSize} color={bulletColor} />
          </div>
          {/* </div> */}
          <p className={textClassName}>
            {item.text}
          </p>
        </div>
      ))}
    </div>
  );
}