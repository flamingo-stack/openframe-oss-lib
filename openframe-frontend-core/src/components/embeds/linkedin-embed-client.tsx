'use client';

import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LinkedinIcon } from '../icons-v2-generated/brand-logos/linkedin-icon';
import { LinkedInContainer } from './embed-container';

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
          <div className="mb-4 flex items-center space-x-3 text-ods-text-secondary">
            <LinkedinIcon className="h-5 w-5 shrink-0" />
            <span>LinkedIn post</span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 rounded-md border border-ods-border bg-ods-card px-4 py-2 text-ods-text-primary transition-colors text-h6 hover:bg-ods-bg-hover"
          >
            <LinkedinIcon className="h-4 w-4" />
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
          <div className="absolute inset-0 animate-pulse p-6">
            <div className="mb-4 flex items-center space-x-3">
              <div className="h-12 w-12 rounded-full bg-ods-border" />
              <div>
                <div className="mb-2 h-4 w-32 rounded bg-ods-border" />
                <div className="h-3 w-24 rounded bg-ods-border" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-ods-border" />
              <div className="h-4 w-3/4 rounded bg-ods-border" />
            </div>
          </div>
        )}
        <iframe
          src={embedUrl}
          title="Embedded LinkedIn post"
          className="h-full w-full"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="border-t border-ods-border bg-ods-bg-surface px-4 py-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 text-ods-accent transition-colors text-h6 hover:text-ods-accent/80"
        >
          <ExternalLink className="h-4 w-4" />
          <span>View on LinkedIn</span>
        </a>
      </div>
    </LinkedInContainer>
  );
}
