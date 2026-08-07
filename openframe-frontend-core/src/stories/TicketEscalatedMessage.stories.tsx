import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { TicketEscalatedMessage } from "../components/chat/ticket-escalated-message";

/**
 * `ticket_escalated` message segment — the handoff receipt (Figma:
 * `ai-assistant-info`, type=escalation).
 *
 * A first-class block on the wire, NOT something the client infers from an
 * escalation offer's state, so it also covers the inactivity auto-escalation —
 * a path that raises no offer at all.
 *
 * The body is whatever the backend authored, so the reason it gives stays
 * server-side: the card never branches on `data.reason`, which is why a reason
 * added server-side needs no client change. The body WRAPS rather than
 * truncating as the mock does — see the component for why — so the block is
 * 72px only while the text fits two lines.
 */

const baseData = {
	ticketId: "68a1f0c2b3d4e5f6a7b8c9d0",
	ticketNumber: 1002,
	reason: "INACTIVITY",
	text: "Automatically escalated to a human technician because the conversation had no new messages for an extended period.",
};

/** Fixed so the timestamp doesn't churn between snapshots. */
const TIMESTAMP = new Date("2026-08-07T14:47:00");

const plainDecorator = (Story: React.ComponentType) => (
	<div style={{ maxWidth: 600, background: "var(--color-bg)" }} className="p-4">
		<Story />
	</div>
);

const meta = {
	title: "Chat/Client/TicketEscalatedMessage",
	component: TicketEscalatedMessage,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Renders a `TICKET_ESCALATED` block: a bordered info tile, the fixed 'Handed Off to a Technician' title, the message timestamp, and the backend's explanation.",
			},
		},
	},
	decorators: [plainDecorator],
} satisfies Meta<typeof TicketEscalatedMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The inactivity auto-escalation — the only reason the wire defines today. */
export const Inactivity: Story = {
	args: { data: baseData, timestamp: TIMESTAMP },
};

/**
 * `text` is nullable on the wire; the card falls back to the design's generic
 * line rather than rendering an empty body.
 */
export const NoBodyFallback: Story = {
	args: { data: { ...baseData, text: undefined }, timestamp: TIMESTAMP },
};

/** No timestamp — the row collapses to title-only, body unchanged. */
export const WithoutTimestamp: Story = {
	args: { data: baseData },
};

/** Long explanation — wraps and the block grows; nothing is clipped. */
export const LongBody: Story = {
	args: {
		data: {
			...baseData,
			text: "Automatically escalated to a human technician because the conversation had no new messages for an extended period while the ticket was still assigned to the AI assistant, and no diagnostic step produced a resolution.",
		},
		timestamp: TIMESTAMP,
	},
};

/**
 * A reason the client has never seen. The open `TicketEscalationReason` union
 * plus rendering from `text` mean a reason added server-side needs no client
 * change — this story is the regression guard for that.
 */
export const UnknownReason: Story = {
	args: {
		data: {
			...baseData,
			reason: "USER_REQUESTED",
			text: "Escalated at the user's request.",
		},
		timestamp: TIMESTAMP,
	},
};
