'use client';

import { cn } from '../utils/cn';
import { useProxiedImageUrl } from './chat/hooks/use-proxied-image-url';
import { TextLineSkeleton } from './loading/unified-skeleton';
import { useLoadingScope } from './ui/loading-scope';
import { SquareAvatar } from './ui/square-avatar';

interface MSPDisplayProps {
  name: string;
  logoUrl?: string | null;
  size?: number; // avatar size in px (square)
  className?: string;
}

/** The row's layout, read by the row and by its skeleton, so the skeleton is the row's size. */
const MSP_ROW_CLASS = 'flex min-w-0 items-center gap-2';
const MSP_NAME_CLASS = 'truncate pl-2';

export function MSPDisplay({ name, logoUrl, size = 40, className }: MSPDisplayProps) {
  const logoSrc = useProxiedImageUrl(logoUrl);
  if (useLoadingScope()) return <MSPDisplaySkeleton size={size} className={className} />;
  return (
    <div className={cn(MSP_ROW_CLASS, className)}>
      <SquareAvatar src={logoSrc || undefined} fallback={name} alt={name} sizePx={size} />
      <h2 className={MSP_NAME_CLASS}>{name}</h2>
    </div>
  );
}

/** The row while it is read: the logo's box and a bar on the name's line. */
export function MSPDisplaySkeleton({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div className={cn(MSP_ROW_CLASS, className)} aria-hidden>
      <SquareAvatar loading sizePx={size} />
      <div className={MSP_NAME_CLASS}>
        <TextLineSkeleton type="inherit" as="span" className="inline-block w-32 align-top" />
      </div>
    </div>
  );
}
