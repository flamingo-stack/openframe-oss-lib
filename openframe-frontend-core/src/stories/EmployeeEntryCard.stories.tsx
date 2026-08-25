import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EmployeeEntryCard, EmployeeEntryBadge } from '../components/chat/entity-cards/employee-entry-card';
import { ChatColumnDecorator, makeAnchorProps } from './__fixtures__/chat-card-decorator';
import { howIWorkEntry, whatIShippedEntry } from './__fixtures__/chat-cards';

const meta: Meta<typeof EmployeeEntryCard> = {
  title: 'Chat/EntityCards/EmployeeEntryCard',
  component: EmployeeEntryCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'THE people-hub employee-entry engine. `WhatIShippedCard` and `HowIWorkCard` are thin bindings over it — they differ only in which date column they format and which extra badges they add — so the states exercised here are the states of every employee-entry card. Cover falls back featured_image → main_video_thumbnail → placeholderUrl.',
      },
    },
  },
  decorators: [
    Story => (
      <ChatColumnDecorator>
        <Story />
      </ChatColumnDecorator>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Published: Story = {
  args: {
    entry: whatIShippedEntry,
    dateLabel: 'Jul 2026',
  },
};

export const Draft: Story = {
  args: {
    entry: { ...whatIShippedEntry, status: 'draft' },
    dateLabel: 'Jul 2026',
  },
};

export const Archived: Story = {
  args: {
    entry: { ...whatIShippedEntry, status: 'archived' },
    dateLabel: 'Jul 2026',
  },
};

export const WithExtraBadges: Story = {
  args: {
    entry: howIWorkEntry,
    dateLabel: 'Aug 16, 2026',
    extraBadges: (
      <>
        <EmployeeEntryBadge>Marketing</EmployeeEntryBadge>
        <EmployeeEntryBadge>Intermediate</EmployeeEntryBadge>
      </>
    ),
  },
};

/** Cover falls back to the video frame when there is no featured image. */
export const VideoThumbnailFallback: Story = {
  args: {
    entry: {
      ...whatIShippedEntry,
      featured_image: null,
      main_video_thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=675&fit=crop',
    },
    dateLabel: 'Jul 2026',
  },
};

/** The auto-created-draft state: no title yet, no summary, no cover — the card
 *  must still read as a specific entity, not an error. */
export const EmptyDraft: Story = {
  args: {
    entry: {
      title: null,
      summary: null,
      status: 'draft',
      featured_image: null,
      main_video_thumbnail: null,
      author: whatIShippedEntry.author,
    },
    dateLabel: null,
    untitledLabel: 'Untitled session',
  },
};

/** Related-rail mode: the whole card is a link (never combined with actions). */
export const AsAnchor: Story = {
  args: {
    entry: whatIShippedEntry,
    dateLabel: 'Jul 2026',
    anchorProps: makeAnchorProps('/what-i-shipped/billing-flow'),
  },
};
