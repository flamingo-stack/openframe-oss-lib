import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ChatInput } from '../components/chat/chat-input';
import { ChatMessageList } from '../components/chat/chat-message-list';
import type { ChatAppearance } from '../components/chat/types/chat.types';
import type { Message } from '../components/chat/types/message.types';
import { withFaeBrand } from './fae-brand-decorator';

const at = (minute: number) => new Date(2026, 8, 29, 14, minute);

// The "Admin joins" frame of the fae chat v2 escalation flow: a user request,
// an escalation offer the user approved, the hand-off and join receipts, then
// the technician's reply.
const ESCALATION_THREAD: Message[] = [
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
    content: 'Sorry, I can’t help with this problem',
    timestamp: at(47),
  },
  { id: 'u2', role: 'user', name: 'John Smith', content: 'call the admin', timestamp: at(47) },
  {
    id: 'a2',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    timestamp: at(47),
    content: [
      {
        type: 'escalation_offer',
        status: 'approved',
        resolvedByName: 'User',
        data: {
          offerId: 'offer-1',
          text: 'Having issues with the AI assistant? This ticket can be handed off to a technician. Fae will no longer respond in this conversation. A technician will review the ticket and reply when available.',
        },
      },
      { type: 'ticket_escalated', data: { ticketId: 't-1', reason: 'MANUAL' } },
      {
        type: 'error',
        title: 'AI response error',
        details: 'Something went wrong. Please try again.',
      },
    ],
  },
  {
    id: 't1',
    role: 'assistant',
    name: 'Michael Johnson',
    authorType: 'admin',
    content: 'I’ll do it faster',
    timestamp: at(48),
  },
  { id: 'u3', role: 'user', name: 'John Smith', content: 'Cool!', timestamp: at(48) },
];

const APPROVAL_THREAD: Message[] = [
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
    content:
      'I found that your C: drive is 89% full. I can clean up temporary files to free some space - may I proceed with clearing C:/temp?',
    timestamp: at(47),
  },
  {
    id: 'a2',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    timestamp: at(47),
    content: [
      {
        type: 'approval_request',
        status: 'pending',
        data: {
          requestId: 'req-1',
          command: 'Remove-Item C:\\Temp\\* -Recurse',
          explanation: 'Clears temporary files in C:\\Temp to free disk space.',
        },
        onApprove: () => undefined,
        onReject: () => undefined,
      },
    ],
  },
];

function Thread({
  messages,
  appearance,
  handedOff,
}: {
  messages: Message[];
  appearance: ChatAppearance;
  handedOff?: boolean;
}) {
  return (
    <div className="flex h-[720px] w-[728px] flex-col bg-ods-bg">
      <ChatMessageList
        messages={messages}
        assistantType="fae"
        approvalVariant="client"
        appearance={appearance}
        fullWidth
        autoScroll={false}
      />
      <div className="px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)]">
        <ChatInput
          fullWidth
          placeholder="Enter your request here..."
          awaitingResponse={handedOff}
          appearance={appearance}
          awaitingTeam={[
            { key: '1', name: 'Roman Smith' },
            { key: '2', name: 'Ada Lin' },
            { key: '3', name: 'Michael Johnson' },
          ]}
        />
      </div>
    </div>
  );
}

const meta: Meta<typeof Thread> = {
  decorators: [withFaeBrand],
  title: 'Chat/Fae Thread v2',
  component: Thread,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Thread>;

export const EscalationV2: Story = { args: { messages: ESCALATION_THREAD, appearance: 'v2', handedOff: true } };
export const EscalationClassic: Story = {
  args: { messages: ESCALATION_THREAD, appearance: 'classic', handedOff: true },
};
export const ApprovalV2: Story = { args: { messages: APPROVAL_THREAD, appearance: 'v2' } };
