// Color analysis utilities for dynamic badge colors

export interface ColorPalette {
  name: string;
  hex: string;
  rgb: [number, number, number];
}

// Your design system color palette - Star colors only
export const DESIGN_PALETTE: ColorPalette[] = [
  { name: 'yellow', hex: '#FFC008', rgb: [255, 192, 8] },
  { name: 'black', hex: '#161616', rgb: [22, 22, 22] },
  { name: 'gray', hex: '#888888', rgb: [136, 136, 136] },
];

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

/**
 * Calculate relative luminance for contrast calculations
 */
export function getLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Pick the readable foreground shade for an arbitrary background hex — 'dark'
 * when dark text has the better WCAG contrast on it, 'light' otherwise.
 * Callers map the result to an ODS THEME, not to color literals (e.g. the
 * announcement bar scopes its content with .theme-light when the background
 * needs dark-on-light, .theme-dark otherwise — every color then resolves
 * from the active theme's own tokens).
 */
export function pickReadableTextColor(bgHex: string): 'dark' | 'light' {
  const bg = hexToRgb(bgHex);
  const darkContrast = getContrastRatio(bg, [26, 26, 26]);
  const lightContrast = getContrastRatio(bg, [250, 250, 250]);
  return darkContrast >= lightContrast ? 'dark' : 'light';
}

/**
 * Extract dominant color from image canvas
 */
export function extractDominantColor(canvas: HTMLCanvasElement): [number, number, number] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [128, 128, 128]; // fallback gray

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Sample pixels in a grid pattern for performance
  const sampleSize = Math.max(1, Math.floor(data.length / (4 * 1000))); // ~1000 samples
  const colorCounts: { [key: string]: number } = {};

  for (let i = 0; i < data.length; i += 4 * sampleSize) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];

    // Skip transparent pixels
    if (alpha < 128) continue;

    // Bucket colors to reduce noise (round to nearest 32)
    const bucketR = Math.round(r / 32) * 32;
    const bucketG = Math.round(g / 32) * 32;
    const bucketB = Math.round(b / 32) * 32;

    const key = `${bucketR},${bucketG},${bucketB}`;
    colorCounts[key] = (colorCounts[key] || 0) + 1;
  }

  // Find most common color
  let maxCount = 0;
  let dominantColor: [number, number, number] = [128, 128, 128];

  for (const [colorKey, count] of Object.entries(colorCounts)) {
    if (count > maxCount) {
      maxCount = count;
      const [r, g, b] = colorKey.split(',').map(Number);
      dominantColor = [r, g, b];
    }
  }

  return dominantColor;
}

/**
 * Find the best contrasting color from the design palette
 */
export function getBestContrastColor(imageColor: [number, number, number]): ColorPalette {
  let bestColor = DESIGN_PALETTE[0];
  let bestContrast = 0;

  for (const color of DESIGN_PALETTE) {
    const contrast = getContrastRatio(imageColor, color.rgb);
    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestColor = color;
    }
  }

  // Ensure minimum contrast ratio of 3:1 for readability
  return bestContrast >= 3 ? bestColor : DESIGN_PALETTE.find(c => c.name === 'black') || bestColor;
}

/**
 * Load image and analyze its dominant color
 */
export function analyzeImageColor(imageSrc: string): Promise<ColorPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Resize to smaller canvas for performance
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dominantColor = extractDominantColor(canvas);
        const bestContrastColor = getBestContrastColor(dominantColor);

        resolve(bestContrastColor);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });
}

/**
 * Extract the dominant edge/corner color from an image URL.
 * Used for background fill behind images in emails and cards.
 * Client-side only (uses canvas). Returns hex color string.
 */
export async function extractImageEdgeColorAsync(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve('#000000'); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve('#000000'); return }
        const maxSize = 50
        const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight)
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        canvas.width = w; canvas.height = h
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        // Sample edge pixels (15% band on all sides) with color bucketing
        const edgeW = Math.max(2, Math.round(w * 0.15))
        const edgeH = Math.max(2, Math.round(h * 0.15))
        const bucketSize = 32
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (!(x < edgeW || x >= w - edgeW || y < edgeH || y >= h - edgeH)) continue
            const i = (y * w + x) * 4
            if (data[i + 3] < 128) continue
            const br = Math.floor(data[i] / bucketSize) * bucketSize
            const bg = Math.floor(data[i + 1] / bucketSize) * bucketSize
            const bb = Math.floor(data[i + 2] / bucketSize) * bucketSize
            const key = `${br},${bg},${bb}`
            const existing = buckets.get(key)
            if (existing) { existing.r += data[i]; existing.g += data[i + 1]; existing.b += data[i + 2]; existing.count++ }
            else { buckets.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], count: 1 }) }
          }
        }
        let best = { r: 0, g: 0, b: 0, count: 0 }
        for (const b of buckets.values()) { if (b.count > best.count) best = b }
        if (best.count === 0) { resolve('#000000'); return }
        const r = Math.round(best.r / best.count), g = Math.round(best.g / best.count), b = Math.round(best.b / best.count)
        resolve(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`)
      } catch { resolve('#000000') }
    }
    img.onerror = () => resolve('#000000')
    img.src = imageUrl
  })
}
