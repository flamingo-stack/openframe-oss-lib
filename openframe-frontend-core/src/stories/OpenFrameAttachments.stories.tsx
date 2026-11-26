import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type React from 'react';

import {
  type OpenFrameAttachmentItem,
  type OpenFrameMessageAttachment,
  OPENFRAME_FAE_ATTACHMENT_PROFILE,
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
} from '../chat-protocol/attachment-profiles';
import { ChatInput } from '../components/chat/chat-input';
import { OpenFrameAttachmentTile } from '../components/chat/openframe-attachment-tray';
import { OpenFrameMessageAttachments } from '../components/chat/openframe-message-attachments';

/**
 * OpenFrame (Mingo, Fae) chat attachments (Figma `chat-uploaded-file`, Mingo 1360:42966, Fae 1051:7201): every tile
 * state, the composer tray in both placements, and a sent message's files. The design may still change.
 */

const KB = 1024;
const MB = 1024 * KB;

const plainDecorator = (Story: React.ComponentType) => (
  <div style={{ maxWidth: 800, background: 'var(--color-bg)' }} className="p-4">
    <Story />
  </div>
);

const states: OpenFrameAttachmentItem[] = [
  { id: '1', name: 'full-diagnostic-bundle.log', size: 24 * KB, state: 'uploading', progress: 64 },
  { id: '2', name: 'screen-0921-1142.png', size: 312 * KB, mediaType: 'image/png', state: 'scanning' },
  { id: '3', name: 'sv.log', size: 24 * KB, mediaType: 'text/plain', state: 'ready', tokenEstimate: 2600 },
  { id: '4', name: 'outlook-error-screenshot-0921-2026.png', size: 412 * KB, mediaType: 'image/png', state: 'ready' },
  { id: '5', name: 'sv.log', size: 34 * MB, state: 'error', error: 'TOO_LARGE' },
  { id: '6', name: 'CleanMyPC_setup.exe', size: 2 * MB, state: 'error', error: 'TYPE_NOT_ALLOWED' },
  { id: '7', name: 'sv.log', size: 24 * KB, state: 'error', error: 'BLOCKED' },
  { id: '8', name: 'sv.log', size: 24 * KB, state: 'error', error: 'UPLOAD_FAILED' },
];

function TileSheet({ product }: { product: 'mingo' | 'fae' }) {
  const profile = product === 'mingo' ? OPENFRAME_MINGO_ATTACHMENT_PROFILE : OPENFRAME_FAE_ATTACHMENT_PROFILE;
  return (
    <div className="flex flex-wrap gap-[var(--spacing-system-xsf)]">
      {states.map(item => (
        <OpenFrameAttachmentTile key={item.id} item={item} profile={profile} onRemove={() => {}} />
      ))}
    </div>
  );
}

function Composer({ product }: { product: 'mingo' | 'fae' }) {
  const profile = product === 'mingo' ? OPENFRAME_MINGO_ATTACHMENT_PROFILE : OPENFRAME_FAE_ATTACHMENT_PROFILE;
  return (
    <ChatInput
      fullWidth
      placeholder="Enter your request here…"
      onSend={() => {}}
      openframeAttachments={{
        profile,
        items: states.slice(1, 6),
        chatFileCount: 3,
        onAddFiles: () => {},
        onRemove: () => {},
      }}
    />
  );
}

/** A flat picture for the image grid, so the story needs no network. */
const picture = (label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#3a3a3a"/><text x="32" y="210" font-family="sans-serif" font-size="40" fill="#fafafa">${label}</text></svg>`,
  )}`;

const sent: OpenFrameMessageAttachment[] = [
  { id: 'f1', name: 'dns-trace.log', mediaType: 'text/plain', size: 24 * KB },
  { id: 'f2', name: 'speed-up-checklist.pdf', mediaType: 'application/pdf', size: 212 * KB },
  {
    id: 'i1',
    name: 'outlook-error.png',
    mediaType: 'image/png',
    size: 412 * KB,
    thumbnailUrl: picture('outlook-error.png'),
  },
  {
    id: 'i2',
    name: 'event-viewer.png',
    mediaType: 'image/png',
    size: 688 * KB,
    thumbnailUrl: picture('event-viewer.png'),
  },
];

const meta = {
  title: 'Chat/OpenFrameAttachments',
  component: TileSheet,
  tags: ['autodocs'],
  decorators: [plainDecorator],
  args: { product: 'mingo' },
} satisfies Meta<typeof TileSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every Mingo tile state: token estimate on the ready file. */
export const MingoTiles: Story = {};

/** Every Fae tile state: no token estimates. */
export const FaeTiles: Story = { args: { product: 'fae' } };

/** Mingo's composer: the tray under the input, wrapping, the counter and the notes. */
export const MingoComposer: Story = { render: () => <Composer product="mingo" /> };

/** Fae's composer: the one-click attach button and the tray over the input, scrolling. */
export const FaeComposer: Story = { render: () => <Composer product="fae" /> };

/** A sent message's files (no ×, no tokens); the host's onOpenAttachment opens them. */
export const SentFiles: Story = {
  render: () => <OpenFrameMessageAttachments attachments={sent} onOpenAttachment={() => {}} />,
};
