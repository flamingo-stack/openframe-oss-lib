export function getProxiedImageUrl(url: string): string {
  // Simple pass-through for now - can be enhanced later
  return url
}

export function generateImageSizes(url: string): string {
  // Return responsive image sizes
  return `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw`
}