"use client";

import { useState, useEffect } from 'react';

/**
 * Extract the dominant edge color from an image.
 * Samples pixels along all four edges and returns the average color.
 * Useful for creating seamless letterbox backgrounds behind object-contain images.
 */
function extractEdgeColor(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#000000';

  // Small canvas for performance
  const maxSize = 80;
  const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;

  const edgeWidth = Math.max(1, Math.round(w * 0.05));
  const edgeHeight = Math.max(1, Math.round(h * 0.05));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isEdge =
        x < edgeWidth || x >= w - edgeWidth ||
        y < edgeHeight || y >= h - edgeHeight;

      if (!isEdge) continue;

      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 128) continue;

      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      count++;
    }
  }

  if (count === 0) return '#000000';

  const r = Math.round(rSum / count);
  const g = Math.round(gSum / count);
  const b = Math.round(bSum / count);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Hook that extracts the dominant edge color from an image URL.
 * Returns a CSS color string for use as a background behind object-contain images.
 *
 * @param imageUrl - URL of the image to analyze
 * @param fallback - Fallback color if extraction fails (default: '#000000')
 * @returns CSS color string (e.g., 'rgb(34, 28, 22)')
 */
export function useImageEdgeColor(imageUrl: string | undefined | null, fallback = '#000000'): string {
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    if (!imageUrl) {
      setColor(fallback);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        setColor(extractEdgeColor(img));
      } catch {
        setColor(fallback);
      }
    };

    img.onerror = () => setColor(fallback);
    img.src = imageUrl;
  }, [imageUrl, fallback]);

  return color;
}
