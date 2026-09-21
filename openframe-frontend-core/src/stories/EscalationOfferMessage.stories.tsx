import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type React from 'react';

import { EscalationOfferMessage } from '../components/chat/escalation-offer-message';

/**
 * `escalation_offer` message segment — Fae asking the client to confirm a
 * handoff to a human technician (Figma: fae chat › "escalation to admin").
 *
 * Renders THROUGH the client approval card rather than reimplementing it, so
 * it is pixel-identical to `Chat/Client/ApprovalRequestMessage` down to the
 * Approve/Reject labels and the resolved pill. What differs is the wiring:
 * approve/reject call the ticket-escalation GraphQL mutations, never the
 * tool-approval endpoint — which is why it is a distinct segment type.
 *
 * The body copy is backend-fixed; the client never composes it. `origin`
 * (TOOL / MANUAL / a trigger reason) is decoded for telemetry only — every
 * origin renders the same card.
 */

const OFFER_TEXT =
  'Having issues with the AI assistant? This ticket can be handed off to a technician. Fae will no longer respond in this conversation. A technician will review the ticket and reply when available.';

const baseData = { offerId: 'offer-1', text: OFFER_TEXT, origin: 'MANUAL' };

const plainDecorator = (Story: React.ComponentType) => (
  <div style={{ maxWidth: 600, background: 'var(--color-bg)' }} className="p-4">
    <Story />
  </div>
);

const meta = {
  title: 'Chat/Client/EscalationOfferMessage',
  component: EscalationOfferMessage,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders an `escalation_offer` segment: the backend-fixed handoff prompt with Approve/Reject, or a resolved status pill. Approve performs the handoff (ticket → Tech Required, Fae goes silent); Reject just records the choice.',
      },
    },
  },
  decorators: [plainDecorator],
} satisfies Meta<typeof EscalationOfferMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pending — the client has not decided yet. */
export const Pending: Story = {
  args: {
    data: baseData,
    status: 'pending',
    onApprove: () => {},
    onReject: () => {},
  },
};

/** Approved — the handoff ran. Paired in the thread with `TicketEscalatedMessage`. */
export const ApprovedByUser: Story = {
  args: { data: baseData, status: 'approved', resolvedByName: 'John Smith' },
};

/** Declined — the client chose to keep working with Fae. */
export const DeclinedByUser: Story = {
  args: { data: baseData, status: 'rejected', resolvedByName: 'John Smith' },
};

/**
 * Superseded — the client typed a new message over the pending offer, which
 * the backend treats as declining it. Maps onto the shared `cancelled` status.
 */
export const Superseded: Story = {
  args: { data: baseData, status: 'cancelled', resolvedByName: 'John Smith' },
};

/** Raised by Fae's own `escalateToHuman` tool call rather than the header action. */
export const FromToolCall: Story = {
  args: {
    data: { ...baseData, origin: 'TOOL' },
    status: 'pending',
    onApprove: () => {},
    onReject: () => {},
  },
};
