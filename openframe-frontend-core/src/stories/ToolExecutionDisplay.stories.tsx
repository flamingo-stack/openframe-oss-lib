import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";
import { useState } from "react";

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

const longScriptMessage: ToolExecutionData = {
	type: "EXECUTED_TOOL",
	integratedToolType: "TACTICAL_RMM",
	toolFunction:
		"$today = (Get-Date).Date\n$logs = Get-WinEvent -FilterHashtable @{\n    LogName = 'System', 'Application', 'Security'\n    StartTime = $today\n} | Select-Object TimeCreated, Id, LevelDisplayName, Message\n$logs | Export-Csv -Path \"C:\\Logs\\today_logs.csv\" -NoTypeInformation",
	parameters: {
		RunAsUser: "False",
		timeoutSeconds: 60,
	},
	result: `pid  | name           | path                          | cmdline
4821 | suspicious.exe | C:\\Users\\Public\\suspicious.exe | suspicious.exe --hidden --connect 185.220.101.45`,
	success: true,
};

const noParamsMessage: ToolExecutionData = {
	type: "EXECUTED_TOOL",
	integratedToolType: "OPENFRAME",
	toolFunction: "get_system_info",
	result: "Windows 11 Pro 23H2 | 16GB RAM | Intel i7-13700K",
	success: true,
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
					"Displays tool execution status in the chat — collapsed preview with expand to full details including parameters and result.",
			},
		},
	},
	argTypes: {
		isExpanded: {
			control: "boolean",
			description: "Whether the content is expanded",
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
		isExpanded: false,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Collapsed view after successful execution — shows green check.
 */
export const CollapsedSuccess: Story = {
	args: {
		message: executedSuccessMessage,
		isExpanded: false,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Collapsed view after failed execution — shows red error icon.
 */
export const CollapsedFailure: Story = {
	args: {
		message: executedFailureMessage,
		isExpanded: false,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Expanded view while executing — shows parameters and loading spinner for result.
 */
export const ExpandedExecuting: Story = {
	args: {
		message: executingMessage,
		isExpanded: true,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Expanded view after success — shows parameters and result content.
 */
export const ExpandedSuccess: Story = {
	args: {
		message: executedSuccessMessage,
		isExpanded: true,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Expanded view after failure — shows parameters and error result.
 */
export const ExpandedFailure: Story = {
	args: {
		message: executedFailureMessage,
		isExpanded: true,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Multi-line script content matching the Figma reference design.
 */
export const LongScript: Story = {
	args: {
		message: longScriptMessage,
		isExpanded: true,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Tool with no parameters — only function name and result shown.
 */
export const NoParameters: Story = {
	args: {
		message: noParamsMessage,
		isExpanded: true,
	},
	decorators: [constrainedDecorator()],
};

/**
 * Interactive demo — click to toggle expand/collapse.
 */
export const Interactive: Story = {
	args: {
		message: executedSuccessMessage,
	},
	decorators: [constrainedDecorator()],
	render: function Render() {
		const [expanded, setExpanded] = useState(false);
		return (
			<ToolExecutionDisplay
				message={executedSuccessMessage}
				isExpanded={expanded}
				onToggleExpand={() => setExpanded(!expanded)}
			/>
		);
	},
};

/**
 * All six Figma states displayed together for comparison.
 */
export const AllStates: Story = {
	args: {
		message: executingMessage,
	},
	render: function Render() {
		const [expandedStates, setExpandedStates] = useState<
			Record<string, boolean>
		>({});

		const toggle = (key: string) =>
			setExpandedStates((prev) => ({ ...prev, [key]: !prev[key] }));

		return (
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 400px)",
					gap: "1rem",
				}}
			>
				{/* Top row: collapsed */}
				<div>
					<p
						style={{
							color: "var(--color-text-secondary)",
							fontSize: 12,
							marginBottom: 8,
						}}
					>
						Collapsed + Default
					</p>
					<ToolExecutionDisplay
						message={{
							...executingMessage,
							type: "EXECUTING_TOOL",
						}}
						isExpanded={false}
					/>
				</div>
				<div>
					<p
						style={{
							color: "var(--color-text-secondary)",
							fontSize: 12,
							marginBottom: 8,
						}}
					>
						Collapsed + Progress
					</p>
					<ToolExecutionDisplay
						message={executingMessage}
						isExpanded={false}
					/>
				</div>
				<div>
					<p
						style={{
							color: "var(--color-text-secondary)",
							fontSize: 12,
							marginBottom: 8,
						}}
					>
						Collapsed + Done
					</p>
					<ToolExecutionDisplay
						message={executedSuccessMessage}
						isExpanded={false}
					/>
				</div>

				{/* Bottom row: expanded */}
				<div>
					<p
						style={{
							color: "var(--color-text-secondary)",
							fontSize: 12,
							marginBottom: 8,
						}}
					>
						Expanded + Default
					</p>
					<ToolExecutionDisplay
						message={longScriptMessage}
						isExpanded={expandedStates["ed"] ?? true}
						onToggleExpand={() => toggle("ed")}
					/>
				</div>
				<div>
					<p
						style={{
							color: "var(--color-text-secondary)",
							fontSize: 12,
							marginBottom: 8,
						}}
					>
						Expanded + Progress
					</p>
					<ToolExecutionDisplay
						message={{
							...longScriptMessage,
							type: "EXECUTING_TOOL",
							result: undefined,
							success: undefined,
						}}
						isExpanded={expandedStates["ep"] ?? true}
						onToggleExpand={() => toggle("ep")}
					/>
				</div>
				<div>
					<p
						style={{
							color: "var(--color-text-secondary)",
							fontSize: 12,
							marginBottom: 8,
						}}
					>
						Expanded + Done
					</p>
					<ToolExecutionDisplay
						message={longScriptMessage}
						isExpanded={expandedStates["edn"] ?? true}
						onToggleExpand={() => toggle("edn")}
					/>
				</div>
			</div>
		);
	},
};
