import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { TicketEventMessage } from "../components/chat/ticket-event-message";

/**
 * `ticket_event` message segment — the ticket lifecycle receipt (Figma:
 * `ai-assistant-info`, types resolved-fae / resolved-tech / reopened-fae /
 * reopened-tech / reopened-reason).
 *
 * Decoded from the standalone `TICKET_EVENT` chunk (live) or the persisted
 * `TicketEventData` row (history). `kind` is an OPEN vocabulary: unknown
 * kinds render as a neutral info line rather than being dropped, so the
 * backend can add lifecycle kinds without a client release.
 */

/** Fixed so the timestamp doesn't churn between snapshots. */
const TIMESTAMP = new Date("2026-08-07T14:47:00");

const plainDecorator = (Story: React.ComponentType) => (
	<div style={{ maxWidth: 600, background: "var(--color-bg)" }} className="p-4">
		<Story />
	</div>
);

const meta = {
	title: "Chat/Client/TicketEventMessage",
	component: TicketEventMessage,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Renders a `TICKET_EVENT` block: a green check for RESOLVED, a pink info tile for REOPENED and for any kind this build doesn't know, with copy composed from the event's actor and reason fields.",
			},
		},
	},
	decorators: [plainDecorator],
} satisfies Meta<typeof TicketEventMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fae (the AI agent) resolved the ticket — Figma type=resolved-fae. */
export const ResolvedByFae: Story = {
	args: {
		data: { kind: "RESOLVED", actorId: "fae", actorName: "Fae", actorType: "AI" },
		timestamp: TIMESTAMP,
	},
};

/** A human technician resolved the ticket — Figma type=resolved-tech. */
export const ResolvedByTechnician: Story = {
	args: {
		data: { kind: "RESOLVED", actorId: "u-42", actorName: "Roman Smith", actorType: "TECHNICIAN" },
		timestamp: TIMESTAMP,
	},
};

/** Reopened with the user's stated reason — Figma type=reopened-reason. */
export const ReopenedWithReason: Story = {
	args: {
		data: {
			kind: "REOPENED",
			actorId: "u-7",
			actorName: "John Smith",
			actorType: "CLIENT",
			reason: "The printer stopped working again",
		},
		timestamp: TIMESTAMP,
	},
};

/** Reopened into AI Assistance (targetStatusKind decides) — Figma type=reopened-fae. */
export const ReopenedFaeContinues: Story = {
	args: {
		data: { kind: "REOPENED", actorId: "u-7", actorName: "John Smith", actorType: "CLIENT", targetStatusKind: "AI_ASSISTANCE" },
		timestamp: TIMESTAMP,
	},
};

/** Reopened into Tech Required (targetStatusKind decides) — Figma type=reopened-tech. */
export const ReopenedTechnicianReplies: Story = {
	args: {
		data: { kind: "REOPENED", actorId: "u-7", actorName: "John Smith", actorType: "CLIENT", targetStatusKind: "TECH_REQUIRED" },
		timestamp: TIMESTAMP,
	},
};

/** Older backend without targetStatusKind — the actorType heuristic still decides. */
export const ReopenedLegacyActorFallback: Story = {
	args: {
		data: { kind: "REOPENED", actorId: "fae", actorName: "Fae", actorType: "AI" },
		timestamp: TIMESTAMP,
	},
};

/**
 * A kind the client has never seen. The open vocabulary means the backend can
 * add lifecycle kinds without a client release — this story is the regression
 * guard: neutral info line, humanized title, never dropped.
 */
export const UnknownKind: Story = {
	args: {
		data: { kind: "ON_HOLD", actorName: "Roman Smith", reason: "Waiting for replacement hardware" },
		timestamp: TIMESTAMP,
	},
};
