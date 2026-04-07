'use client';

import React from 'react';

export interface FeatureListItemData {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface FeatureListProps {
  items: FeatureListItemData[];
  className?: string;
  iconBoxSize?: number;
}

export function FeatureList({
  items,
  className = '',
  iconBoxSize = 72,
}: FeatureListProps) {
  return (
    <div
      className={`bg-ods-bg border border-ods-border rounded-[6px] flex flex-col overflow-hidden ${className}`}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={`bg-ods-card flex gap-4 items-start p-4 w-full ${
            index < items.length - 1 ? 'border-b border-ods-border' : ''
          }`}
        >
          <div
            className="bg-ods-bg border border-ods-border flex items-center justify-center rounded-[6px] shrink-0"
            style={{ width: iconBoxSize, height: iconBoxSize }}
          >
            {item.icon}
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <p className="text-h3 text-ods-text-primary">{item.title}</p>
            <p className="text-h6 text-ods-text-secondary normal-case tracking-normal">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
