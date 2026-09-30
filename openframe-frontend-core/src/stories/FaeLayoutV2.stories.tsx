import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { ChatInput } from '../components/chat/chat-input';
import { ChatListEmptyState } from '../components/chat/chat-list-empty-state';
import { ChatMessageList } from '../components/chat/chat-message-list';
import { ChatListItem, ChatNavSidebar } from '../components/chat/chat-nav-sidebar';
import { ChatTopNavigation } from '../components/chat/chat-top-navigation';
import { MspOrganizationCard } from '../components/chat/msp-organization-card';
import type { Message } from '../components/chat/types/message.types';
import { OpenFrameLogo } from '../components/icons';
import {
  ChatPlusIcon,
  ChatQuestionIcon,
  ChatsIcon,
  CheckCircleIcon,
  ClockHistoryIcon,
  DotsLoaderIcon,
  HourglassClockIcon,
  MessageIndicatorIcon,
  UserCheckIcon,
} from '../components/icons-v2-generated';
import { Button } from '../components/ui/button';
import { withFaeBrand } from './fae-brand-decorator';

const at = (minute: number) => new Date(2026, 8, 29, 14, minute);

const THREAD: Message[] = [
  {
    id: 'u1',
    role: 'user',
    name: 'John Smith',
    content: 'My laptop has been running really slowly lately',
    timestamp: at(47),
  },
  {
    id: 'a1',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    content: "I'll run a quick diagnostic to identify what's causing the performance issues.",
    timestamp: at(47),
  },
];

const CHATS = [
  { id: '1', title: 'Slow Laptop', mark: <DotsLoaderIcon className="text-ods-accent" /> },
  { id: '2', title: 'Forgot my password' },
  { id: '3', title: 'Teams mic not working', mark: <HourglassClockIcon className="text-ods-accent" /> },
  { id: '4', title: 'Email not syncing on phone', mark: <MessageIndicatorIcon className="text-ods-accent" /> },
  { id: '5', title: 'Blue screen on startup', resolved: true },
];

function Layout({ withChats, withThread }: { withChats: boolean; withThread: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <div data-surface="brand-tinted" className="flex h-[800px] w-[1024px] border-t border-ods-border bg-ods-bg">
      {sidebarOpen && (
        <ChatNavSidebar
          logo={
            <span className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-primary">
              <OpenFrameLogo
                className="size-6"
                lowerPathColor="var(--ods-open-yellow-base)"
                upperPathColor="var(--color-text-primary)"
              />
              <span className="text-wordmark">OpenFrame</span>
            </span>
          }
          items={[
            { id: 'new', label: 'Start New Chat', icon: <ChatPlusIcon />, active: !withThread },
            { id: 'archive', label: 'Chat Archive', icon: <ClockHistoryIcon /> },
            { id: 'guide', label: 'What to ask Fae?', icon: <ChatQuestionIcon /> },
          ]}
          sectionLabel="Your Current Chats"
          footer={<MspOrganizationCard variant="footer" name="TechFlow Solutions" onOpenWebsite={() => undefined} />}
        >
          {withChats ? (
            CHATS.map((chat, i) => (
              <ChatListItem
                key={chat.id}
                title={chat.title}
                subtitle="Ticket Number: 1932"
                active={withThread && i === 0}
                leading={chat.resolved ? <CheckCircleIcon className="text-ods-success" /> : undefined}
                trailing={chat.mark}
              />
            ))
          ) : (
            <ChatListEmptyState
              icon={<ChatsIcon size={24} />}
              title="No Current Chats"
              description="Your conversations will show here"
            />
          )}
        </ChatNavSidebar>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatTopNavigation
          name="Fae"
          subtitle="Your AI Assistant"
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(open => !open)}
          onOpenSettings={() => undefined}
          actions={
            <Button variant="outline" size="small" leftIcon={<UserCheckIcon />}>
              Request a Technician
            </Button>
          }
        />
        <main className="ods-glow-accent-corner flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)] pt-[var(--spacing-system-mf)]">
          {withThread ? (
            <ChatMessageList
              messages={THREAD}
              assistantType="fae"
              approvalVariant="client"
              appearance="v2"
              fullWidth
              contentClassName="px-0"
              autoScroll={false}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[var(--spacing-system-l)]">
              <div className="flex flex-col gap-[var(--spacing-system-xsf)] text-center">
                <h1 className="text-ods-text-primary text-h2">Hi, I&apos;m your IT assistant</h1>
                <p className="text-ods-text-secondary text-h4">
                  Having trouble with your computer, email, Wi-Fi, or software? Just describe it.
                </p>
              </div>
            </div>
          )}
          <ChatInput fullWidth appearance="v2" placeholder="Enter your request here..." />
        </main>
      </div>
    </div>
  );
}

const meta: Meta<typeof Layout> = {
  decorators: [withFaeBrand],
  title: 'Chat/Fae Layout v2',
  component: Layout,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Layout>;

export const StartEmpty: Story = { args: { withChats: false, withThread: false } };
export const ChatOpen: Story = { args: { withChats: true, withThread: true } };
