import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ChatMessageEnhanced } from "../components/chat/chat-message-enhanced";
import { ChatTypingIndicator } from "../components/chat/chat-typing-indicator";
import type { MessageSegment } from "../components/chat/types";

/**
 * `<ChatMessageEnhanced>` — THE chat message renderer used by
 * ChatMessageList / EmbeddableChat. Renders the avatar + name + timestamp
 * header (Fae pink / Mingo cyan / user grey) and every message-segment type:
 * text (markdown), thinking, tool_execution, approval_request/batch, error,
 * context_compaction.
 *
 * The Fae conversation scenes reproduce the Fae desktop-app flow: greeting →
 * user request → approval block → typing dots (Figma "fae-approval-block").
 */

// Fixed time-of-day so the header always reads "2:47 PM" — messages dated
// today render time-only (see formatMessageTimestamp).
const at247 = () => {
	const d = new Date();
	d.setHours(14, 47, 0, 0);
	return d;
};

const panelDecorator = (Story: React.ComponentType) => (
	<div
		style={{ maxWidth: 640, background: "var(--color-bg)" }}
		className="p-[var(--spacing-system-m)]"
	>
		<Story />
	</div>
);

const meta = {
	title: "Chat/ChatMessageEnhanced",
	component: ChatMessageEnhanced,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Single chat message row — avatar + colored author name + timestamp header, plus the full segment renderer (text/thinking/tool/approval/error/compaction). Used by ChatMessageList in both the admin (Mingo) and client (Fae) chats.",
			},
		},
	},
	decorators: [panelDecorator],
} satisfies Meta<typeof ChatMessageEnhanced>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Assistant (Fae) text message — pink mono name + timestamp. */
export const AssistantFae: Story = {
	args: {
		role: "assistant",
		name: "Fae",
		content: "Good morning! How can I help you today?",
		timestamp: at247(),
	},
};

/** Assistant (Mingo) text message — cyan mono name. */
export const AssistantMingo: Story = {
	args: {
		role: "assistant",
		name: "Mingo",
		assistantType: "mingo",
		content: "I've pulled the device list for Acme Corp — 3 endpoints are offline.",
		timestamp: at247(),
	},
};

/** User message — grey mono name, no avatar block until user avatars ship. */
export const UserMessage: Story = {
	args: {
		role: "user",
		name: "John Smith",
		content: "hey can u install slack on my mac",
		timestamp: at247(),
	},
};

/**
 * Fae flow, step 1 — greeting, user request, and the assistant "typing"
 * row (empty message + `<ChatTypingIndicator>`, as the Fae desktop host
 * renders it while the reply streams in).
 */
export const FaeConversationTyping: Story = {
	args: { role: "assistant", content: "" },
	render: () => (
		<div className="flex flex-col">
			<ChatMessageEnhanced
				role="assistant"
				name="Fae"
				content="Good morning! How can I help you today?"
				timestamp={at247()}
			/>
			<ChatMessageEnhanced
				role="user"
				name="John Smith"
				content="hey can u install slack on my mac"
				timestamp={at247()}
			/>
			<ChatMessageEnhanced role="assistant" name="Fae" content="" isTyping timestamp={at247()} />
			<ChatTypingIndicator size="sm" />
		</div>
	),
};

const approvedSegments: MessageSegment[] = [
	{ type: "text", text: "On it! Just need your quick approval here." },
	{
		type: "approval_request",
		data: {
			command: "brew install --cask slack",
			requestId: "req-1",
			approvalType: "CLIENT",
			explanation: "Install Slack via Homebrew Cask on macOS",
		},
		status: "approved",
		resolvedByName: "John Smith",
	},
];

/**
 * Fae flow, step 2 — the reply carries an `approval_request` segment
 * rendered as the CLIENT card with the resolved "APPROVED BY JOHN SMITH"
 * pill (`approvalVariant="client"`), then Fae keeps typing.
 */
export const FaeConversationApproved: Story = {
	args: { role: "assistant", content: "" },
	render: () => (
		<div className="flex flex-col">
			<ChatMessageEnhanced
				role="assistant"
				name="Fae"
				content="Good morning! How can I help you today?"
				timestamp={at247()}
			/>
			<ChatMessageEnhanced
				role="user"
				name="John Smith"
				content="hey can u install slack on my mac"
				timestamp={at247()}
			/>
			<ChatMessageEnhanced
				role="assistant"
				name="Fae"
				content={approvedSegments}
				approvalVariant="client"
				timestamp={at247()}
			/>
			<ChatMessageEnhanced role="assistant" name="Fae" content="" isTyping timestamp={at247()} />
			<ChatTypingIndicator size="sm" />
		</div>
	),
};

/** Pending approval inside a message — Approve/Reject buttons (client card). */
export const PendingApprovalSegment: Story = {
	args: {
		role: "assistant",
		name: "Fae",
		approvalVariant: "client",
		timestamp: at247(),
		content: [
			{ type: "text", text: "On it! Just need your quick approval here." },
			{
				type: "approval_request",
				data: {
					command: "brew install --cask slack",
					requestId: "req-2",
					approvalType: "CLIENT",
					explanation: "Install Slack via Homebrew Cask on macOS",
				},
				status: "pending",
				onApprove: () => {},
				onReject: () => {},
			},
		] satisfies MessageSegment[],
	},
};

/** Every remaining segment type in one message — thinking, tool execution, context compaction, error. */
export const AllSegmentTypes: Story = {
	args: {
		role: "assistant",
		name: "Fae",
		timestamp: at247(),
		content: [
			{
				type: "thinking",
				text: "The user wants Slack installed. Homebrew is present on the endpoint, so `brew install --cask slack` is the cleanest path.",
			},
			{ type: "text", text: "Installing Slack now." },
			{
				type: "tool_execution",
				data: {
					type: "EXECUTED_TOOL",
					integratedToolType: "OPENFRAME_RMM",
					toolFunction: "run_script",
					toolTitle: "Install Slack via Homebrew Cask",
					parameters: { command: "brew install --cask slack" },
					result: "🍺  slack was successfully installed!",
					success: true,
				},
			},
			{ type: "context_compaction", status: "completed" },
			{
				type: "error",
				title: "Notification delivery failed",
				details: "Slack webhook returned 429 — the completion ping was skipped. The install itself succeeded.",
			},
			{ type: "text", text: "Done — Slack is installed and ready to use." },
		] satisfies MessageSegment[],
	},
};
