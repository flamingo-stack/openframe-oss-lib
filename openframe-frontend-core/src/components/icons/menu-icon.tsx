import React from 'react';
import { Menu } from 'lucide-react';

interface MenuIconProps {
  className?: string;
  width?: number;
  height?: number;
}

/** @deprecated Use icons from icons-v2-generated instead. */
export const MenuIcon: React.FC<MenuIconProps> = ({ 
  className = "", 
  width = 24, 
  height = 24 
}) => {
  return (
    <Menu 
      width={width} 
      height={height} 
      className={className}
    />
  );
}; 