'use client';

import { cn } from '../utils/cn';
import { getProxiedImageUrl } from '../utils/image-proxy';
import { SquareAvatar } from './ui/square-avatar';

interface MSPDisplayProps {
  name: string;
  logoUrl?: string | null;
  size?: number; // avatar size in px (square)
  className?: string;
}

export function MSPDisplay({ name, logoUrl, size = 40, className }: MSPDisplayProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <SquareAvatar
        src={logoUrl ? getProxiedImageUrl(logoUrl) || logoUrl : undefined}
        fallback={name}
        alt={name}
        sizePx={size}
      />
      <h2 className="truncate pl-2">{name}</h2>
    </div>
  );
}
