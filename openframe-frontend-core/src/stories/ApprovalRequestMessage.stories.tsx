import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ApprovalRequestMessage } from "../components/chat/approval-request-message";
import type { ApprovalRequestData } from "../components/chat/types";

/**
 * Single-command approval card (the legacy, non-batch variant of the Figma
 * "Command Block"). Renders a command bar, an optional structured field list
 * or explanation, and an Approve/Reject footer that flips to an
 * Approved/Rejected status tag once resolved.
 *
 * Newer surfaces use `ApprovalBatchMessage` (see the ApprovalBatchMessage
 * story) which additionally tracks per-tool execution + results.
 */

const LONG_COMMAND = `Get-CimInstance Win32_Process |
  Select-Object ProcessId, Name, Path, CommandLine |
  Where-Object { $_.Path -like 'C:\\Users\\Public\\*' }`;

const baseData: ApprovalRequestData = {
	command: LONG_COMMAND,
	requestId: "req-1",
	approvalType: "ADMIN",
	fields: [
		{ label: "Tool", value: "Tactical RMM" },
		{ label: "RunAsUser", value: "False" },
		{ label: "timeoutSeconds", value: "60" },
	],
};

const constrainedDecorator =
	(width?: number) => (Story: React.ComponentType) => (
		<div style={{ maxWidth: width ?? 400, background: "var(--color-bg)" }}>
			<Story />
		</div>
	);

const meta = {
	title: "Chat/ApprovalRequestMessage",
	component: ApprovalRequestMessage,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Single-command approval card — the legacy variant of the Figma Command Block. Prefer ApprovalBatchMessage for new work.",
			},
		},
	},
	decorators: [constrainedDecorator()],
} satisfies Meta<typeof ApprovalRequestMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pending — Approve / Reject buttons shown. */
export const Pending: Story = {
	args: {
		data: baseData,
		status: "pending",
		onApprove: () => {},
		onReject: () => {},
	},
};

/** Approved — green status tag. */
export const Approved: Story = {
	args: { data: baseData, status: "approved" },
};

/** Rejected — red status tag. */
export const Rejected: Story = {
	args: { data: baseData, status: "rejected" },
};

/** Cancelled — grey status tag. */
export const Cancelled: Story = {
	args: { data: baseData, status: "cancelled" },
};

/** Explanation prose instead of a structured field list. */
export const WithExplanation: Story = {
	args: {
		data: {
			command: LONG_COMMAND,
			requestId: "req-2",
			explanation:
				"This runs a read-only diagnostic to inspect processes launched from the public folder. It does not modify the endpoint.",
		},
		status: "pending",
		onApprove: () => {},
		onReject: () => {},
	},
};
