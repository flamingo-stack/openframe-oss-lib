import React from "react";

interface CategoryCardProps {
  name: string;
  description: string;
  categoryCount: number;
  productCount: number;
  icons?: React.ReactNode[];
}

export function CategoryCard({ name, description, categoryCount, productCount, icons = [] }: CategoryCardProps) {
  return (
    <article className="bg-[#1A1A1A] border border-[#424242] rounded-[12px] p-8 flex flex-col min-w-0 box-border">
      <div className="flex gap-6 mb-8 justify-center items-center">
        {(icons.length > 0 ? icons : Array(10).fill(null)).map((icon, i) => (
          <div key={i} className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
            {icon}
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <h2 className="text-[24px] font-bold text-ods-text-primary mb-2 text-left leading-tight">{name}</h2>
        <div className="text-[16px] text-ods-text-secondary mb-4 text-left">
          {categoryCount} Categories • {productCount} Products
        </div>
        <div className="flex flex-row items-start">
          <p className="text-[16px] text-ods-text-primary text-left leading-snug flex-1">{description}</p>
          <button
            className="w-12 h-12 flex items-center justify-center border border-ods-border rounded-[6px] bg-transparent hover:bg-[#FFC008] transition-colors ml-4"
            style={{ minWidth: 48, minHeight: 48 }}
            aria-label={`View ${name}`}
          >
            <svg width="24" height="24" fill="none" stroke="#FAFAFA" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
    </article>
  );
} 