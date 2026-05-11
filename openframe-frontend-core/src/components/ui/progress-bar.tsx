'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMdUp } from '@/hooks';

type ProgressBarProps = {
  progress: number; // 0–100
  warningThreshold?: number; // default 70
  criticalThreshold?: number; // default 90
  segmentWidth?: number; // desktop segment width (px)
  mobileSegmentWidth?: number; // mobile segment width (px)
  segmentGap?: number; // px, default 2
  height?: number; // desktop height (px)
  mobileHeight?: number; // mobile height (px)
  inverted?: boolean; // if true, high values are good (green), low values are bad (red)
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  warningThreshold = 75,
  criticalThreshold = 90,
  segmentWidth = 3.43,
  mobileSegmentWidth = 5.09,
  segmentGap = 2,
  height = 24,
  mobileHeight = 8,
  inverted = false,
}) => {
  const isMdUp = useMdUp() ?? true;
  const effectiveSegmentWidth = isMdUp ? segmentWidth : mobileSegmentWidth;
  const effectiveHeight = isMdUp ? height : mobileHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const [segmentCount, setSegmentCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const count = Math.floor(width / (effectiveSegmentWidth + segmentGap));
        setSegmentCount(count);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [effectiveSegmentWidth, segmentGap]);

  // Pick color based on thresholds using ODS design tokens
  const getColor = () => {
    if (inverted) {
      // Inverted: high values = good (green), low values = bad (red)
      // For battery health: 100% = green, <30% = red
      if (progress >= criticalThreshold) return "var(--ods-attention-green-success)"; // high = green
      if (progress >= warningThreshold) return "var(--color-warning)"; // medium = warning
      return "var(--ods-attention-red-error)"; // low = red
    } else {
      // Normal: high values = bad (red), low values = good (green)
      // For disk usage: 100% = red, <70% = green
      if (progress >= criticalThreshold) return "var(--ods-attention-red-error)"; // critical red
      if (progress >= warningThreshold) return "var(--color-warning)"; // warning yellow
      return "var(--ods-attention-green-success)"; // base green
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex"
      style={{ gap: `${segmentGap}px` }}
    >
      {Array.from({ length: segmentCount }).map((_, i) => (
        <div
          key={i}
          className="rounded"
          style={{
            width: `${effectiveSegmentWidth}px`,
            height: `${effectiveHeight}px`,
            backgroundColor:
              i < Math.round((progress / 100) * segmentCount)
                ? getColor()
                : "var(--ods-system-greys-soft-grey-action)", // unfilled segments
          }}
        />
      ))}
    </div>
  );
};
