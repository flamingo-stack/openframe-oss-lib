"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useState } from "react";
import { Chevron02RightIcon, Ellipsis01Icon } from "../icons-v2-generated";
import { cn } from "../../utils/cn";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "./dropdown-menu";

export interface ActionsMenuItemIconAction {
	icon: React.ReactNode;
	"aria-label": string;
	onClick?: () => void;
	href?: string;
	openInNewTab?: boolean;
	disabled?: boolean;
}

export interface ActionsMenuItem {
	id: string;
	label: string;
	icon?: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	type?: "item" | "checkbox" | "submenu" | "separator";
	checked?: boolean;
	submenu?: ActionsMenuItem[];
	/** Optional URL for navigation items */
	href?: string;
	/**
	 * Optional secondary action — a 40px-wide button on the right of the row
	 * with a vertical divider. The main row keeps its primary click target;
	 * the secondary is independently clickable (e.g. "open in new tab").
	 */
	iconAction?: ActionsMenuItemIconAction;
}

export interface ActionsMenuGroup {
	id?: string;
	items: ActionsMenuItem[];
	separator?: boolean;
}

export interface ActionsMenuProps {
	groups: ActionsMenuGroup[];
	className?: string;
	onItemClick?: (item: ActionsMenuItem) => void;
}

interface MenuItemProps {
	item: ActionsMenuItem;
	onItemClick?: (item: ActionsMenuItem) => void;
}

const ROW_CLASSES =
	"flex flex-1 min-w-0 items-center gap-2 px-3 py-3 cursor-pointer transition-colors bg-ods-bg outline-none";
const WRAPPER_CLASSES =
	"relative flex items-stretch border-b border-ods-border last:border-b-0";

const SECONDARY_ACTION_CLASSES =
	"flex w-10 shrink-0 items-center justify-center self-stretch border-l border-ods-border transition-colors hover:bg-ods-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus";

const SecondaryAction: React.FC<{ action: ActionsMenuItemIconAction }> = ({ action }) => {
	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (action.disabled) {
				e.preventDefault();
				return;
			}
			action.onClick?.();
		},
		[action],
	);

	const classes = cn(
		SECONDARY_ACTION_CLASSES,
		action.disabled && "cursor-not-allowed opacity-60 pointer-events-none",
	);

	if (action.href) {
		return (
			<Link
				href={action.href}
				prefetch={false}
				target={action.openInNewTab ? "_blank" : undefined}
				rel={action.openInNewTab ? "noopener noreferrer" : undefined}
				aria-label={action["aria-label"]}
				aria-disabled={action.disabled || undefined}
				tabIndex={action.disabled ? -1 : undefined}
				className={classes}
				onClick={handleClick}
			>
				{action.icon}
			</Link>
		);
	}

	return (
		<button
			type="button"
			aria-label={action["aria-label"]}
			disabled={action.disabled}
			className={classes}
			onClick={handleClick}
		>
			{action.icon}
		</button>
	);
};

const MenuItem: React.FC<MenuItemProps> = ({ item, onItemClick }) => {
	const activate = useCallback(() => {
		if (item.disabled) return;
		if (item.type === "checkbox") {
			item.onClick?.();
			onItemClick?.(item);
			return;
		}
		if (item.type === "submenu") return;
		item.onClick?.();
		onItemClick?.(item);
	}, [item, onItemClick]);

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			activate();
		},
		[activate],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key !== "Enter" && e.key !== " ") return;
			e.preventDefault();
			e.stopPropagation();
			activate();
		},
		[activate],
	);

	const handleLinkClick = useCallback(
		(e: React.MouseEvent<HTMLAnchorElement>) => {
			if (item.disabled) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			item.onClick?.();
			onItemClick?.(item);
		},
		[item, onItemClick],
	);

	if (item.type === "separator") {
		return <div className="bg-ods-system-greys-soft-grey h-1 w-full" />;
	}

	const itemClasses = cn(
		ROW_CLASSES,
		item.disabled
			? "text-ods-text-secondary cursor-not-allowed pointer-events-none opacity-60"
			: "text-ods-text-primary hover:bg-ods-bg-hover",
	);

	const subTriggerClasses = cn(
		itemClasses,
		"data-[state=open]:bg-[#2b2b2b] focus:bg-ods-bg-hover",
	);

	const renderAsLink =
		!!item.href && item.type !== "submenu" && item.type !== "checkbox";

	const rowContent = (
		<>
			{item.icon && (
				<div
					className={cn(
						"w-6 h-6 flex-shrink-0 flex items-center justify-center",
						item.disabled && "opacity-50",
					)}
				>
					{item.icon}
				</div>
			)}

			<span
				className={cn(
					"flex-1 text-[18px] font-medium leading-6",
					item.disabled ? "text-ods-text-secondary" : "text-ods-text-primary",
				)}
			>
				{item.label}
			</span>

			{item.type === "checkbox" && (
				<div
					className={cn(
						"w-6 h-6 flex items-center justify-center rounded-md transition-colors",
						item.checked
							? "bg-[#ffc008]"
							: "border-2 border-ods-border bg-transparent",
					)}
				>
					{item.checked && (
						<Check className="w-4 h-4 text-black" strokeWidth={3} />
					)}
				</div>
			)}

			{item.type === "submenu" && (
				<Chevron02RightIcon className="w-6 h-6 text-ods-text-secondary" />
			)}
		</>
	);

	if (renderAsLink && item.href) {
		return (
			<div className={WRAPPER_CLASSES}>
				<Link
					href={item.href}
					prefetch={false}
					className={itemClasses}
					onClick={handleLinkClick}
					aria-disabled={item.disabled}
					tabIndex={item.disabled ? -1 : undefined}
				>
					{rowContent}
				</Link>
				{item.iconAction && <SecondaryAction action={item.iconAction} />}
			</div>
		);
	}

	if (item.type === "submenu" && item.submenu) {
		return (
			<div className={WRAPPER_CLASSES}>
				<DropdownMenuPrimitive.Sub>
					<DropdownMenuPrimitive.SubTrigger
						disabled={item.disabled}
						className={subTriggerClasses}
					>
						{rowContent}
					</DropdownMenuPrimitive.SubTrigger>
					<DropdownMenuPrimitive.Portal>
						<DropdownMenuPrimitive.SubContent
							sideOffset={4}
							className="z-[1500] min-w-[256px] max-h-[var(--radix-popper-available-height)] bg-ods-bg border border-ods-border rounded-md shadow-xl overflow-y-auto p-0"
						>
							{item.submenu.map((subItem, index) => (
								<MenuItem
									key={subItem.id || index}
									item={subItem}
									onItemClick={onItemClick}
								/>
							))}
						</DropdownMenuPrimitive.SubContent>
					</DropdownMenuPrimitive.Portal>
				</DropdownMenuPrimitive.Sub>
				{item.iconAction && <SecondaryAction action={item.iconAction} />}
			</div>
		);
	}

	return (
		<div className={WRAPPER_CLASSES}>
			<div
				role="menuitem"
				tabIndex={item.disabled ? -1 : 0}
				aria-disabled={item.disabled}
				className={itemClasses}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
			>
				{rowContent}
			</div>
			{item.iconAction && <SecondaryAction action={item.iconAction} />}
		</div>
	);
};

const GroupSeparator: React.FC = () => (
	<div className="bg-ods-bg-surface h-[3px] w-full" />
);

export const ActionsMenu: React.FC<ActionsMenuProps> = ({
	groups,
	className = "",
	onItemClick,
}) => {
	return (
		<div
			className={`relative min-w-[256px] max-h-[var(--radix-popper-available-height)] bg-ods-bg border border-ods-border rounded-md shadow-lg overflow-y-auto ${className}`}
		>
			{groups.map((group, groupIndex) => {
				const groupKey = group.id || group.items.map((i) => i.id).join("|");
				return (
					<React.Fragment key={groupKey}>
						{group.items.map((item, itemIndex) => (
							<MenuItem
								key={item.id || `${groupKey}-${itemIndex}`}
								item={item}
								onItemClick={onItemClick}
							/>
						))}
						{group.separator && groupIndex < groups.length - 1 && (
							<GroupSeparator />
						)}
					</React.Fragment>
				);
			})}
		</div>
	);
};

export interface ActionsMenuDropdownProps extends ActionsMenuProps {
	trigger?: React.ReactNode;
	/** Replace the entire default trigger button. When set, rendered directly as the DropdownMenuTrigger child. */
	customTrigger?: React.ReactNode;
	triggerAriaLabel?: string;
	triggerClassName?: string;
	contentClassName?: string;
	align?: "start" | "center" | "end";
	side?: "top" | "right" | "bottom" | "left";
	sideOffset?: number;
}

export const ActionsMenuDropdown: React.FC<ActionsMenuDropdownProps> = ({
	groups,
	onItemClick,
	className,
	trigger,
	customTrigger,
	triggerAriaLabel = "More actions",
	triggerClassName,
	contentClassName,
	align = "end",
	side = "bottom",
	sideOffset = 6,
}) => {
	const [open, setOpen] = useState(false);

	const handleItemClick = useCallback(
		(item: ActionsMenuItem) => {
			onItemClick?.(item);
			if (item.type !== "checkbox" && item.type !== "submenu") {
				setOpen(false);
			}
		},
		[onItemClick],
	);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
			<DropdownMenuTrigger asChild>
				{customTrigger ?? (
					<Button
						variant="outline"
						size="icon"
						aria-label={triggerAriaLabel}
						className={
							triggerClassName ||
							"bg-ods-card border-ods-border hover:bg-ods-bg-hover flex items-center justify-center focus-visible:ring-0"
						}
						leftIcon={
							trigger ?? (
								<Ellipsis01Icon size={24} className="text-ods-text-primary" />
							)
						}
					/>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={align}
				side={side}
				sideOffset={sideOffset}
				className={cn(
					"p-0 border-0 bg-transparent shadow-none overflow-visible",
					contentClassName,
				)}
			>
				<ActionsMenu
					groups={groups}
					onItemClick={handleItemClick}
					className={className}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ActionsMenu;
