'use client';

import { ExternalLink } from 'lucide-react';
import React from 'react';
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

export function BrandAssociationCard({ item, className = '' }: BrandAssociationCardProps) {
  // Helper function to render icon - handle both React elements and components
  const renderIcon = () => {
    // If it's already a React element, just return it
    if (React.isValidElement(item.icon)) {
      return item.icon;
    }

    // If it's a component type, render it with props
    const IconComponent = item.icon as React.ComponentType<{ size?: number; color?: string; className?: string }>;
    return <IconComponent size={120} color="currentColor" className="h-20 w-20" />;
  };

  return (
    <div className={`relative bg-ods-bg p-10 ${className}`}>
      <div className="space-y-6">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center">{renderIcon()}</div>

        {/* Title */}
        <h3 className="text-ods-text-primary text-h2">{item.title}</h3>

        {/* Description */}
        <p className="text-ods-text-secondary text-h6">{item.description}</p>

        {/* Browse Button */}
        <Button variant="outline" href={item.link} openInNewTab rightIcon={<ExternalLink className="h-4 w-4" />}>
          Browse {item.buttonText}
        </Button>
      </div>
    </div>
  );
}
