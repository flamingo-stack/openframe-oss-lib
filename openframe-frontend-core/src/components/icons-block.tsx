"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  VendorDirectoryIcon,
  OpenSourceIcon,
  CommunityHubIcon,
  VendorsIcon,
  CommunityIcon,
  CompareIcon,
} from './icons-stub';
import { Sun, Moon, CheckCircle, Github, PlusCircle } from 'lucide-react';

// Map lucide icons
const SunIcon = Sun;
const MoonIcon = Moon;
const CheckCircleIcon = CheckCircle;
const GitHubIcon = Github;
const PlusCircleIcon = PlusCircle;
const OpenmspLogo = () => <div>Logo</div>;

interface IconsBlockProps {
  /**
   * When true, always render the loading placeholder bar regardless of whether the grid is ready.
   * Default behaviour renders placeholder only until the grid is generated.
   */
  loading?: boolean;
}

// Available icons array - moved outside component to prevent recreating on each render
const availableIcons = [
  VendorDirectoryIcon,
  OpenSourceIcon,
  CommunityHubIcon,
  VendorsIcon,
  CommunityIcon,
  CompareIcon,
  SunIcon,
  MoonIcon,
  CheckCircleIcon,
  GitHubIcon,
  PlusCircleIcon,
  OpenmspLogo
];

export function ResponsiveIconsBlock({ loading = false }: IconsBlockProps) {
  const [columns, setColumns] = useState(24);
  const [iconGrid, setIconGrid] = useState<Array<Array<React.ComponentType<{ width?: number; height?: number; className?: string }>>>>([]);
  const [iconsLoaded, setIconsLoaded] = useState(false);
  const randomSeedRef = useRef<number>(0);

  useEffect(() => {
    function calculateColumns() {
        const cols = Math.ceil(window.innerWidth / 56) + 4;
        setColumns(cols);
    }

    calculateColumns();
    window.addEventListener('resize', calculateColumns);
    
    setIconsLoaded(true);
    
    return () => window.removeEventListener('resize', calculateColumns);
  }, []);

  // Generate icon grid only on client side
  useEffect(() => {
    if (randomSeedRef.current === 0) {
      randomSeedRef.current = Date.now();
    }

    const grid: any[][] = [];
    const totalCells = columns * 2;

    for (let idx = 0; idx < totalCells; idx++) {
      const col = idx % columns;
      const row = Math.floor(idx / columns);

      // Initialize row if needed
      if (!grid[row]) grid[row] = [];

      // Get adjacent icons to avoid
      const adjacentIcons = new Set();

      // Check left neighbor (same row, previous column)
      if (col > 0 && grid[row][col - 1]) {
        adjacentIcons.add(grid[row][col - 1]);
      }

      // Check top neighbor (previous row, same column)
      if (row > 0 && grid[row - 1] && grid[row - 1][col]) {
        adjacentIcons.add(grid[row - 1][col]);
      }

      // Filter available icons to exclude adjacent ones
      const availableOptions = availableIcons.filter(icon => !adjacentIcons.has(icon));

      // Generate random selection from available options using the stable seed
      const seed = randomSeedRef.current + idx;
      const pseudoRandom = (seed * 9301 + 49297) % 233280;
      const normalized = pseudoRandom / 233280;
      const iconIndex = Math.floor(normalized * availableOptions.length);

      // Assign selected icon to grid
      grid[row][col] = availableOptions[iconIndex] || availableIcons[0]; // Fallback to first icon
    }

    setIconGrid(grid);
  }, [columns]);

  const displayColumns = columns;

  // Get icon for specific position from pre-generated grid
  const getIconForIndex = (index: number) => {
    const col = index % displayColumns;
    const row = Math.floor(index / displayColumns);
    return iconGrid[row]?.[col] || availableIcons[0];
  };

  // When explicit loading prop true OR grid not ready → show placeholder
  if (loading || iconGrid.length === 0) {
    return (
      <div
        className="w-full h-[80px] sm:h-[96px] md:h-[112px] bg-[#1A1A1A] relative overflow-hidden"
        role="presentation"
        aria-hidden="true"
      >
        {/* subtle pulse bar */}
        <div className="absolute inset-0 animate-pulse bg-[#2A2A2A]/60" />
      </div>
    );
  }

  return (
    <div
      className="w-full h-[80px] sm:h-[96px] md:h-[112px] overflow-hidden bg-[#1A1A1A] relative z-10"
      style={{ margin: 0, padding: 0 }}
      role="presentation"
      aria-hidden="true"
    >
      <style>{`
        .icons-block svg,
        .icons-block svg * {
          filter: grayscale(100%) brightness(0) invert(1) brightness(0.4) !important;
          fill: currentColor !important;
        }
      `}</style>
      <div
        className="grid h-full icons-block w-full"
        style={{
          gridTemplateColumns: `repeat(${displayColumns}, 56px)`,
          gridTemplateRows: 'repeat(2, 1fr)',
        }}
      >
        {Array.from({ length: displayColumns * 2 }).map((_, idx) => {
          const col = idx % displayColumns;
          const row = Math.floor(idx / displayColumns);
          const IconComponent = getIconForIndex(idx);

          return (
            <div
              key={idx}
              className="flex items-center justify-center w-full h-full"
              style={{
                background: '#1A1A1A',
                borderRight: col !== displayColumns - 1 ? '0.5px solid rgba(66, 66, 66, 0.5)' : undefined,
                borderBottom: row === 0 ? '0.5px solid rgba(66, 66, 66, 0.5)' : undefined,
                margin: 0,
                padding: '8px',
                boxSizing: 'border-box',
              }}
              role="presentation"
            >
                  <IconComponent
                    width={16}
                    height={16}
                    className="text-[#666666] sm:w-5 sm:h-5"
                    aria-hidden="true"
                  />
            </div>
          );
        })}
      </div>
    </div>
  );
} 