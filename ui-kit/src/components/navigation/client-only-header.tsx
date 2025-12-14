"use client";

import { useState, useEffect } from 'react';
import { Header, HeaderConfig } from './header';
import { HeaderSkeleton } from './header-skeleton';

export interface ClientOnlyHeaderProps {
  config: HeaderConfig;
  skeleton?: React.ReactNode;
}

export function ClientOnlyHeader({ config, skeleton }: ClientOnlyHeaderProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    // Return custom skeleton or default skeleton while client-side JavaScript loads
    return skeleton || <HeaderSkeleton config={config} />;
  }

  return <Header config={config} />;
}