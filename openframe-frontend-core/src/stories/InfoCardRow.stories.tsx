import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { InfoCardRow } from '../components/ui/info-card-row'
import { CheckCircleIcon } from '../components/icons-v2-generated/signs-and-symbols/check-circle-icon'
import { TagIcon } from '../components/icons-v2-generated/shopping/tag-icon'

// Stand-in company logo — the lead `icon` fills the 40px bordered avatar box.
// In real usage this is typically an `<img>` logo (rendered with object-cover).
const companyLogo = (
  <div className="size-full" style={{ background: 'linear-gradient(135deg, #5EFAF0, #F357BB)' }} />
)

const meta = {
  title: 'UI/InfoCardRow',
  component: InfoCardRow,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A responsive summary row: a 50%-width lead section (icon + title/caption) and two 25%-width stat sections (title + caption + right icon). On mobile the two stat sections wrap into their own row beneath the lead (76px rows on desktop/tablet, 60px on mobile), and each stat icon drops onto the caption line. Neighbouring sections share inner borders; only the outer edges are rounded. Each section takes a required `title` and `caption`, and an optional `icon`.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    lead: { control: false, description: 'Lead section (50% width): { title, caption, icon? }' },
    stats: {
      control: false,
      description: 'Two stat sections (25% width each): { title, caption, icon? }',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[1024px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InfoCardRow>

export default meta
type Story = StoryObj<typeof meta>

/** Full row — lead logo + name/devices, and two stats with icons. Matches Figma. */
export const Default: Story = {
  args: {
    lead: { title: 'Precision Accounting Partners', caption: '847 devices', icon: companyLogo },
    stats: [
      {
        title: 'Resolved this week',
        caption: '312',
        icon: <CheckCircleIcon className="text-ods-success" />,
      },
      { title: 'Open tickets', caption: '2', icon: <TagIcon className="text-ods-text-secondary" /> },
    ],
  },
}

/** Icons omitted — text-only sections. */
export const WithoutIcons: Story = {
  args: {
    lead: { title: 'Precision Accounting Partners', caption: '847 devices' },
    stats: [
      { title: 'Resolved this week', caption: '312' },
      { title: 'Open tickets', caption: '2' },
    ],
  },
}
