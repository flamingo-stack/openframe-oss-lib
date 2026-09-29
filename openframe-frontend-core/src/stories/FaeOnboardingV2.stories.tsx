import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { OnboardingCarousel, type OnboardingCarouselStep } from '../components/chat/onboarding-carousel';
import { PoweredByFlamingo } from '../components/features/auth/auth-branding';
import { OpenFrameLogo } from '../components/icons';
import { ClockCheckIcon, MessagesIcon, UserCheckIcon } from '../components/icons-v2-generated';
import { SquareAvatar } from '../components/ui/square-avatar';
import { withFaeBrand } from './fae-brand-decorator';

const STEPS: OnboardingCarouselStep[] = [
  {
    id: 'meet',
    icon: <SquareAvatar variant="round" sizePx={28} fallback="Fae" />,
    title: 'Meet Your AI IT Assistant',
    description: 'Fixes what it can right away,\nand hands off the rest to your technicians.',
  },
  {
    id: 'type',
    icon: <MessagesIcon size={28} />,
    title: "Type what's going on.",
    description:
      "Your assistant troubleshoots first.\nAnything it can't solve goes to your technician with full context.",
  },
  {
    id: 'human',
    icon: <UserCheckIcon size={28} />,
    title: 'Need a human?',
    description: 'Skip the chat and create a ticket.\nIt goes straight to your technicians.',
  },
  {
    id: 'anytime',
    icon: <ClockCheckIcon size={28} />,
    title: 'Ask anything, anytime.',
    description: 'No hold music, no queue.\nJust immediate help.',
  },
];

function Screen() {
  return (
    <div className="flex h-[800px] w-[1024px] flex-col items-center gap-[calc(2*var(--spacing-system-xlf))] bg-ods-bg px-[calc(2*var(--spacing-system-xlf))] py-[var(--spacing-system-xl)]">
      <span className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-primary">
        <OpenFrameLogo
          className="size-6"
          lowerPathColor="var(--ods-open-yellow-base)"
          upperPathColor="var(--color-text-primary)"
        />
        <span className="text-wordmark">OpenFrame</span>
      </span>
      {/* The side cards run to the window edge, past the screen padding. */}
      <div className="-mx-[calc(2*var(--spacing-system-xlf))] flex min-h-0 flex-1 self-stretch">
        <OnboardingCarousel steps={STEPS} onComplete={() => undefined} />
      </div>
      <PoweredByFlamingo />
    </div>
  );
}

const meta: Meta<typeof Screen> = {
  decorators: [withFaeBrand],
  title: 'Chat/Fae Onboarding v2',
  component: Screen,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Screen>;

export const Introduction: Story = {};
