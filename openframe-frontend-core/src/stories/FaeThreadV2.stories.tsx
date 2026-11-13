import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { ChatMessage } from '../chat-protocol/chat-message';
import { ChatInput } from '../components/chat/chat-input';
import { ChatMessageList } from '../components/chat/chat-message-list';
import type { ChatAppearance } from '../components/chat/types/chat.types';
import { approvalPart, type StoryRow, storyMessage, textPart } from './__fixtures__/chat-messages';
import { withFaeBrand } from './fae-brand-decorator';

const at = (minute: number) => new Date(2026, 8, 29, 14, minute);

// The "Admin joins" frame of the fae chat v2 escalation flow: a user request,
// an escalation offer the user approved, the hand-off and join receipts, then
// the technician's reply.
const ESCALATION_THREAD_ROWS: StoryRow[] = [
  {
    id: 'u1',
    role: 'user',
    name: 'John Smith',
    parts: textPart('My laptop has been running really slowly lately'),
    timestamp: at(47),
  },
  {
    id: 'a1',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    parts: textPart('Sorry, I can’t help with this problem'),
    timestamp: at(47),
  },
  { id: 'u2', role: 'user', name: 'John Smith', parts: textPart('call the admin'), timestamp: at(47) },
  {
    id: 'a2',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    timestamp: at(47),
    parts: [
      {
        type: 'data-escalation-offer',
        id: 'offer-1',
        data: {
          status: 'approved',
          resolvedByName: 'User',
          text: 'Having issues with the AI assistant? This ticket can be handed off to a technician. Fae will no longer respond in this conversation. A technician will review the ticket and reply when available.',
        },
      },
      { type: 'data-ticket-escalated', data: { ticketId: 't-1', reason: 'MANUAL' } },
      {
        type: 'data-error',
        data: { title: 'AI response error', details: 'Something went wrong. Please try again.' },
      },
    ],
  },
  {
    id: 's1',
    role: 'system',
    authorType: 'system',
    parts: textPart('Michael Johnson joined the chat'),
    timestamp: at(48),
  },
  {
    id: 't1',
    role: 'assistant',
    name: 'Michael Johnson',
    authorType: 'admin',
    parts: textPart('I’ll do it faster'),
    timestamp: at(48),
  },
  { id: 'u3', role: 'user', name: 'John Smith', parts: textPart('Cool!'), timestamp: at(48) },
];
const ESCALATION_THREAD = ESCALATION_THREAD_ROWS.map(storyMessage);

const APPROVAL_THREAD_ROWS: StoryRow[] = [
  {
    id: 'u1',
    role: 'user',
    name: 'John Smith',
    parts: textPart('My laptop has been running really slowly lately'),
    timestamp: at(47),
  },
  {
    id: 'a1',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    parts: textPart(
      'I found that your C: drive is 89% full. I can clean up temporary files to free some space - may I proceed with clearing C:/temp?',
    ),
    timestamp: at(47),
  },
  {
    id: 'a2',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    timestamp: at(47),
    parts: [
      approvalPart({
        id: 'req-1',
        command: 'Remove-Item C:\\Temp\\* -Recurse',
        explanation: 'Clears temporary files in C:\\Temp to free disk space.',
      }),
    ],
  },
];
const APPROVAL_THREAD = APPROVAL_THREAD_ROWS.map(storyMessage);

function Thread({
  messages,
  appearance,
  handedOff,
}: {
  messages: ChatMessage[];
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

const approvalCard = (requestId: string, status: 'approved' | 'rejected' | 'cancelled', resolvedByName?: string) =>
  approvalPart({
    id: requestId,
    command: 'Remove-Item C:\\Temp\\* -Recurse',
    explanation: 'Clears temporary files in C:\\Temp.',
    status,
    resolvedByName,
  });

const APPROVAL_STATES_ROWS: StoryRow[] = [
  {
    id: 'a1',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    timestamp: at(47),
    parts: [
      approvalCard('r1', 'approved', 'Michael Johnson'),
      approvalCard('r2', 'rejected', 'Michael Johnson'),
      approvalCard('r3', 'cancelled', 'Michael Johnson'),
    ],
  },
];

const APPROVAL_STATES_THREAD = APPROVAL_STATES_ROWS.map(storyMessage);

export const ApprovalV2: Story = { args: { messages: APPROVAL_THREAD, appearance: 'v2' } };

export const ApprovalStatesV2: Story = { args: { messages: APPROVAL_STATES_THREAD, appearance: 'v2' } };
