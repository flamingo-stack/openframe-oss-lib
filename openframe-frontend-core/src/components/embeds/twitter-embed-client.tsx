"use client";

import { useState, useEffect, useRef } from 'react';
import { XLogo } from '../icons/x-logo';
import { socialCache } from '../../utils/social-embed-cache';
import { TwitterContainer } from './embed-container';
import { useRichMarkdownRuntime } from './rich-markdown-runtime';

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

const HeartIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const RepeatIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="17,1 21,5 17,9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7,23 3,19 7,15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
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

// X glyph: the lib's standard XLogo (color follows the text context).
const XIcon = () => <XLogo className="w-5 h-5" color="currentColor" />;



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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializationDone = useRef(false);

  // Extract tweet ID from URL if not provided
  const extractedTweetId = tweetId || url.match(/status\/(\d+)/)?.[1];

  // Normalize the Twitter URL
  const tweetUrl = url.includes('twitter.com') || url.includes('x.com')
    ? url
    : `https://twitter.com/twitter/status/${extractedTweetId}`;

  useEffect(() => {
    // Only run once
    if (initializationDone.current) return;
    initializationDone.current = true;

    if (!extractedTweetId) {
      setError('Invalid tweet URL or ID');
      setLoading(false);
      return;
    }

    // Use centralized cache hierarchy
    socialCache.fetchWithHierarchy({
      platform: 'twitter',
      url: tweetUrl,
      apiEndpoint: twitterProxyUrl,
      dataValidator: (data) => data && data.html,
      onDataUpdate: (data) => setTweetData(data),
      onError: (errorMsg) => setError(errorMsg),
      onLoading: (loading) => setLoading(loading)
    });
  }, []); // Empty dependency array - only run once

  if (loading) {
    return (
      <TwitterContainer>
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
      </TwitterContainer>
    );
  }

  if (error || !tweetData) {
    return (
      <TwitterContainer>
        <div className="border border-ods-border rounded-lg p-6 bg-ods-card">
          <div className="flex items-center space-x-3 text-ods-text-secondary mb-4">
            <XIcon />
            <span>Tweet unavailable</span>
          </div>

          <div className="text-center">
            <p className="text-ods-text-secondary text-h6 mb-4">
              This tweet could not be loaded. It may have been deleted, made private, or the account may be suspended.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-ods-bg-secondary text-ods-text-primary rounded-md text-h6 hover:bg-ods-bg-tertiary transition-colors"
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
      text: link.textContent || link.href
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
  const getProfilePicUrl = (username: string | undefined) => {
    if (!username) return '';
    return `https://unavatar.io/twitter/${username}`;
  };

  return (
    <TwitterContainer>
      <div className="border border-ods-border rounded-lg bg-ods-card overflow-hidden">
        {/* Header with Profile Picture */}
        <div className="p-4 border-b border-ods-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* User Profile Picture */}
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <img
                  src={getProfilePicUrl(username)}
                  alt={`${tweetData.author_name} profile picture`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Simple fallback without state updates
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGQ9Ik0yMCAyMXYtMmE0IDQgMCAwIDAtNC00SDhhNCA0IDAgMCAwLTQgNHYyIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PC9zdmc+';
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
              className="text-ods-text-secondary text-h6 mb-4 overflow-hidden"
              style={{ maxHeight: `${maxWidth - 200}px` }}
            >
              <p className="whitespace-pre-wrap">
                {truncateText(tweetText)}
              </p>
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
                  className="inline-flex items-center space-x-2 text-[#1DA1F2] hover:text-ods-accent transition-colors text-h6"
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
        <div className="px-4 py-3 bg-ods-bg-secondary border-t border-ods-border">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-ods-accent hover:opacity-80 transition-colors text-h6"
          >
            <ExternalLinkIcon />
            <span>View on X</span>
          </a>
        </div>
      </div>
    </TwitterContainer>
  );
}
