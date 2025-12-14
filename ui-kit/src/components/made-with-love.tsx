'use client'

import React, { useState, useEffect } from 'react';
import { FlamingoLogo } from './flamingo-logo';
import { getBaseUrl } from '../utils';

interface MadeWithLoveProps {
  /** Custom class name for the container */
  className?: string;
  /** Size variant for the component */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show on mobile (responsive) */
  showOnMobile?: boolean;
}

export function MadeWithLove({
  className = '',
  size = 'md',
  showOnMobile = true
}: MadeWithLoveProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Detect mobile/desktop for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px = sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Size configuration with pixel values
  const sizeConfig = {
    sm: {
      logoSize: 14,
      fontSizeMobile: '12px',
      fontSizeDesktop: '14px',
      gap: '4px'
    },
    md: {
      logoSize: 16,
      fontSizeMobile: '14px',
      fontSizeDesktop: '16px',
      gap: '4px'
    },
    lg: {
      logoSize: 20,
      fontSizeMobile: '16px',
      fontSizeDesktop: '18px',
      gap: '6px'
    }
  };

  const config = sizeConfig[size];
  const flamingoUrl = getBaseUrl('flamingo');

  // Container styles using primitive CSS
  const containerStyle: React.CSSProperties = {
    display: (!showOnMobile && isMobile) ? 'none' : 'inline-flex',
    alignItems: 'center',
    gap: config.gap,
    fontSize: isMobile ? config.fontSizeMobile : config.fontSizeDesktop,
    lineHeight: 1.5,
    color: '#ffffff',
    fontFamily: 'inherit'
  };

  // Button/link styles using primitive CSS
  const linkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: 0,
    margin: 0,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textDecoration: isHovered ? 'underline' : 'none',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: '"Azeret Mono", monospace',
    transition: 'text-decoration 0.2s ease',
    outline: 'none'
  };

  // Logo container styles
  const logoStyle: React.CSSProperties = {
    marginLeft: '2px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center'
  };

  // Text span styles
  const textStyle: React.CSSProperties = {
    color: '#ffffff',
    marginLeft: '4px',
    textDecoration: 'none'
  };

  return (
    <div
      style={containerStyle}
      className={className}
    >
      Made with love by
      <a
        href={flamingoUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={logoStyle}>
          <FlamingoLogo
            size={config.logoSize}
            color="#f357bb" // Direct hex instead of CSS variable for cross-framework compatibility
          />
        </div>
        <span style={textStyle}>Flamingo</span>
      </a>
    </div>
  );
}