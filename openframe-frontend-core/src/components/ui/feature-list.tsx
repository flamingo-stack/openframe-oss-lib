'use client';

import type React from 'react';

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

export function FeatureList({ items, className = '', iconBoxSize = 72 }: FeatureListProps) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-bg ${className}`}>
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex w-full items-start gap-4 bg-ods-card p-4 ${
            index < items.length - 1 ? 'border-b border-ods-border' : ''
          }`}
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-bg"
            style={{ width: iconBoxSize, height: iconBoxSize }}
          >
            {item.icon}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-ods-text-primary text-h3">{item.title}</p>
            <p className="normal-case tracking-normal text-ods-text-secondary text-h6">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
