// Vendor media utilities for UI kit
// Real implementation copied from main project

import { fixSupabaseStorageUrl } from './url-fix';

export interface VendorMedia {
  media_type: 'logo' | 'image' | 'video';
  media_url: string;
}

export interface VendorWithMedia {
  id?: number;
  title: string;
  slug?: string;
  logo?: string | null;
  logo_url?: string; // Support direct logo_url field from lightweight API
  vendor_media?: VendorMedia[];
}

/**
 * Get the logo URL from vendor_media array or direct logo_url field
 */
export function getVendorLogo(vendor: VendorWithMedia): string | null {
  // First check for direct logo_url field (from lightweight API)
  if (vendor.logo_url) {
    return fixSupabaseStorageUrl(vendor.logo_url);
  }
  
  // Check for legacy logo field
  if (vendor.logo) {
    return fixSupabaseStorageUrl(vendor.logo);
  }
  
  // Fallback to vendor_media array (from detailed API)
  const logoMedia = vendor.vendor_media?.find(m => m.media_type === 'logo');
  if (logoMedia?.media_url) {
    return fixSupabaseStorageUrl(logoMedia.media_url);
  }
  
  return null;
}

/**
 * Get the main image URL from vendor_media array
 */
export function getVendorImage(vendor: VendorWithMedia): string | null {
  const imageMedia = vendor.vendor_media?.find(m => m.media_type === 'image');
  return imageMedia?.media_url ? fixSupabaseStorageUrl(imageMedia.media_url) : null;
}

/**
 * Get the video URL from vendor_media array
 */
export function getVendorVideo(vendor: VendorWithMedia): string | null {
  const videoMedia = vendor.vendor_media?.find(m => m.media_type === 'video');
  return videoMedia?.media_url ? fixSupabaseStorageUrl(videoMedia.media_url) : null;
}

/**
 * Get all media URLs of a specific type
 */
export function getVendorMediaByType(vendor: VendorWithMedia, type: 'logo' | 'image' | 'video'): string[] {
  return vendor.vendor_media?.filter(m => m.media_type === type).map(m => fixSupabaseStorageUrl(m.media_url)) || [];
}

/**
 * Get all media items grouped by type
 */
export function getVendorMediaGrouped(vendor: VendorWithMedia): {
  logos: string[];
  images: string[];
  videos: string[];
} {
  const media = vendor.vendor_media || [];
  
  return {
    logos: media.filter(m => m.media_type === 'logo').map(m => fixSupabaseStorageUrl(m.media_url)),
    images: media.filter(m => m.media_type === 'image').map(m => fixSupabaseStorageUrl(m.media_url)),
    videos: media.filter(m => m.media_type === 'video').map(m => fixSupabaseStorageUrl(m.media_url))
  };
}

/**
 * Add new media to vendor_media array (useful for admin interfaces)
 */
export function addVendorMedia(vendor: VendorWithMedia, type: 'logo' | 'image' | 'video', url: string): VendorMedia[] {
  const existingMedia = vendor.vendor_media || [];
  const newMedia: VendorMedia = { media_type: type, media_url: url };
  return [...existingMedia, newMedia];
}

/**
 * Remove media from vendor_media array
 */
export function removeVendorMedia(vendor: VendorWithMedia, url: string): VendorMedia[] {
  return vendor.vendor_media?.filter(m => m.media_url !== url) || [];
}

/**
 * Check if vendor has media of a specific type
 */
export function hasVendorMedia(vendor: VendorWithMedia, type: 'logo' | 'image' | 'video'): boolean {
  return vendor.vendor_media?.some(m => m.media_type === type) || false;
}

/**
 * Get media count by type
 */
export function getVendorMediaCount(vendor: VendorWithMedia): {
  logos: number;
  images: number;
  videos: number;
  total: number;
} {
  const media = vendor.vendor_media || [];
  
  const logos = media.filter(m => m.media_type === 'logo').length;
  const images = media.filter(m => m.media_type === 'image').length;
  const videos = media.filter(m => m.media_type === 'video').length;
  
  return {
    logos,
    images,
    videos,
    total: media.length
  };
}