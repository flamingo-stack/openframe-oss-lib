import React from 'react';

export interface ResponsiveIconsBlockProps {
  children?: React.ReactNode;
  className?: string;
}

export function ResponsiveIconsBlock({ children, className }: ResponsiveIconsBlockProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}