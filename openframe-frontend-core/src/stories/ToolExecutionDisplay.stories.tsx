import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ToolExecutionDisplay } from "../components/chat/tool-execution-display";
import type { ToolExecutionData } from "../components/chat/types";

const executingMessage: ToolExecutionData = {
	type: "EXECUTING_TOOL",
	integratedToolType: "TACTICAL_RMM",
	toolFunction: "run_script",
	parameters: {
		RunAsUser: "False",
		timeoutSeconds: 60,
	},
};

const executedSuccessMessage: ToolExecutionData = {
	type: "EXECUTED_TOOL",
	integratedToolType: "TACTICAL_RMM",
	toolFunction: "run_script",
	parameters: {
		RunAsUser: "False",
		timeoutSeconds: 60,
	},
	result: `pid  | name           | path                          | cmdline
4821 | suspicious.exe | C:\\Users\\Public\\suspicious.exe | suspicious.exe --hidden --connect 185.220.101.45`,
	success: true,
};

const executedFailureMessage: ToolExecutionData = {
	type: "EXECUTED_TOOL",
	integratedToolType: "FLEET_MDM",
	toolFunction: "deploy_profile",
	parameters: {
		profileId: "wifi-corp-2024",
		targetGroup: "engineering",
	},
	result: "Error: Profile deployment failed - device group not found",
	success: false,
};

const constrainedDecorator =
	(width?: number) => (Story: React.ComponentType) => (
		<div
			style={{
				maxWidth: width ?? 400,
				background: "var(--color-bg)",
			}}
		>
			<Story />
		</div>
	);

const meta = {
	title: "Chat/ToolExecutionDisplay",
	component: ToolExecutionDisplay,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Displays tool execution status in the chat — collapsed preview with expand to full details including parameters and result. Click the card to toggle.",
			},
		},
	},
} satisfies Meta<typeof ToolExecutionDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Collapsed view while tool is executing — shows spinner and 2-line preview.
 */
export const CollapsedExecuting: Story = {
	args: {
		message: executingMessage,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Collapsed view after successful execution — shows green check.
 */
export const CollapsedSuccess: Story = {
	args: {
		message: executedSuccessMessage,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Collapsed view after failed execution — shows red error icon.
 */
export const CollapsedFailure: Story = {
	args: {
		message: executedFailureMessage,
	},
	decorators: [constrainedDecorator()],
};
