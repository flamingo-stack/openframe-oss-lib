import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { HowIWorkCard, HowIWorkCardSkeleton } from '../components/chat/entity-cards/how-i-work-card'
import { ChatColumnDecorator, makeAnchorProps } from './__fixtures__/chat-card-decorator'
import { howIWorkEntry } from './__fixtures__/chat-cards'

const meta: Meta<typeof HowIWorkCard> = {
  title: 'Chat/EntityCards/HowIWorkCard',
  component: HowIWorkCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for a `how_i_work` session — a thin binding over `EmployeeEntryCard` that maps `session_date` to the meta date and adds the discipline badge. Engine states (statuses, cover fallbacks, empty draft) are covered by the EmployeeEntryCard stories.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    entry: howIWorkEntry,
  },
}

/** Related-rail click-through — the whole card is one anchor. */
export const AsAnchor: Story = {
  args: {
    entry: howIWorkEntry,
    anchorProps: makeAnchorProps('/how-i-work/' + 'competitive-research-claude'),
  },
}

/** No discipline picked yet (fresh draft) — badge row shows status only. */
export const NoDiscipline: Story = {
  args: {
    entry: { ...howIWorkEntry, discipline: null, status: 'draft' },
  },
}

export const Skeleton: StoryObj = {
  render: () => <HowIWorkCardSkeleton />,
}
