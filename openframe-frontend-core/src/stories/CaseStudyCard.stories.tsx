import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CaseStudyCard } from '../components/chat/entity-cards';
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator';
import { caseStudy } from './__fixtures__/chat-cards';

const meta: Meta<typeof CaseStudyCard> = {
  title: 'Chat/EntityCards/CaseStudyCard',
  component: CaseStudyCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for the `case_study` doc type. `sm` size renders the chat-inline compact card; `default` is the catalog grid card. User + MSP badge overlay is shown in both sizes.',
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

export const ChatInlineSm: Story = {
  args: {
    study: caseStudy,
    href: '/case-studies/' + caseStudy.slug,
    size: 'sm',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
};

export const Default: Story = {
  args: {
    study: caseStudy,
    href: '/case-studies/' + caseStudy.slug,
    size: 'default',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
};

const caseStudyWithMetrics = {
  ...caseStudy,
  metrics: [
    { value: '50%', label: 'of routine tasks automated' },
    { value: '3x', label: 'faster onboarding' },
  ],
};

/** The first headline metric sits between the title and the person. */
export const WithHeadlineMetric: Story = {
  args: {
    study: caseStudyWithMetrics,
    href: '/case-studies/' + caseStudy.slug,
    size: 'default',
  },
};

export const PortraitWithHeadlineMetric: Story = {
  args: {
    study: caseStudyWithMetrics,
    href: '/case-studies/' + caseStudy.slug,
    size: 'portrait',
    showTypeBadge: false,
  },
};

/** A story with no metric in a grid that reserves the zone: same box, empty zone. */
export const MetricRowReserved: Story = {
  args: {
    study: caseStudy,
    href: '/case-studies/' + caseStudy.slug,
    size: 'default',
    metricRow: true,
  },
};
