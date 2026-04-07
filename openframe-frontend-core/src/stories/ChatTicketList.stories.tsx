import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type React from "react";
import type { ChatTicketItemData } from "../components/chat/chat-ticket-item";
import { ChatTicketList } from "../components/chat/chat-ticket-list";

const mockTickets: ChatTicketItemData[] = [
	{
		id: "1",
		title: "Printer not working",
		ticketNumber: "1002",
		status: "ACTIVE",
		category: "Hardware Issue",
		timeAgo: "2 hours",
	},
	{
		id: "2",
		title: "Can't access shared drive",
		ticketNumber: "1003",
		status: "ON_HOLD",
		category: "Network Issue",
		timeAgo: "4 hours",
	},
	{
		id: "3",
		title: "Outlook keeps crashing",
		ticketNumber: "1004",
		status: "TECH_REQUIRED",
		category: "Software Issue",
		timeAgo: "8 hours",
	},
	{
		id: "4",
		title: "VPN connection failed",
		ticketNumber: "1005",
		status: "RESOLVED",
		category: "Network Issue",
		timeAgo: "4 hours",
	},
	{
		id: "5",
		title: "Server very slow today",
		ticketNumber: "1006",
		status: "RESOLVED",
		category: "Performance",
		timeAgo: "4 hours",
	},
];

const manyTickets: ChatTicketItemData[] = [
	...mockTickets,
	{
		id: "6",
		title: "Email delivery delayed",
		ticketNumber: "1007",
		status: "ACTIVE",
		category: "Email",
		timeAgo: "1 hour",
	},
	{
		id: "7",
		title: "Monitor flickering on startup",
		ticketNumber: "1008",
		status: "TECH_REQUIRED",
		category: "Hardware Issue",
		timeAgo: "30 min",
	},
	{
		id: "8",
		title: "Cannot install software update",
		ticketNumber: "1009",
		status: "ON_HOLD",
		category: "Software Issue",
		timeAgo: "3 hours",
	},
	{
		id: "9",
		title: "Wi-Fi dropping intermittently",
		ticketNumber: "1010",
		status: "ACTIVE",
		category: "Network Issue",
		timeAgo: "5 hours",
	},
	{
		id: "10",
		title: "Keyboard not responding after sleep",
		ticketNumber: "1011",
		status: "RESOLVED",
		category: "Hardware Issue",
		timeAgo: "1 day",
	},
	{
		id: "11",
		title: "File sync conflict on shared folder",
		ticketNumber: "1012",
		status: "ACTIVE",
		category: "Cloud Storage",
		timeAgo: "6 hours",
	},
	{
		id: "12",
		title: "Two-factor authentication locked out",
		ticketNumber: "1013",
		status: "TECH_REQUIRED",
		category: "Security",
		timeAgo: "15 min",
	},
	{
		id: "13",
		title: "Zoom audio echo during calls",
		ticketNumber: "1014",
		status: "ON_HOLD",
		category: "Software Issue",
		timeAgo: "2 days",
	},
	{
		id: "14",
		title: "Backup job failed overnight",
		ticketNumber: "1015",
		status: "ACTIVE",
		category: "Infrastructure",
		timeAgo: "10 hours",
	},
	{
		id: "15",
		title: "New employee laptop setup request",
		ticketNumber: "1016",
		status: "ACTIVE",
		category: "Onboarding",
		timeAgo: "1 day",
	},
];

const meta = {
	title: "Chat/ChatTicketList",
	component: ChatTicketList,
	tags: ["autodocs"],
	argTypes: {
		onTicketClick: { action: "ticketClicked" },
	},
} satisfies Meta<typeof ChatTicketList>;

export default meta;
type Story = StoryObj<typeof meta>;

const constrainedDecorator =
	(height?: number) => (Story: React.ComponentType) => (
		<div
			style={{
				maxWidth: 600,
				height: height,
				background: "var(--color-bg)",
				padding: 24,
				display: "flex",
				flexDirection: "column",
			}}
		>
			<Story />
		</div>
	);

export const Default: Story = {
	args: {
		tickets: mockTickets,
	},
	decorators: [constrainedDecorator()],
};

export const SingleTicket: Story = {
	args: {
		tickets: [mockTickets[0]],
	},
	decorators: [constrainedDecorator()],
};

export const AllStatuses: Story = {
	args: {
		tickets: mockTickets.slice(0, 4),
	},
	decorators: [constrainedDecorator()],
};

/** Scroll with bottom fade visible initially. Scroll down to see top fade appear. */
export const ScrollFading: Story = {
	args: {
		tickets: manyTickets,
	},
	decorators: [constrainedDecorator(400)],
};

/** Tighter container to make fading more obvious */
export const ScrollFadingCompact: Story = {
	args: {
		tickets: manyTickets,
	},
	decorators: [constrainedDecorator(280)],
};
