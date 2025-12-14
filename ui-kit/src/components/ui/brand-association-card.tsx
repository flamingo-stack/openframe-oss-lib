'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from './button';

export interface BrandAssociationItem {
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }> | React.ReactElement;
  title: string;
  description: string;
  buttonText: string;
  link: string;
}

export interface BrandAssociationCardProps {
  item: BrandAssociationItem;
  className?: string;
}

export function BrandAssociationCard({
  item,
  className = ''
}: BrandAssociationCardProps) {
  // Helper function to render icon - handle both React elements and components
  const renderIcon = () => {
    // If it's already a React element, just return it
    if (React.isValidElement(item.icon)) {
      return item.icon;
    }

    // If it's a component type, render it with props
    const IconComponent = item.icon as React.ComponentType<{ size?: number; color?: string; className?: string }>;
    return <IconComponent size={120} color="currentColor" className="w-20 h-20" />;
  };

  return (
    <div className={`bg-ods-bg p-10 relative ${className}`}>
      <div className="space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 flex items-center justify-center">
          {renderIcon()}
        </div>

        {/* Title */}
        <h3 className="font-['Azeret_Mono'] font-semibold text-[28px] md:text-[32px] leading-[1.25] tracking-[-0.64px] text-ods-text-primary">
          {item.title}
        </h3>

        {/* Description */}
        <p className="font-['DM_Sans'] font-normal text-[16px] leading-[1.5] text-ods-text-secondary">
          {item.description}
        </p>

        {/* Browse Button */}
        <Button
          variant="outline"
          href={item.link}
          openInNewTab
          rightIcon={<ExternalLink className="h-4 w-4" />}
        >
          Browse {item.buttonText}
        </Button>
      </div>
    </div>
  );
}