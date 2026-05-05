"use client";

import * as React from "react";
import { cn } from "../../utils/cn";

export interface InputTriggerProps
	extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	selectedLabel?: React.ReactNode;
	placeholder?: string;
	startIcon?: React.ReactNode;
	endIcon?: React.ReactNode;
	invalid?: boolean;
}

/**
 * Input-styled button used to open a non-`<Select>` popup — `ActionsMenuDropdown`,
 * `Popover`, custom calendars, etc.
 *
 * Use `InputTrigger` when:
 *   - You need a select-shaped trigger that opens something other than `<Select>`.
 *   - You want consistent Input-field visuals next to other form fields.
 *
 * Don't use `InputTrigger` for:
 *   - Single-value selection from a flat list — use `<Select>` / `<Autocomplete>`.
 *   - Page-level CTAs / action buttons — use `<Button>` (bold, centered, hierarchical).
 *
 * The component is `forwardRef`'d so it works as the `asChild` child of any Radix
 * trigger (DropdownMenu, Popover, etc.). For form labels & error messages, compose
 * with `<FieldWrapper>`.
 */
export const InputTrigger = React.forwardRef<HTMLButtonElement, InputTriggerProps>(
	(
		{ selectedLabel, placeholder, startIcon, endIcon, invalid, className, disabled, ...props },
		ref,
	) => {
		const isPlaceholder =
			selectedLabel === undefined || selectedLabel === null || selectedLabel === "";

		return (
			<button
				ref={ref}
				type="button"
				disabled={disabled}
				data-invalid={invalid || undefined}
				{...props}
				className={cn(
					"flex w-full items-center gap-2 rounded-[6px] border px-3 h-11 md:h-12 outline-none",
					"text-[18px] font-medium leading-6",
					"bg-ods-card border-ods-border text-ods-text-primary",
					"enabled:hover:bg-ods-bg-hover enabled:hover:border-ods-border-hover enabled:active:bg-ods-bg-active enabled:active:border-ods-border-active",
					!invalid &&
						"data-[state=open]:border-ods-accent data-[state=open]:hover:border-ods-accent",
					invalid &&
						"border-ods-error enabled:hover:border-ods-error data-[state=open]:border-ods-error",
					"disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-ods-bg",
					"transition-colors duration-200",
					className,
				)}
			>
				{startIcon && (
					<span className="flex shrink-0 items-center text-ods-text-secondary">
						{startIcon}
					</span>
				)}
				<span
					className={cn(
						"flex-1 min-w-0 text-left truncate",
						isPlaceholder && "text-ods-text-secondary",
					)}
				>
					{isPlaceholder ? placeholder : selectedLabel}
				</span>
				{endIcon && (
					<span className="flex shrink-0 items-center text-ods-text-secondary">
						{endIcon}
					</span>
				)}
			</button>
		);
	},
);
InputTrigger.displayName = "InputTrigger";
