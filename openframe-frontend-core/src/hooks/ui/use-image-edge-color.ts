"use client";

import { useState, useEffect } from 'react';

/**
 * Extract the dominant edge color from an image using color bucketing.
 * Samples pixels along left and right edges (the visible letterbox areas),
 * groups them into color buckets, and returns the most common bucket.
 * This avoids muddy averages when edges have mixed colors (e.g., sky + sand).
 */
function extractEdgeColor(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#000000';

  const maxSize = 100;
  const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;

  // Sample left edge, right edge, top edge, bottom edge (15% band)
  const edgeW = Math.max(2, Math.round(w * 0.15));
  const edgeH = Math.max(2, Math.round(h * 0.15));

  // Color bucketing: quantize to 32-step buckets for grouping similar colors
  const bucketSize = 32;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isEdge =
        x < edgeW || x >= w - edgeW ||
        y < edgeH || y >= h - edgeH;

      if (!isEdge) continue;

      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 128) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Quantize to bucket
      const br = Math.floor(r / bucketSize) * bucketSize;
      const bg = Math.floor(g / bucketSize) * bucketSize;
      const bb = Math.floor(b / bucketSize) * bucketSize;
      const key = `${br},${bg},${bb}`;

      const existing = buckets.get(key);
      if (existing) {
        existing.r += r;
        existing.g += g;
        existing.b += b;
        existing.count++;
      } else {
        buckets.set(key, { r, g, b, count: 1 });
      }
    }
  }

  if (buckets.size === 0) return '#000000';

  // Find the most common color bucket
  let bestBucket: { r: number; g: number; b: number; count: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!bestBucket || bucket.count > bestBucket.count) {
      bestBucket = bucket;
    }
  }

  if (!bestBucket || bestBucket.count === 0) return '#000000';

  // Return average color within the winning bucket
  const r = Math.round(bestBucket.r / bestBucket.count);
  const g = Math.round(bestBucket.g / bestBucket.count);
  const b = Math.round(bestBucket.b / bestBucket.count);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Hook that extracts the dominant edge color from an image URL.
 * Returns a CSS color string for use as a background behind object-contain images.
 *
 * Always sets crossOrigin='anonymous' — required for canvas pixel access.
 * Most CDNs (Supabase, Cloudflare, our image proxy) return CORS headers.
 * If the server doesn't support CORS, onerror fires and we use the fallback.
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

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;
      try {
        setColor(extractEdgeColor(img));
      } catch {
        setColor(fallback);
      }
    };

    img.onerror = () => {
      if (cancelled) return;
      setColor(fallback);
    };

    img.src = imageUrl;

    return () => { cancelled = true; };
  }, [imageUrl, fallback]);

  return color;
}
