import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from "../utils/cn";

interface XButtonProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  backgroundColor?: string;
  borderColor?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function XButton({
  className,
  size = 'icon',
  backgroundColor = 'transparent',
  borderColor = 'transparent',
  onClick
}: XButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  // Create dynamic styles for background and border with hover handling
  const dynamicStyles = {
    backgroundColor: isHovered 
      ? 'transparent' // Transparent hover color
      : (backgroundColor !== 'transparent' ? backgroundColor : 'transparent'),
    borderColor: borderColor !== 'transparent' ? borderColor : 'transparent',
    borderWidth: borderColor !== 'transparent' ? '1px' : undefined,
    borderStyle: borderColor !== 'transparent' ? 'solid' : undefined,
  } as React.CSSProperties;

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "rounded-lg transition-all duration-200", 
        size === 'icon' && "h-8 w-8 p-0",
        size === 'default' && "h-10 w-10 p-0",
        size === 'sm' && "h-6 w-6 p-0",
        size === 'lg' && "h-12 w-12 p-0",
        className
      )}
      style={dynamicStyles}
    >
      <X 
        className={cn(
          "transition-transform text-white",
          size === 'icon' && "h-4 w-4",
          size === 'default' && "h-5 w-5",
          size === 'sm' && "h-3 w-3",
          size === 'lg' && "h-6 w-6"
        )}
      />
    </Button>
  );
} 