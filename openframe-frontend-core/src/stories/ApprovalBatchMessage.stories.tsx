import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ApprovalBatchMessage } from "../components/chat/approval-batch-message";
import type {
	ApprovalBatchData,
	ApprovalBatchExecutionState,
	PendingToolCallData,
} from "../components/chat/types";

/**
 * The "Command Block" from Figma (open-design-system, node 1092-2807).
 *
 * A single command/tool call the AI wants to run, rendered as an approvable
 * card: a command title line, an expandable body with the call arguments
 * (RunAsUser, timeoutSeconds, …) and — once executed — a Result block. The
 * footer flips between Approve/Reject buttons (pending) and a resolved status
 * tag ("Approved / Rejected / Cancelled by {name}").
 *
 * Click a row to expand/collapse its body.
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
	toolExplanation:
		"Runs a diagnostic script on the endpoint to inspect running processes.",
	toolType: "TACTICAL_RMM",
	requiresApproval: true,
	approvalType: "ADMIN",
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
	approvalType: "ADMIN",
	toolCalls: [toolCall],
	executions,
});

const executingData = makeData({ [REQUEST_ID]: { status: "executing" } });
const doneData = makeData({
	[REQUEST_ID]: { status: "done", result: RESULT, success: true },
});

const constrainedDecorator =
	(width?: number) => (Story: React.ComponentType) => (
		<div style={{ maxWidth: width ?? 400, background: "var(--color-bg)" }}>
			<Story />
		</div>
	);

const meta = {
	title: "Chat/ApprovalBatchMessage",
	component: ApprovalBatchMessage,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Command Block (Figma node 1092-2807). Approvable tool-call card with pending / approved / rejected / cancelled states, an expandable body of call arguments, and a Result block after execution.",
			},
		},
	},
	decorators: [constrainedDecorator()],
} satisfies Meta<typeof ApprovalBatchMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pending — Approve / Reject buttons shown. Click the row to expand args. */
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

/** Rejected by a user — red status tag, no execution. */
export const Rejected: Story = {
	args: {
		data: makeData(),
		status: "rejected",
		resolvedByName: "Michael Johnson",
	},
};

/** Cancelled — grey status tag, no execution. */
export const Cancelled: Story = {
	args: {
		data: makeData(),
		status: "cancelled",
		resolvedByName: "Michael Johnson",
	},
};

/**
 * All states side by side — mirrors the Figma "Command Blocks" board so the
 * full set can be reviewed at a glance.
 */
export const AllStates: Story = {
	decorators: [constrainedDecorator(420)],
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
			<ApprovalBatchMessage
				data={makeData()}
				status="pending"
				onApprove={() => {}}
				onReject={() => {}}
			/>
			<ApprovalBatchMessage
				data={executingData}
				status="approved"
				resolvedByName="Michael Johnson"
			/>
			<ApprovalBatchMessage
				data={doneData}
				status="approved"
				resolvedByName="Michael Johnson"
			/>
			<ApprovalBatchMessage
				data={makeData()}
				status="rejected"
				resolvedByName="Michael Johnson"
			/>
			<ApprovalBatchMessage
				data={makeData()}
				status="cancelled"
				resolvedByName="Michael Johnson"
			/>
		</div>
	),
};
