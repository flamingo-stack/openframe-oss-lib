import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DataRoomDocCard } from '../components/chat/entity-cards'
import {
  ChatColumnDecorator,
  makeAnchorProps,
} from './__fixtures__/chat-card-decorator'
import {
  dataRoomDocItem,
  openframeDocsMarkdownItem,
} from './__fixtures__/chat-cards'

const meta: Meta<typeof DataRoomDocCard> = {
  title: 'Chat/EntityCards/DataRoomDocCard',
  component: DataRoomDocCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Inline card rendered in chat for `data_room_doc` and `markdown` doc types. The same component covers both — `sourceRepo` drives the badge label (e.g. "Data room" vs "OpenFrame Docs"). `badgeText` is a REQUIRED prop; the dispatch resolves it via `SOURCE_LABELS_BY_TABLE` before rendering.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const DataRoom: Story = {
  args: {
    item: dataRoomDocItem,
    badgeText: 'Data room',
    anchorProps: makeAnchorProps(dataRoomDocItem.url ?? '#'),
  },
}

export const KnowledgeBaseMarkdown: Story = {
  args: {
    item: openframeDocsMarkdownItem,
    badgeText: 'OpenFrame Docs',
    anchorProps: makeAnchorProps(openframeDocsMarkdownItem.url ?? '#'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Same component, `markdown` doc type — drives the "OpenFrame Docs" badge via `sourceRepo: "openframe-docs"`.',
      },
    },
  },
}
