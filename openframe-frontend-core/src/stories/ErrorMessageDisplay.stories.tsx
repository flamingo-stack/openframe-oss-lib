import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ErrorMessageDisplay } from "../components/chat/error-message-display";

/**
 * Inline error card for `error` message segments — mono uppercase title
 * with an alert icon; optional details expand under the chevron.
 * `type` tints the icon: error (red) / warning (yellow) / info (grey).
 */

const plainDecorator = (Story: React.ComponentType) => (
	<div style={{ maxWidth: 640, background: "var(--color-bg)" }} className="p-4">
		<Story />
	</div>
);

const meta = {
	title: "Chat/ErrorMessageDisplay",
	component: ErrorMessageDisplay,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Renders an `error` message segment — collapsed mono title row, expandable details. Icon tint follows type: error / warning / info.",
			},
		},
	},
	decorators: [plainDecorator],
} satisfies Meta<typeof ErrorMessageDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Error with expandable details. */
export const WithDetails: Story = {
	args: {
		title: "Tool execution failed",
		details:
			"run_script exited with code 1: brew not found on this endpoint. Install Homebrew first or use the direct .dmg fallback.",
	},
};

/** Title only — no chevron, row is not clickable. */
export const TitleOnly: Story = {
	args: { title: "Stream disconnected — retrying" },
};

/** Warning tint. */
export const Warning: Story = {
	args: {
		type: "warning",
		title: "Approval expired",
		details: "The approval request timed out after 15 minutes and was cancelled automatically.",
	},
};

/** Info tint. */
export const Info: Story = {
	args: {
		type: "info",
		title: "Session resumed",
		details: "Reconnected to the stream; missed chunks were replayed from history.",
	},
};
