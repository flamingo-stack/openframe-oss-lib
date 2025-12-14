// Stub for format-text utilities
export function formatText(text: string): string {
  return text;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function formatClassification(classification: string): string {
  return classification.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function formatPricingModel(pricing: string): string {
  return pricing.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}