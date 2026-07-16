import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";

import { ApprovalRequestMessage } from "../components/chat/approval-request-message";
import type { ApprovalRequestData } from "../components/chat/types";

/**
 * CLIENT (end-user Fae desktop app) variant of the single-command approval
 * card — Figma node 203-11947 ("fae-approval-block").
 *
 * Same component and props as the Admin card, driven by `variant="client"`.
 * The end client sees ONLY the BE-generated title (`explanation`) plus the
 * Approve/Reject buttons, or the full-text resolved pill
 * ("APPROVED BY JOHN SMITH"). The raw command is never rendered.
 */

const baseData: ApprovalRequestData = {
	command: 'brew install --cask slack',
	requestId: "req-client-1",
	approvalType: "CLIENT",
	// BE-generated human-readable title — the ONLY content the client sees.
	explanation: "Install Slack via Homebrew Cask on macOS",
};

const plainDecorator =
	(width?: number) => (Story: React.ComponentType) => (
		<div style={{ maxWidth: width ?? 400, background: "var(--color-bg)" }}>
			<Story />
		</div>
	);

const meta = {
	title: "Chat/Client/ApprovalRequestMessage",
	component: ApprovalRequestMessage,
	tags: ["autodocs"],
	args: { variant: "client" },
	parameters: {
		docs: {
			description: {
				component:
					"CLIENT (Fae end-user) single-command approval card — title-only with Approve/Reject or a full-text status pill ('APPROVED BY {NAME}'). The raw command is never shown. Gated by variant='client' (Figma 203-11947).",
			},
		},
	},
	decorators: [plainDecorator()],
} satisfies Meta<typeof ApprovalRequestMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pending — BE title + Approve / Reject buttons. No command block. */
export const Pending: Story = {
	args: {
		data: baseData,
		status: "pending",
		onApprove: () => {},
		onReject: () => {},
	},
};

/** Approved with resolver — green "APPROVED BY JOHN SMITH" pill. */
export const ApprovedByUser: Story = {
	args: { data: baseData, status: "approved", resolvedByName: "John Smith" },
};

/** Approved without a resolver name — plain "APPROVED" pill (system action). */
export const Approved: Story = {
	args: { data: baseData, status: "approved" },
};

/** Rejected with resolver — red "REJECTED BY JOHN SMITH" pill. */
export const RejectedByUser: Story = {
	args: { data: baseData, status: "rejected", resolvedByName: "John Smith" },
};

/** Cancelled — grey status pill. */
export const Cancelled: Story = {
	args: { data: baseData, status: "cancelled" },
};

/** Missing BE title — falls back to the "Approval required" placeholder. */
export const NoTitleFallback: Story = {
	args: {
		data: { ...baseData, explanation: undefined },
		status: "pending",
		onApprove: () => {},
		onReject: () => {},
	},
};
