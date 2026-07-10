import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ApprovalBatchMessage } from "../components/chat/approval-batch-message";
import type {
	ApprovalBatchData,
	PendingToolCallData,
} from "../components/chat/types";

/**
 * CLIENT (end-user Fae desktop app) variant of the approval block — Figma
 * node 203-11947 ("fae-approval-block").
 *
 * Same component and props as the Admin card, driven by `variant="client"`.
 * The end client sees ONLY the BE-generated title plus the Approve/Reject
 * buttons, or the full-text resolved pill ("Approved by Michael Johnson").
 * Commands, scripts, expandable args/results and execution icons are never
 * rendered in this variant.
 */

const LONG_COMMAND = `Get-CimInstance Win32_Process |
  Select-Object ProcessId, Name, Path, CommandLine |
  Where-Object { $_.Path -like 'C:\\Users\\Public\\*' }`;

const REQUEST_ID = "req-1";

const toolCall: PendingToolCallData = {
	toolExecutionRequestId: REQUEST_ID,
	toolName: "run_script",
	toolTitle: "Run Script",
	// BE-generated human-readable title — the ONLY content the client sees.
	toolExplanation:
		"Collects today's system, application, and security event logs and exports them to a CSV file.",
	toolType: "OPENFRAME_RMM",
	requiresApproval: true,
	approvalType: "CLIENT",
	toolCallArguments: {
		command: LONG_COMMAND,
		RunAsUser: "False",
		timeoutSeconds: 60,
	},
};

const makeData = (): ApprovalBatchData => ({
	approvalRequestId: "batch-1",
	approvalType: "CLIENT",
	toolCalls: [toolCall],
});

const plainDecorator =
	(width?: number) => (Story: React.ComponentType) => (
		<div style={{ maxWidth: width ?? 400, background: "var(--color-bg)" }}>
			<Story />
		</div>
	);

const meta = {
	title: "Chat/Client/ApprovalBatchMessage",
	component: ApprovalBatchMessage,
	tags: ["autodocs"],
	args: { variant: "client" },
	parameters: {
		docs: {
			description: {
				component:
					"CLIENT (Fae end-user) approval block — title-only card with Approve/Reject or a full-text status pill. Commands/scripts are never shown. Gated by variant='client' (Figma 203-11947).",
			},
		},
	},
	decorators: [plainDecorator()],
} satisfies Meta<typeof ApprovalBatchMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pending — title + Approve / Reject buttons. No expandable command. */
export const Pending: Story = {
	args: {
		data: makeData(),
		status: "pending",
		onApprove: () => {},
		onReject: () => {},
	},
};

/** Approved — full-text green status pill. */
export const Approved: Story = {
	args: {
		data: makeData(),
		status: "approved",
		resolvedByName: "Michael Johnson",
	},
};

/** Rejected by a user — full-text red status pill. */
export const Rejected: Story = {
	args: {
		data: makeData(),
		status: "rejected",
		resolvedByName: "Michael Johnson",
	},
};

/** Cancelled — full-text grey status pill. */
export const Cancelled: Story = {
	args: {
		data: makeData(),
		status: "cancelled",
		resolvedByName: "Michael Johnson",
	},
};

/**
 * All states side by side — mirrors the Figma CLIENT approval-block frames
 * (1-6575 / 1-6621 / 1-6637 / 1-6653).
 */
export const AllStates: Story = {
	decorators: [plainDecorator(420)],
	render: () => {
		const states = [
			{ data: makeData(), status: "pending" as const, onApprove: () => {}, onReject: () => {} },
			{ data: makeData(), status: "approved" as const, resolvedByName: "Michael Johnson" },
			{ data: makeData(), status: "rejected" as const, resolvedByName: "Michael Johnson" },
			{ data: makeData(), status: "cancelled" as const, resolvedByName: "Michael Johnson" },
		];
		return (
			<div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
				{states.map((s, i) => (
					<ApprovalBatchMessage key={i} variant="client" {...s} />
				))}
			</div>
		);
	},
};
