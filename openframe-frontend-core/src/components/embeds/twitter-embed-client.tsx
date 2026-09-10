'use client';

import { useState, useEffect, useRef } from 'react';
import Image from '../../embed-shims/next-image';
import { socialCache } from '../../utils/social-embed-cache';
import { XLogo } from '../icons/x-logo';
import { TwitterContainer } from './embed-container';
import { useRichMarkdownRuntime } from './rich-markdown-runtime';

// Using inline SVG icons to avoid dependency issues
const MessageCircleIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15,3 21,3 21,9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const HeartIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const RepeatIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="17,1 21,5 17,9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7,23 3,19 7,15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const UserIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// X glyph: the lib's standard XLogo (color follows the text context).
const XIcon = () => <XLogo className="h-5 w-5" color="currentColor" />;

interface TwitterOEmbedResponse {
  url: string;
  author_name: string;
  author_url: string;
  html: string;
  width: number;
  height: number;
  type: string;
  cache_age: string;
  provider_name: string;
  provider_url: string;
  version: string;
}

interface TwitterEmbedProps {
  url: string;
  tweetId?: string;
  maxWidth?: number;
}

export function TwitterEmbedClient({ url, tweetId, maxWidth = 700 }: TwitterEmbedProps) {
  const { twitterProxyUrl } = useRichMarkdownRuntime();
  const [tweetData, setTweetData] = useState<TwitterOEmbedResponse | null>(null);
  const [fetchLoading, setLoading] = useState(true);
  const [fetchError, setError] = useState<string | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  // Extract tweet ID from URL if not provided
  const extractedTweetId = tweetId || url.match(/status\/(\d+)/)?.[1];

  // A url we cannot pull an id out of is knowable from the props alone: there
  // is nothing to request and nothing to wait for. Derived here instead of
  // written into state from the effect, which cost a spinner frame plus a
  // second render pass to say something the FIRST render already knew.
  const error = extractedTweetId ? fetchError : 'Invalid tweet URL or ID';
  const loading = extractedTweetId ? fetchLoading : false;

  // Normalize the Twitter URL
  const tweetUrl =
    url.includes('twitter.com') || url.includes('x.com')
      ? url
      : `https://twitter.com/twitter/status/${extractedTweetId}`;

  useEffect(() => {
    // Only run once
    // Fetch once PER tweet: StrictMode's double mount is deduped, and a
    // genuinely different `tweetUrl` now refetches instead of showing the
    // first embed forever.
    if (fetchedForRef.current === tweetUrl) return;
    fetchedForRef.current = tweetUrl;

    // Reported from the derived `error` / `loading` above.
    if (!extractedTweetId) return;

    // Stale-response guard. Deliberately keyed on `fetchedForRef` rather than a
    // per-run `cancelled` boolean: the ref above makes StrictMode's second
    // effect run a no-op, so a per-run flag would cancel the ONLY in-flight
    // request and leave the embed spinning forever. Comparing against the ref
    // suppresses only genuinely superseded responses — without it, a `tweetUrl`
    // change lets the previous tweet's payload land last and render the WRONG
    // tweet (or drop the spinner while the new fetch is still running).
    const isCurrent = () => fetchedForRef.current === tweetUrl;

    // Use centralized cache hierarchy
    // `fetchWithHierarchy` never rejects — failures arrive through `onError`.
    void socialCache.fetchWithHierarchy({
      platform: 'twitter',
      url: tweetUrl,
      apiEndpoint: twitterProxyUrl,
      dataValidator: (data): data is TwitterOEmbedResponse =>
        typeof data === 'object' && data !== null && typeof (data as TwitterOEmbedResponse).html === 'string',
      onDataUpdate: data => {
        if (isCurrent()) setTweetData(data);
      },
      onError: errorMsg => {
        if (isCurrent()) setError(errorMsg);
      },
      onLoading: isLoading => {
        if (isCurrent()) setLoading(isLoading);
      },
    });
  }, [tweetUrl, twitterProxyUrl, extractedTweetId]);

  if (loading) {
    return (
      <TwitterContainer>
        <div className="animate-pulse rounded-lg border border-ods-border bg-ods-card p-6">
          <div className="mb-4 flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-ods-border"></div>
            <div>
              <div className="mb-2 h-4 w-32 rounded bg-ods-border"></div>
              <div className="h-3 w-24 rounded bg-ods-border"></div>
            </div>
          </div>
          <div className="mb-4 space-y-2">
            <div className="h-4 w-full rounded bg-ods-border"></div>
            <div className="h-4 w-3/4 rounded bg-ods-border"></div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="h-4 w-16 rounded bg-ods-border"></div>
            <div className="h-4 w-16 rounded bg-ods-border"></div>
            <div className="h-4 w-16 rounded bg-ods-border"></div>
          </div>
        </div>
      </TwitterContainer>
    );
  }

  if (error || !tweetData) {
    return (
      <TwitterContainer>
        <div className="rounded-lg border border-ods-border bg-ods-card p-6">
          <div className="mb-4 flex items-center space-x-3 text-ods-text-secondary">
            <XIcon />
            <span>Tweet unavailable</span>
          </div>

          <div className="text-center">
            <p className="mb-4 text-ods-text-secondary text-h6">
              This tweet could not be loaded. It may have been deleted, made private, or the account may be suspended.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 rounded-md bg-ods-bg-surface px-4 py-2 text-ods-text-primary transition-colors text-h6 hover:bg-ods-bg-active"
            >
              <XIcon />
              <span>View on X</span>
            </a>
          </div>
        </div>
      </TwitterContainer>
    );
  }

  // Parse the HTML to extract detailed tweet information and media
  const parser = new DOMParser();
  const doc = parser.parseFromString(tweetData.html, 'text/html');
  const blockquote = doc.querySelector('blockquote');

  // Extract tweet text (remove attribution line)
  const fullText = blockquote?.textContent || '';
  const tweetText = fullText.replace(/- .* \(@.*\).*$/, '').trim();

  // Extract username from author_url (e.g., https://twitter.com/username)
  const username = tweetData.author_url ? tweetData.author_url.split('/').pop() : '';

  // Extract any links from the tweet
  const links = Array.from(blockquote?.querySelectorAll('a') || [])
    .map(link => ({
      url: link.href,
      text: link.textContent || link.href,
    }))
    .filter(link => !link.url.includes('twitter.com') && !link.url.includes('x.com'));

  // Format time (simulated - we don't have real timestamp from oEmbed)
  const formatTime = () => {
    return 'on X'; // Simplified since we don't have actual timestamp
  };

  const truncateText = (text: string, maxLength: number = 600) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // Profile picture URL using Unavatar service.
  // The hub used to proxy this via `useProxiedImageUrl` (chat runtime), but
  // docs / blog pages don't mount a chat runtime, so we fetch unavatar
  // directly. Embedders that need a proxy can register a runtime later.
  const getProfilePicUrl = (handle: string | undefined) => {
    if (!handle) return '';
    return `https://unavatar.io/twitter/${handle}`;
  };

  return (
    <TwitterContainer>
      <div className="overflow-hidden rounded-lg border border-ods-border bg-ods-card">
        {/* Header with Profile Picture */}
        <div className="border-b border-ods-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* User Profile Picture */}
              <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full">
                <Image
                  src={getProfilePicUrl(username)}
                  alt={`${tweetData.author_name} profile picture`}
                  className="h-full w-full object-cover"
                  width={32}
                  height={32}
                  unoptimized
                  onError={e => {
                    // Simple fallback without state updates
                    const target = e.target as HTMLImageElement;
                    target.src =
                      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGQ9Ik0yMCAyMXYtMmE0IDQgMCAwIDAtNC00SDhhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+';
                  }}
                />
              </div>
              <div>
                <p className="text-ods-text-primary text-h6">@{username}</p>
                <div className="flex items-center space-x-2 text-ods-text-secondary text-h6">
                  <UserIcon />
                  <span>{tweetData.author_name}</span>
                  <ClockIcon />
                  <span>{formatTime()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {tweetText && (
            <div
              className="mb-4 overflow-hidden text-ods-text-secondary text-h6"
              style={{ maxHeight: `${maxWidth - 200}px` }}
            >
              <p className="whitespace-pre-wrap">{truncateText(tweetText)}</p>
            </div>
          )}

          {/* Links Section */}
          {links.length > 0 && (
            <div className="mb-4 space-y-2">
              {links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 text-[#1DA1F2] transition-colors text-h6 hover:text-ods-accent"
                >
                  <ExternalLinkIcon />
                  <span className="underline">{link.text}</span>
                </a>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center space-x-6 text-ods-text-secondary text-h6">
            <div className="flex items-center space-x-1">
              <HeartIcon />
              <span>Likes</span>
            </div>
            <div className="flex items-center space-x-1">
              <RepeatIcon />
              <span>Retweets</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageCircleIcon />
              <span>Replies</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-ods-border bg-ods-bg-surface px-4 py-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-ods-accent transition-colors text-h6 hover:opacity-80"
          >
            <ExternalLinkIcon />
            <span>View on X</span>
          </a>
        </div>
      </div>
    </TwitterContainer>
  );
}
