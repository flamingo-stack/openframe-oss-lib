'use client';

import React, { useEffect, useRef, useState } from 'react';

type ProgressBarProps = {
  progress: number; // 0–100
  warningThreshold?: number; // default 70
  criticalThreshold?: number; // default 90
  segmentWidth?: number; // px, default 6
  segmentGap?: number; // px, default 2
  height?: number; // px, default 16
  inverted?: boolean; // if true, high values are good (green), low values are bad (red)
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  warningThreshold = 75,
  criticalThreshold = 90,
  segmentWidth = 6,
  segmentGap = 2,
  height = 16,
  inverted = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [segmentCount, setSegmentCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const count = Math.floor(width / (segmentWidth + segmentGap));
        setSegmentCount(count);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [segmentWidth, segmentGap]);

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
    <div ref={containerRef} className="w-full flex gap-[2px]">
      {Array.from({ length: segmentCount }).map((_, i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            width: `${segmentWidth}px`,
            height: `${height}px`,
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
