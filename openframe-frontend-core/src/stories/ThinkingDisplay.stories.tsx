import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ThinkingDisplay } from "../components/chat/thinking-display";

/**
 * Collapsible "Thought" block for `thinking` message segments — muted
 * markdown inside a bordered card, one line collapsed, expandable via the
 * chevron. While the segment is still streaming the label reads "Thinking"
 * and the collapse transition is disabled.
 */

const SHORT_THOUGHT =
	"The user wants Slack installed. Homebrew is present, so `brew install --cask slack` is the cleanest path.";

const LONG_THOUGHT = `The user asked to install Slack on their Mac.

**Options considered:**

1. Direct \`.dmg\` download — needs manual mounting and copying, hard to automate.
2. Homebrew Cask — \`brew install --cask slack\`, idempotent and scriptable.
3. Mac App Store via \`mas\` — requires the user to be signed in to the store.

Homebrew is already present on this endpoint (verified in the device inventory), so option 2 is the cleanest path. The install needs client approval because it modifies installed software.`;

const plainDecorator = (Story: React.ComponentType) => (
	<div style={{ maxWidth: 640, background: "var(--color-bg)" }} className="p-4">
		<Story />
	</div>
);

const meta = {
	title: "Chat/ThinkingDisplay",
	component: ThinkingDisplay,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Renders a `thinking` message segment — collapsed single-line 'Thought' card that expands to the full muted-markdown reasoning. Streaming state shows 'Thinking' with a dots loader.",
			},
		},
	},
	decorators: [plainDecorator],
} satisfies Meta<typeof ThinkingDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Finished thought — collapsed to one line, expandable. */
export const Thought: Story = {
	args: { text: SHORT_THOUGHT },
};

/** Streaming — "Thinking" label, transition disabled while tokens arrive. */
export const Streaming: Story = {
	args: { text: SHORT_THOUGHT, isStreaming: true },
};

/** Long markdown thought — headings, list, inline code; expand to read. */
export const LongMarkdown: Story = {
	args: { text: LONG_THOUGHT },
};
