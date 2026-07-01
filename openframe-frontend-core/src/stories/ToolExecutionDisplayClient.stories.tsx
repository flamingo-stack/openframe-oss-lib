import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ToolExecutionDisplay } from "../components/chat/tool-execution-display";
import type { ToolExecutionData } from "../components/chat/types";

/**
 * CLIENT (Fae) variant of the standalone tool-execution card. Same component
 * and props as the Admin card, gated by `assistantType="fae"` — the only
 * visual difference is that the tool icon next to the command is hidden.
 */

const executingMessage: ToolExecutionData = {
	type: "EXECUTING_TOOL",
	integratedToolType: "TACTICAL_RMM",
	toolFunction: "run_script",
	parameters: { RunAsUser: "False", timeoutSeconds: 60 },
};

const executedSuccessMessage: ToolExecutionData = {
	type: "EXECUTED_TOOL",
	integratedToolType: "TACTICAL_RMM",
	toolFunction: "run_script",
	parameters: { RunAsUser: "False", timeoutSeconds: 60 },
	result: `pid  | name           | path                          | cmdline
4821 | suspicious.exe | C:\\Users\\Public\\suspicious.exe | suspicious.exe --hidden --connect 185.220.101.45`,
	success: true,
};

const constrainedDecorator =
	(width?: number) => (Story: React.ComponentType) => (
		<div style={{ maxWidth: width ?? 400, background: "var(--color-bg)" }}>
			<Story />
		</div>
	);

const meta = {
	title: "Chat/Client/ToolExecutionDisplay",
	component: ToolExecutionDisplay,
	tags: ["autodocs"],
	args: { assistantType: "fae" },
	parameters: {
		docs: {
			description: {
				component:
					"CLIENT (Fae) tool-execution card — no tool icon. Same component/props as Admin, gated by assistantType='fae'.",
			},
		},
	},
	decorators: [constrainedDecorator()],
} satisfies Meta<typeof ToolExecutionDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed, executing — spinner + 2-line preview, no tool icon. */
export const CollapsedExecuting: Story = {
	args: { message: executingMessage },
};

/** Collapsed, success — green check, no tool icon. */
export const CollapsedSuccess: Story = {
	args: { message: executedSuccessMessage },
};
