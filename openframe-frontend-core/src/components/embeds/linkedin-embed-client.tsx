"use client";

import { useMemo, useState } from 'react';
import { LinkedInContainer } from './embed-container';
import { LinkedinIcon } from '../icons-v2-generated/brand-logos/linkedin-icon';
import { ExternalLink } from 'lucide-react';

/**
 * Derive LinkedIn's official embed URL from any post URL or URN.
 * LinkedIn renders public posts at /embed/feed/update/<urn>. Returns '' when no
 * URN can be derived, so the component falls back to a link instead of a broken
 * (X-Frame-blocked) iframe.
 */
function toLinkedInEmbedUrl(url: string): string {
  if (!url) return '';
  if (url.includes('linkedin.com/embed/')) return url.split('?')[0];
  let m = url.match(/urn:li:(activity|share|ugcPost):(\d+)/i);
  if (m) return `https://www.linkedin.com/embed/feed/update/urn:li:${m[1]}:${m[2]}`;
  m = url.match(/activity[-:](\d{15,25})/i);
  if (m) return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${m[1]}`;
  m = url.match(/-(\d{15,25})(?:-[A-Za-z0-9_-]+)?\/?(?:\?.*)?$/);
  if (m) return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${m[1]}`;
  return '';
}

interface LinkedInEmbedProps {
  url: string;
  /** Fixed iframe height — LinkedIn embeds don't auto-resize. */
  height?: number;
}

export function LinkedInEmbedClient({ url, height = 600 }: LinkedInEmbedProps) {
  const embedUrl = useMemo(() => toLinkedInEmbedUrl(url), [url]);
  const [loaded, setLoaded] = useState(false);

  // No derivable URN → graceful fallback card with a link (mirrors reddit's error state)
  if (!embedUrl) {
    return (
      <LinkedInContainer>
        <div className="p-6">
          <div className="flex items-center space-x-3 text-ods-text-secondary mb-4">
            <LinkedinIcon className="w-5 h-5 shrink-0" />
            <span>LinkedIn post</span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-ods-card border border-ods-border text-ods-text-primary rounded-md text-h6 hover:bg-ods-bg-hover transition-colors"
          >
            <LinkedinIcon className="w-4 h-4" />
            <span>View on LinkedIn</span>
          </a>
        </div>
      </LinkedInContainer>
    );
  }

  return (
    <LinkedInContainer>
      <div className="relative w-full" style={{ height }}>
        {!loaded && (
          <div className="absolute inset-0 p-6 animate-pulse">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-ods-border rounded-full" />
              <div>
                <div className="h-4 bg-ods-border rounded w-32 mb-2" />
                <div className="h-3 bg-ods-border rounded w-24" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-ods-border rounded w-full" />
              <div className="h-4 bg-ods-border rounded w-3/4" />
            </div>
          </div>
        )}
        <iframe
          src={embedUrl}
          title="Embedded LinkedIn post"
          className="w-full h-full"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="px-4 py-3 bg-ods-bg-surface border-t border-ods-border">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 text-ods-accent hover:text-ods-accent/80 transition-colors text-h6"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View on LinkedIn</span>
        </a>
      </div>
    </LinkedInContainer>
  );
}
