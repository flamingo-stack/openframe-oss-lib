import { describe, expect, it } from 'vitest';
import { skipsImageOptimizer } from './image-proxy';

describe('skipsImageOptimizer', () => {
  it('skips Google-hosted avatars and SVGs, nothing else', () => {
    expect(skipsImageOptimizer('https://lh3.googleusercontent.com/a/abc=s96-c')).toBe(true);
    expect(skipsImageOptimizer('//lh3.googleusercontent.com/a/abc')).toBe(true);
    expect(skipsImageOptimizer('https://cdn.example.com/logo.svg?v=2')).toBe(true);
    expect(skipsImageOptimizer('https://evilgoogleusercontent.com/a.png')).toBe(false);
    expect(skipsImageOptimizer('https://cdn.example.com/photo.jpg')).toBe(false);
    expect(skipsImageOptimizer('/api/image-proxy?url=x')).toBe(false);
    expect(skipsImageOptimizer(null)).toBe(false);
  });
});
