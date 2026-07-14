import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ContextCompactionDisplay } from "../components/chat/context-compaction-display";

/**
 * Inline status pill for `context_compaction` message segments — shown when
 * the conversation hits the context limit and earlier messages get
 * summarized. `started` shows a dots loader, `completed` a green check.
 */

const plainDecorator = (Story: React.ComponentType) => (
	<div style={{ maxWidth: 640, background: "var(--color-bg)" }} className="p-4">
		<Story />
	</div>
);

const meta = {
	title: "Chat/ContextCompactionDisplay",
	component: ContextCompactionDisplay,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Renders a `context_compaction` message segment — 'Context limit reached…' with a dots loader while running, 'Earlier context summarized.' with a check once done.",
			},
		},
	},
	decorators: [plainDecorator],
} satisfies Meta<typeof ContextCompactionDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In progress — summarizing earlier messages. */
export const Started: Story = {
	args: { status: "started" },
};

/** Finished — earlier context summarized. */
export const Completed: Story = {
	args: { status: "completed" },
};
