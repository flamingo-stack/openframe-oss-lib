"use client";

import { useState, useEffect, useRef } from 'react';
import { socialCache } from '../../utils/social-embed-cache';
import { MediaCarousel } from '../media-carousel';
import { RedditContainer } from './embed-container';
import { formatLargeNumber } from '../../utils/format';
import { useRichMarkdownRuntime } from './rich-markdown-runtime';
import type { MediaItem as CarouselMediaItem } from '../../utils/media-carousel-utils-stub';

// Using inline SVG icons to avoid dependency issues
const MessageCircleIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
    <polyline points="15,3 21,3 21,9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="18,15 12,9 6,15"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
);

const UserIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const RedditIcon = () => (
  <svg width="20" height="20" fill="#FF4500" viewBox="0 0 24 24">
    <circle cx="9" cy="12" r="1"/>
    <circle cx="15" cy="12" r="1"/>
    <path d="M22 12a2 2 0 1 0-4 0c0 5.5-4.5 10-10 10S-2 17.5-2 12a2 2 0 1 0-4 0c0 7.7 6.3 14 14 14s14-6.3 14-14z"/>
    <path d="M8 10c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/>
  </svg>
);

// Simplified Reddit profile picture component
const RedditProfilePic = ({ username }: { username: string }) => {
  return (
    <div className="w-8 h-8 bg-[#FF4500] rounded-full flex items-center justify-center flex-shrink-0">
      <span className="text-white font-bold text-xs">u/</span>
    </div>
  );
};

interface RedditPost {
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  created_utc: number;
  ups: number;
  num_comments: number;
  url: string;
  permalink: string;
  preview?: {
    images: Array<{
      source: {
        url: string;
        width: number;
        height: number;
      };
      resolutions: Array<{
        url: string;
        width: number;
        height: number;
      }>;
    }>;
  };
  media?: {
    reddit_video?: {
      fallback_url: string;
      height: number;
      width: number;
      is_gif: boolean;
    };
  };
  secure_media?: {
    reddit_video?: {
      fallback_url: string;
      height: number;
      width: number;
      is_gif: boolean;
    };
  };
  post_hint?: string;
  is_video?: boolean;
  domain?: string;
  gallery_data?: {
    items: Array<{
      media_id: string;
    }>;
  };
  media_metadata?: Record<string, {
    s: {
      u: string;
      x: number;
      y: number;
    };
  }>;
}

// Internal media-item shape; we cast to the carousel's expected MediaItem at
// the render boundary so we don't have to fabricate `id`s/`alt` for every push.
interface MediaItem {
  type: 'image' | 'video';
  src: string;
  width: number;
  height: number;
  alt?: string;
  isGif?: boolean;
  poster?: string;
}

interface RedditEmbedProps {
  url: string;
  maxWidth?: number;
}

export function RedditEmbedClient({ url, maxWidth = 700 }: RedditEmbedProps) {
  const { redditProxyUrl } = useRichMarkdownRuntime();
  const [redditData, setRedditData] = useState<RedditPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializationDone = useRef(false);

  useEffect(() => {
    // Only run once
    if (initializationDone.current) return;
    initializationDone.current = true;

    // Normalize the Reddit URL to JSON format
    const jsonUrl = url.endsWith('.json') ? url : `${url.replace(/\/$/, '')}.json`;

    // Reddit-specific data validator
    const validateRedditData = (data: any): boolean => {
      return data && Array.isArray(data) && data[0] && data[0].data && data[0].data.children && data[0].data.children[0];
    };

    // Use centralized cache hierarchy
    socialCache.fetchWithHierarchy({
      platform: 'reddit',
      url: jsonUrl,
      apiEndpoint: redditProxyUrl,
      dataValidator: validateRedditData,
      onDataUpdate: (data) => {
        if (data[0]?.data?.children?.[0]?.data) {
          setRedditData(data[0].data.children[0].data);
        }
      },
      onError: (errorMsg) => setError(errorMsg),
      onLoading: (loading) => setLoading(loading)
    });
  }, []); // Empty dependency array - only run once

  if (loading) {
    return (
      <RedditContainer>
        <div className="border border-ods-border rounded-lg p-6 bg-ods-card animate-pulse">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-ods-border rounded-full"></div>
            <div>
              <div className="h-4 bg-ods-border rounded w-32 mb-2"></div>
              <div className="h-3 bg-ods-border rounded w-24"></div>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-ods-border rounded w-full"></div>
            <div className="h-4 bg-ods-border rounded w-3/4"></div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="h-4 bg-ods-border rounded w-16"></div>
            <div className="h-4 bg-ods-border rounded w-16"></div>
            <div className="h-4 bg-ods-border rounded w-16"></div>
          </div>
        </div>
      </RedditContainer>
    );
  }

  if (error || !redditData) {
    return (
      <RedditContainer>
        <div className="border border-ods-border rounded-lg p-6 bg-ods-card">
          <div className="flex items-center space-x-3 text-ods-text-secondary mb-4">
            <RedditIcon />
            <span>Reddit post unavailable</span>
          </div>

          <div className="text-center">
            <p className="text-ods-text-secondary text-sm mb-4">
              This Reddit post could not be loaded. It may have been deleted, made private, or the subreddit may be restricted.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#FF4500] text-white rounded-md text-sm font-medium hover:bg-[#E03D00] transition-colors"
            >
              <RedditIcon />
              <span>View on Reddit</span>
            </a>
          </div>
        </div>
      </RedditContainer>
    );
  }

  // Enhanced media extraction from Reddit post data
  const getMediaContent = (): MediaItem[] => {
    // FIRST: Check if the post has been removed or deleted - if so, don't extract media
    // Reddit API exact-match indicators only. Previously this also did
    // `title.toLowerCase().includes('removed' | 'deleted')` which suppressed
    // legitimate posts whose titles mention those words (e.g. "Comment was
    // removed by mods", "Deleted scenes from my favorite movie").
    const isRemovedOrDeleted = redditData.selftext === '[removed]' ||
                               redditData.selftext === '[deleted]' ||
                               redditData.author === '[deleted]' ||
                               (redditData.title && redditData.title.includes('[removed]'));

    if (isRemovedOrDeleted) {
      console.log('🚫 Post content removed - skipping all media extraction for:', redditData.title);
      return []; // Return empty media array for removed posts
    }

    const media: MediaItem[] = [];

    console.log('🔍 Reddit media extraction for:', redditData.title);
    console.log('📊 Full Reddit data structure:', {
      url: redditData.url,
      domain: redditData.domain,
      post_hint: redditData.post_hint,
      is_video: redditData.is_video,
      media: redditData.media,
      secure_media: redditData.secure_media,
      preview: redditData.preview,
      gallery_data: redditData.gallery_data,
      media_metadata: redditData.media_metadata
    });

    // 1. Check for Reddit hosted video (v.redd.it) - PRIORITY
    const video = redditData.media?.reddit_video || redditData.secure_media?.reddit_video;
    if (video && video.fallback_url) {
      console.log('📹 Found Reddit video:', video);

      // Generate poster URL from video URL and preview data
      let posterUrl = '';

      // Try to get poster from preview images first
      if (redditData.preview?.images?.[0]?.source?.url) {
        posterUrl = redditData.preview.images[0].source.url.replace(/&amp;/g, '&');
        console.log('✅ Using preview image as video poster:', posterUrl);
      } else {
        // Fallback: try to generate from video URL
        try {
          const baseUrl = video.fallback_url.replace(/DASH_\d+\.mp4.*$/, '');
          posterUrl = `${baseUrl}DASH_720.jpg`;
          console.log('🎯 Generated poster URL:', posterUrl);
        } catch (e) {
          console.log('Could not generate poster URL');
        }
      }

      // Try to get a better video URL by replacing DASH format
      let videoUrl = video.fallback_url;

      // If it's a DASH URL, try to get a direct MP4 format
      if (videoUrl.includes('DASH_')) {
        // Try different quality levels for Reddit videos
        const baseUrl = videoUrl.replace(/DASH_\d+\.mp4.*$/, '');
        const qualities = ['480', '360', '720', '240']; // Start with 480p for better compatibility

        // Use 480p as default for better compatibility
        videoUrl = `${baseUrl}DASH_480.mp4`;
        console.log('🎯 Optimized Reddit video URL for compatibility:', videoUrl);
      }

      media.push({
        type: 'video',
        src: videoUrl,
        width: video.width || 640,
        height: video.height || 480,
        isGif: video.is_gif || false,
        poster: posterUrl
      });

      // Return early for videos to avoid showing preview images as well
      console.log('📋 Final Reddit media (video):', media);
      return media;
    }

    // 2. Check for Reddit gallery (multiple images)
    if (redditData.media_metadata && redditData.gallery_data) {
      console.log('🖼️ Found Reddit gallery');
      const galleryItems = redditData.gallery_data.items || [];

      for (const item of galleryItems) {
        const mediaId = item.media_id;
        const mediaInfo = redditData.media_metadata[mediaId];

        if (mediaInfo && mediaInfo.s && mediaInfo.s.u) {
          // Reddit encodes URLs, need to decode
          const imageUrl = mediaInfo.s.u.replace(/&amp;/g, '&');
          console.log('✅ Adding gallery image:', imageUrl);

          media.push({
            type: 'image',
            src: imageUrl,
            width: mediaInfo.s.x || 0,
            height: mediaInfo.s.y || 0,
            alt: redditData.title
          });
        }
      }

      if (media.length > 0) {
        console.log('📋 Final Reddit media (gallery):', media);
        return media;
      }
    }

    // 3. Check for single image preview (but not if it's actually a video)
    if (redditData.preview?.images?.[0] && !redditData.is_video) {
      const imageData = redditData.preview.images[0];
      console.log('🖼️ Found preview image data:', imageData);

      // Use best resolution that fits our constraints
      let source = imageData.source;
      if (imageData.resolutions && imageData.resolutions.length > 0) {
        // Find best resolution under 1200px width, or use source
        const bestResolution = imageData.resolutions
          .filter(r => r.width <= 1200)
          .sort((a, b) => b.width - a.width)[0];
        source = bestResolution || imageData.source;
      }

      if (source && source.url) {
        const cleanUrl = source.url.replace(/&amp;/g, '&');
        console.log('✅ Adding preview image:', cleanUrl);
        media.push({
          type: 'image',
          src: cleanUrl,
          width: source.width,
          height: source.height,
          alt: redditData.title
        });
      }
    }

    // 4. Check for direct media URLs (imgur, i.redd.it, etc.) - only if no other media found
    if (media.length === 0 && redditData.url) {
      const directUrl = redditData.url.toLowerCase();
      console.log('🔗 Checking direct URL:', directUrl);

      // Image formats
      if (directUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
        console.log('📸 Found direct image URL');
        media.push({
          type: 'image',
          src: redditData.url,
          width: 0,
          height: 0,
          alt: redditData.title
        });
      }
      // Video formats
      else if (directUrl.match(/\.(mp4|webm|mov|avi)(\?.*)?$/i)) {
        console.log('🎬 Found direct video URL');

        // Try to generate poster from preview if available
        let posterUrl = '';
        if (redditData.preview?.images?.[0]?.source?.url) {
          posterUrl = redditData.preview.images[0].source.url.replace(/&amp;/g, '&');
        }

        media.push({
          type: 'video',
          src: redditData.url,
          width: 0,
          height: 0,
          isGif: false,
          poster: posterUrl
        });
      }
      // Special handling for imgur
      else if (directUrl.includes('imgur.com') && !directUrl.includes('.gifv')) {
        console.log('🌐 Found Imgur link');
        // Convert imgur links to direct image links
        const imgurId = directUrl.match(/imgur\.com\/([a-zA-Z0-9]+)/)?.[1];
        if (imgurId && !directUrl.includes('/a/') && !directUrl.includes('/gallery/')) {
          // Try both jpg and png
          media.push({
            type: 'image',
            src: `https://i.imgur.com/${imgurId}.jpg`,
            width: 0,
            height: 0,
            alt: redditData.title
          });
        }
      }
      // i.redd.it images
      else if (directUrl.includes('i.redd.it')) {
        console.log('🖼️ Found i.redd.it image');
        media.push({
          type: 'image',
          src: redditData.url,
          width: 0,
          height: 0,
          alt: redditData.title
        });
      }
    }

    console.log('📋 Final Reddit media array:', media);
    return media;
  };

  const mediaContent = getMediaContent();
  // Lib's `MediaCarousel` expects items shaped like the carousel-utils-stub
  // `MediaItem` (which has a required `id`). Reddit constructs items without an
  // `id`, so we synthesize one at the boundary. Keep the runtime cast — lib
  // carousel keys by index and only reads `.type`/`.src`/`.poster`/`.alt`.
  const carouselItems: CarouselMediaItem[] = mediaContent.map((m, i) => ({
    id: `reddit-${i}`,
    type: m.type,
    src: m.src,
    poster: m.poster,
    alt: m.alt,
    width: m.width,
    height: m.height,
  }));

  console.log('🎬 MediaCarousel will render with:', mediaContent.length, 'items', mediaContent);

  // Format time
  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = now - timestamp;

    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  };

  // Format numbers using utility function
  const formatNumber = formatLargeNumber;

  const truncateText = (text: string, maxLength: number = 600) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <RedditContainer>
      <div className="border border-ods-border rounded-lg bg-ods-card overflow-hidden">
        {/* Header with Profile Picture */}
        <div className="p-4 border-b border-ods-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Lazy-loaded User Profile Picture */}
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <RedditProfilePic username={redditData.author} />
              </div>
              <div>
                <p className="text-ods-text-primary font-medium">r/{redditData.subreddit}</p>
                <div className="flex items-center space-x-2 text-ods-text-secondary text-sm">
                  <UserIcon />
                  <span>u/{redditData.author}</span>
                  <ClockIcon />
                  <span>{formatTimeAgo(redditData.created_utc)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Matching Twitter Style */}
        <div className="p-4">
          <h3 className="text-ods-text-primary font-semibold text-lg mb-3 leading-tight">
            {redditData.title}
          </h3>

          {redditData.selftext && (
            <div
              className="text-ods-text-secondary text-sm leading-relaxed mb-4 overflow-hidden"
              style={{ maxHeight: `${maxWidth - 200}px` }}
            >
              <p className="whitespace-pre-wrap">
                {truncateText(redditData.selftext)}
              </p>
            </div>
          )}

          {/* Enhanced Media Section with Carousel */}
          {carouselItems.length > 0 && (
            <MediaCarousel
              media={carouselItems}
              aspectRatio="16/9"
            />
          )}

          {/* Stats - Matching Twitter Style */}
          <div className="flex items-center space-x-6 text-ods-text-secondary text-sm">
            <div className="flex items-center space-x-1">
              <ArrowUpIcon />
              <span>{formatNumber(redditData.ups)} upvotes</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageCircleIcon />
              <span>{formatNumber(redditData.num_comments)} comments</span>
            </div>
          </div>
        </div>

        {/* Footer - Matching Twitter Style */}
        <div className="px-4 py-3 bg-ods-bg-secondary border-t border-ods-border">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-ods-accent hover:opacity-80 transition-colors text-sm font-medium"
          >
            <ExternalLinkIcon />
            <span>View on Reddit</span>
          </a>
        </div>
      </div>
    </RedditContainer>
  );
}
