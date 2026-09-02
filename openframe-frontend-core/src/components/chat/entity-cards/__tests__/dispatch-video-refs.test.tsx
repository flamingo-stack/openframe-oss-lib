import React from 'react';
import { describe, expect, it } from 'vitest';
import type { ChatRef } from '../../chat-ref.types';
import { BlockCard } from '../block-card';
import { ChatVideoEntityCard } from '../chat-video-entity-card';
import { renderChatInlineEntityCard } from '../dispatch';

describe('renderChatInlineEntityCard video refs', () => {
  it.each([
    {
      id: 'MdFJNoJeqZQ',
      url: 'https://www.youtube.com/watch?v=MdFJNoJeqZQ',
      metadata: { youtubeUrl: 'MdFJNoJeqZQ' },
    },
    {
      id: 'mux-9b6586b494',
      url: 'https://stream.mux.com/playback-id.m3u8',
      metadata: { videoUrl: 'https://stream.mux.com/playback-id.m3u8' },
    },
    {
      id: 'mp4-1b2047dc1b',
      url: 'https://cdn.example.test/product-overview.mp4',
      metadata: { videoUrl: 'https://cdn.example.test/product-overview.mp4' },
    },
  ])('passes playable metadata for $id to the video card', ({ id, url, metadata }) => {
    const ref: ChatRef = { type: 'video', id, title: 'Video', url, metadata };

    const result = renderChatInlineEntityCard(ref);

    expect(React.isValidElement(result)).toBe(true);
    const block = result as React.ReactElement<React.ComponentProps<typeof BlockCard>>;
    expect(block.type).toBe(BlockCard);
    const video = block.props.children as React.ReactElement<React.ComponentProps<typeof ChatVideoEntityCard>>;
    expect(video.type).toBe(ChatVideoEntityCard);
    expect(video.props.chatRef.metadata).toMatchObject(metadata);
  });

  it('lets a validated top-level URL override conflicting route metadata', () => {
    const ref: ChatRef = {
      type: 'video',
      id: 'mux-9b6586b494',
      title: 'Video',
      url: 'https://stream.mux.com/trusted-playback.m3u8',
      metadata: {
        videoUrl: 'https://cdn.example.test/untrusted.mp4',
        youtubeUrl: 'untrustedId',
      },
    };

    const result = renderChatInlineEntityCard(ref);
    const block = result as React.ReactElement<React.ComponentProps<typeof BlockCard>>;
    const video = block.props.children as React.ReactElement<React.ComponentProps<typeof ChatVideoEntityCard>>;

    expect(video.props.chatRef.metadata).toEqual({
      videoUrl: 'https://stream.mux.com/trusted-playback.m3u8',
    });
  });

  it('keeps a direct-video URL direct when its query mentions a YouTube URL', () => {
    const directUrl =
      'https://cdn.example.test/product-overview.mp4?source=youtube.com/watch?v=MdFJNoJeqZQ';
    const ref: ChatRef = {
      type: 'video',
      id: 'mp4-direct',
      title: 'Product overview',
      url: directUrl,
    };

    const result = renderChatInlineEntityCard(ref);
    const block = result as React.ReactElement<React.ComponentProps<typeof BlockCard>>;
    const video = block.props.children as React.ReactElement<React.ComponentProps<typeof ChatVideoEntityCard>>;

    expect(video.props.chatRef.metadata).toEqual({ videoUrl: directUrl });
  });
});
