'use client';

import { ArrowRight } from 'lucide-react';
import type React from 'react';
import { Button } from '../ui/button';

interface MoreAboutButtonProps {
  onClick?: () => void;
  href?: string;
  className?: string;
}

const MoreAboutButton: React.FC<MoreAboutButtonProps> = ({ href = '/openframe', className = '' }) => {
  return (
    <Button
      size="default"
      variant="transparent"
      className={`flex-shrink-0 text-[var(--ods-open-yellow-base)] ${className}`}
      rightIcon={<ArrowRight className="h-6 w-6" />}
      href={href}
      openInNewTab={!!href}
    >
      Learn more
    </Button>
  );
};

export { MoreAboutButton };
export default MoreAboutButton;
