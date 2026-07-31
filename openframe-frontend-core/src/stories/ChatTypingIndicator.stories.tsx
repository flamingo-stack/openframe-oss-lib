import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ChatTypingIndicator } from "../components/chat/chat-typing-indicator";

/**
 * Three pulsing dots shown while the assistant reply streams in — the
 * "Fae is typing" affordance under the message header. Also rendered
 * inside `<ChatInput>` (size="sm") while a send is in flight.
 */

const plainDecorator = (Story: React.ComponentType) => (
	<div style={{ maxWidth: 400, background: "var(--color-bg)" }} className="p-4">
		<Story />
	</div>
);

const meta = {
	title: "Chat/ChatTypingIndicator",
	component: ChatTypingIndicator,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Pulsing three-dot typing indicator. Sizes sm/md/lg; optional 'Assistant is typing' label; dot color overridable via dotClassName.",
			},
		},
	},
	decorators: [plainDecorator],
} satisfies Meta<typeof ChatTypingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — medium dots, no label. */
export const Default: Story = {};

/** Small — as rendered inside ChatInput while a send is in flight. */
export const Small: Story = { args: { size: "sm" } };

/** Large dots. */
export const Large: Story = { args: { size: "lg" } };

/** With the "Assistant is typing" label. */
export const WithText: Story = { args: { showText: true } };

/** Muted dots via dotClassName override. */
export const MutedDots: Story = {
	args: { dotClassName: "bg-ods-text-secondary" },
};
