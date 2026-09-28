'use client';

import type React from 'react';

interface CategoryCardProps {
  name: string;
  description: string;
  categoryCount: number;
  productCount: number;
  icons?: React.ReactNode[];
}

export function CategoryCard({ name, description, categoryCount, productCount, icons = [] }: CategoryCardProps) {
  return (
    <article className="box-border flex min-w-0 flex-col rounded-[12px] border border-ods-border bg-ods-card p-8">
      <div className="mb-8 flex items-center justify-center gap-6">
        {(icons.length > 0 ? icons : Array(10).fill(null)).map((icon, i) => (
          <div key={i} className="flex h-10 w-10 items-center justify-center rounded bg-ods-skeleton">
            {icon}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <h2 className="mb-2 text-left text-ods-text-primary text-h2">{name}</h2>
        <div className="mb-4 text-left text-ods-text-secondary text-h6">
          {categoryCount} Categories • {productCount} Products
        </div>
        <div className="flex flex-row items-start">
          <p className="flex-1 text-left text-ods-text-primary text-h6">{description}</p>
          <button
            className="ml-4 flex h-12 w-12 items-center justify-center rounded-[6px] border border-ods-border bg-transparent transition-colors hover:bg-ods-accent"
            style={{ minWidth: 48, minHeight: 48 }}
            aria-label={`View ${name}`}
          >
            <svg width="24" height="24" fill="none" stroke="#FAFAFA" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
