import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ApprovalBatchMessage } from "../components/chat/approval-batch-message";
import type {
	ApprovalBatchData,
	ApprovalBatchExecutionState,
	PendingToolCallData,
} from "../components/chat/types";

/**
 * CLIENT (Fae) variant of the Command Block — Figma node 1092-2807.
 *
 * Same component and props as the Admin card, driven by `assistantType="fae"`.
 * Differences vs Admin: no tool icon next to the command, no footer divider,
 * and a single full-text status pill ("Approved by Michael Johnson") instead
 * of a compact tag + separate "by {name}".
 */

const LONG_COMMAND = `Get-CimInstance Win32_Process |
  Select-Object ProcessId, Name, Path, CommandLine |
  Where-Object { $_.Path -like 'C:\\Users\\Public\\*' }`;

const RESULT = `pid  | name           | path                          | cmdline
4821 | suspicious.exe | C:\\Users\\Public\\suspicious.exe | suspicious.exe --hidden --connect 185.220.101.45`;

const REQUEST_ID = "req-1";

const toolCall: PendingToolCallData = {
	toolExecutionRequestId: REQUEST_ID,
	toolName: "run_script",
	toolTitle: "Run Script",
	// Human-readable description shown as the collapsed row header (CLIENT);
	// the raw command moves into the expanded body (Figma 1972-6100).
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

const makeData = (
	executions?: Record<string, ApprovalBatchExecutionState>,
): ApprovalBatchData => ({
	approvalRequestId: "batch-1",
	approvalType: "CLIENT",
	toolCalls: [toolCall],
	executions,
});

const executingData = makeData({ [REQUEST_ID]: { status: "executing" } });
const doneData = makeData({
	[REQUEST_ID]: { status: "done", result: RESULT, success: true },
});

/**
 * The assistant's message text that precedes the command block in the real
 * chat (Figma "Command description text."). It is NOT part of the component —
 * shown here only so the story matches the Figma frame.
 */
const CommandHeading = () => (
	<p className="text-h4 text-ods-text-primary mb-[var(--spacing-system-xxs)]">
		Command description text.
	</p>
);

const constrainedDecorator =
	(width?: number) => (Story: React.ComponentType) => (
		<div style={{ maxWidth: width ?? 400, background: "var(--color-bg)" }}>
			<CommandHeading />
			<Story />
		</div>
	);

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
	args: { assistantType: "fae" },
	parameters: {
		docs: {
			description: {
				component:
					"CLIENT (Fae) Command Block — no tool icon, no divider, full-text status pill. Same component/props as Admin, gated by assistantType='fae' (Figma 1092-2807).",
			},
		},
	},
	decorators: [constrainedDecorator()],
} satisfies Meta<typeof ApprovalBatchMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pending — Approve / Reject buttons. Click the row to expand args. */
export const Pending: Story = {
	args: {
		data: makeData(),
		status: "pending",
		onApprove: () => {},
		onReject: () => {},
	},
};

/** Approved and still executing — grey loader on the row, no result yet. */
export const ApprovedExecuting: Story = {
	args: {
		data: executingData,
		status: "approved",
		resolvedByName: "Michael Johnson",
	},
};

/** Approved and finished — green check + expandable Result block. */
export const ApprovedDone: Story = {
	args: {
		data: doneData,
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
 * All states side by side — mirrors the Figma CLIENT "Command Blocks" board.
 */
export const AllStates: Story = {
	decorators: [plainDecorator(420)],
	render: () => {
		const states = [
			{ data: makeData(), status: "pending" as const, onApprove: () => {}, onReject: () => {} },
			{ data: executingData, status: "approved" as const, resolvedByName: "Michael Johnson" },
			{ data: doneData, status: "approved" as const, resolvedByName: "Michael Johnson" },
			{ data: makeData(), status: "rejected" as const, resolvedByName: "Michael Johnson" },
			{ data: makeData(), status: "cancelled" as const, resolvedByName: "Michael Johnson" },
		];
		return (
			<div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
				{states.map((s, i) => (
					<div key={i}>
						<CommandHeading />
						<ApprovalBatchMessage assistantType="fae" {...s} />
					</div>
				))}
			</div>
		);
	},
};
