"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { Check } from "lucide-react";
import { Chevron02RightIcon, Ellipsis01Icon } from "../icons-v2-generated";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "./dropdown-menu";

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
	isNested?: boolean;
	parentCloseHandler?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({
	item,
	onItemClick,
	isNested = false,
	parentCloseHandler,
}) => {
	const [showSubmenu, setShowSubmenu] = useState(false);
	const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
	const itemRef = useRef<HTMLDivElement>(null);
	const submenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (showSubmenu && itemRef.current) {
			const rect = itemRef.current.getBoundingClientRect();
			const submenuWidth = 256; // min-w-[256px]
			const viewportWidth = window.innerWidth;

			// Check available space on both sides
			const spaceRight = viewportWidth - rect.right;
			const spaceLeft = rect.left;

			let left: number;
			if (spaceRight >= submenuWidth + 4) {
				// Position to the right (default)
				left = rect.right + 4;
			} else if (spaceLeft >= submenuWidth + 4) {
				// Position to the left
				left = rect.left - submenuWidth - 4;
			} else {
				// Fallback: position to whichever side has more space
				left =
					spaceRight >= spaceLeft
						? rect.right + 4
						: rect.left - submenuWidth - 4;
			}

			setSubmenuPosition({
				top: rect.top,
				left,
			});
		}
	}, [showSubmenu]);

	const closeSubmenu = useCallback(() => {
		setShowSubmenu(false);
	}, []);

	const activate = useCallback(() => {
		if (item.disabled) return;

		if (item.type === "submenu") {
			setShowSubmenu((prev) => !prev);
		} else if (item.type === "checkbox") {
			item.onClick?.();
			onItemClick?.(item);
		} else if (item.onClick) {
			item.onClick();
			onItemClick?.(item);

			if (isNested && parentCloseHandler) {
				parentCloseHandler();
			}
		}
	}, [item, onItemClick, isNested, parentCloseHandler]);

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
			if (isNested && parentCloseHandler) {
				parentCloseHandler();
			}
		},
		[item, onItemClick, isNested, parentCloseHandler],
	);

	useEffect(() => {
		if (showSubmenu) {
			const handleClickOutside = (e: MouseEvent) => {
				if (
					itemRef.current &&
					!itemRef.current.contains(e.target as Node) &&
					submenuRef.current &&
					!submenuRef.current.contains(e.target as Node)
				) {
					setShowSubmenu(false);
				}
			};

			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
	}, [showSubmenu]);

	if (item.type === "separator") {
		return <div className="bg-ods-system-greys-soft-grey h-1 w-full" />;
	}

	const itemClasses = `
    flex items-center gap-2 px-3 py-3 cursor-pointer transition-colors
    bg-ods-bg
    ${
			item.disabled
				? "text-ods-text-secondary cursor-not-allowed pointer-events-none opacity-60"
				: "text-ods-text-primary hover:bg-ods-bg-hover"
		}
    ${showSubmenu && item.type === "submenu" ? "bg-[#2b2b2b]" : ""}
  `;

	const renderAsLink =
		!!item.href && item.type !== "submenu" && item.type !== "checkbox";

	const rowContent = (
		<>
			{item.icon && (
				<div
					className={`w-6 h-6 flex-shrink-0 flex items-center justify-center ${item.disabled ? "opacity-50" : ""}`}
				>
					{item.icon}
				</div>
			)}

			<span
				className={`flex-1 text-[18px] font-medium leading-6 ${item.disabled ? "text-ods-text-secondary" : "text-ods-text-primary"}`}
			>
				{item.label}
			</span>

			{item.type === "checkbox" && (
				<div
					className={`
          w-6 h-6 flex items-center justify-center rounded-md transition-colors
          ${
						item.checked
							? "bg-[#ffc008]"
							: "border-2 border-ods-border bg-transparent"
					}
        `}
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

	const wrapperClasses = `relative border-b border-ods-border last:border-b-0`;

	if (renderAsLink && item.href) {
		return (
			<div className={wrapperClasses}>
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
			</div>
		);
	}

	return (
		<div className={wrapperClasses}>
			<div
				ref={itemRef}
				role="menuitem"
				tabIndex={item.disabled ? -1 : 0}
				aria-disabled={item.disabled}
				aria-haspopup={item.type === "submenu" ? "menu" : undefined}
				aria-expanded={item.type === "submenu" ? showSubmenu : undefined}
				className={itemClasses}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
			>
				{rowContent}
			</div>

			{/* Submenu */}
			{item.type === "submenu" &&
				showSubmenu &&
				item.submenu &&
				typeof window !== "undefined" &&
				ReactDOM.createPortal(
					<div
						ref={submenuRef}
						role="menu"
						data-actions-submenu
						className="fixed z-[9999] min-w-[256px] bg-ods-bg border border-ods-border rounded-md shadow-xl overflow-hidden"
						style={{
							top: `${submenuPosition.top}px`,
							left: `${submenuPosition.left}px`,
						}}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						{item.submenu.map((subItem, index) => (
							<MenuItem
								key={subItem.id || index}
								item={subItem}
								onItemClick={onItemClick}
								isNested={true}
								parentCloseHandler={closeSubmenu}
							/>
						))}
					</div>,
					document.body,
				)}
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
			className={`relative min-w-[256px] bg-ods-bg border border-ods-border rounded-md shadow-lg overflow-hidden ${className}`}
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
				className="p-0 border-0 bg-transparent shadow-none overflow-visible"
				onInteractOutside={(e) => {
					const original = (
						e as unknown as CustomEvent<{ originalEvent: Event }>
					).detail?.originalEvent;
					const target = original?.target as HTMLElement | null;
					if (target && target.closest("[data-actions-submenu]")) {
						e.preventDefault();
					}
				}}
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
