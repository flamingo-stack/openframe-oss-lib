import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator'

/**
 * `ChatInlineVideoPill` is a small bare-inline span defined locally in
 * `dispatch.tsx` for the `video` doc type. It is the ONLY entity-card that
 * stays inline alongside surrounding markdown text (no card wrapper, no
 * Ask/Display affordance) — by design, since the video player itself is
 * hoisted out of the paragraph by the chat's pre-scan and rendered above.
 *
 * Re-implemented here byte-for-byte from `dispatch.tsx:318-326` so the
 * story can render in isolation without the dispatch pipeline.
 */
function ChatInlineVideoPill({ title }: { title: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs align-middle bg-ods-card border border-ods-border text-ods-text-primary">
      <span aria-hidden="true" className="text-ods-text-secondary">
        ▶
      </span>
      <span className="truncate max-w-[220px]">{title}</span>
    </span>
  )
}

const meta: Meta<typeof ChatInlineVideoPill> = {
  title: 'Chat/EntityCards/ChatInlineVideoPill',
  component: ChatInlineVideoPill,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Bare-inline pill rendered for the `video` doc type. Used as a sentinel inside a paragraph; the actual video player is hoisted out by the chat pre-scan and rendered above the assistant turn.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ChatColumnDecorator>
        <p className="text-sm text-ods-text-primary leading-relaxed">
          Here is the demo from last week&apos;s call: <Story /> — watch the part
          where Jordan walks through the on-call rotation.
        </p>
      </ChatColumnDecorator>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'On-call rotation walkthrough',
  },
}

export const LongTitleTruncates: Story = {
  args: {
    title:
      'A very long video title that should truncate cleanly inside the pill so adjacent paragraph text stays on the same line',
  },
}
