'use client';

import type { ReactNode } from 'react';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { Header, type HeaderConfig } from './header';
import { HeaderSkeleton } from './header-skeleton';

export interface ClientOnlyHeaderProps {
  config: HeaderConfig;
  skeleton?: ReactNode;
}

export function ClientOnlyHeader({ config, skeleton }: ClientOnlyHeaderProps) {
  const isClient = useIsHydrated();

  if (!isClient) {
    // Return custom skeleton or default skeleton while client-side JavaScript loads
    return skeleton || <HeaderSkeleton config={config} />;
  }

  return <Header config={config} />;
}
