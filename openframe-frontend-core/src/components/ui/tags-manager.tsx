"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "../../utils/cn";
import {
	CheckIcon,
	PencilIcon,
	PlusIcon,
	SearchIcon,
	TrashIcon,
	XmarkIcon,
	XmarkCircleIcon,
} from "../icons-v2-generated";
import { Button } from "./button";
import { Input } from "./input";
import { Tag } from "./tag";
import { FieldWrapper } from "./field-wrapper";

export interface TagItem {
	id: string;
	name: string;
	color?: string;
}

export interface TagsManagerProps {
	/** All available tags */
	tags: TagItem[];
	/** IDs of currently selected tags */
	selectedIds: string[];
	/** Called when selection changes */
	onChange: (ids: string[]) => void;
	/** Called to create a new tag; should return the created tag */
	onCreateTag?: (name: string) => Promise<TagItem | null | undefined>;
	/** Called to update a tag name */
	onUpdateTag?: (id: string, name: string) => Promise<void>;
	/** Called to delete a tag */
	onDeleteTag?: (id: string) => Promise<void>;
	/** Whether create is in progress */
	isCreating?: boolean;
	/** Whether update is in progress */
	isUpdating?: boolean;
	/** Whether delete is in progress */
	isDeleting?: boolean;
	/** Label displayed above the input */
	label?: string;
	/** Placeholder for the search input */
	searchPlaceholder?: string;
	/** Whether the component is disabled */
	disabled?: boolean;
	/** Additional className for the root container */
	className?: string;
}

export function TagsManager({
	tags,
	selectedIds,
	onChange,
	onCreateTag,
	onUpdateTag,
	onDeleteTag,
	isCreating = false,
	isUpdating = false,
	isDeleting = false,
	label = "Tags",
	searchPlaceholder = "Search and add Tags",
	disabled = false,
	className,
}: TagsManagerProps) {
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const [editingId, setEditingId] = React.useState<string | null>(null);
	const [editingName, setEditingName] = React.useState("");
	const editInputRef = React.useRef<HTMLInputElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const containerRef = React.useRef<HTMLDivElement>(null);

	const selectedTags = tags.filter((t) => selectedIds.includes(t.id));
	const filtered = tags.filter((t) =>
		t.name.toLowerCase().includes(search.toLowerCase()),
	);
	const showCreateOption =
		onCreateTag &&
		search.trim() &&
		!tags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

	const toggleTag = React.useCallback(
		(id: string) => {
			if (selectedIds.includes(id)) {
				onChange(selectedIds.filter((i) => i !== id));
			} else {
				onChange([...selectedIds, id]);
			}
		},
		[selectedIds, onChange],
	);

	const handleCreate = React.useCallback(async () => {
		if (!onCreateTag) return;
		const name = search.trim();
		if (!name) return;
		const result = await onCreateTag(name);
		if (result?.id) {
			onChange([...selectedIds, result.id]);
			setSearch("");
		}
	}, [search, onCreateTag, selectedIds, onChange]);

	const startEdit = React.useCallback((id: string, name: string) => {
		setEditingId(id);
		setEditingName(name);
		setTimeout(() => editInputRef.current?.focus(), 0);
	}, []);

	const confirmEdit = React.useCallback(async () => {
		if (!onUpdateTag || !editingId || !editingName.trim()) return;
		await onUpdateTag(editingId, editingName.trim());
		setEditingId(null);
		setEditingName("");
	}, [editingId, editingName, onUpdateTag]);

	const cancelEdit = React.useCallback(() => {
		setEditingId(null);
		setEditingName("");
	}, []);

	const handleDelete = React.useCallback(
		async (id: string) => {
			if (!onDeleteTag) return;
			await onDeleteTag(id);
			if (selectedIds.includes(id)) {
				onChange(selectedIds.filter((i) => i !== id));
			}
		},
		[onDeleteTag, selectedIds, onChange],
	);

	const handleClearAll = React.useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onChange([]);
			setSearch("");
			inputRef.current?.focus();
		},
		[onChange],
	);

	return (
		<FieldWrapper label={label} className={className}>
			<div className="relative" ref={containerRef}>
				<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
					{/* Anchor container */}
					<PopoverPrimitive.Anchor asChild>
						<label
							className={cn(
								"flex w-full items-center gap-2 rounded-[6px] border px-3 min-h-11 md:min-h-12 cursor-text flex-wrap py-1",
								"transition-colors duration-200",
								"bg-ods-card border-ods-border",
								"group",
								!disabled &&
									"hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active",
								disabled && "!cursor-not-allowed bg-ods-bg",
								open && "border-ods-accent hover:border-ods-accent",
							)}
							onClickCapture={() => {
								if (!disabled) setOpen(true);
							}}
						>
							{/* Search adornment */}
							<span
								className={cn(
									"flex-shrink-0 text-ods-text-secondary transition-colors duration-200 [&_svg]:size-4 md:[&_svg]:size-6",
									open && "text-ods-accent",
								)}
							>
								<SearchIcon />
							</span>

							{/* Selected tags rendered as Tag components */}
							{selectedTags.map((tag) => (
								<Tag
									key={tag.id}
									label={tag.name}
									variant="outline"
									onClose={disabled ? undefined : () => toggleTag(tag.id)}
								/>
							))}

							{/* Inline search input */}
							<input
								ref={inputRef}
								type="text"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									if (!open) setOpen(true);
								}}
								onFocus={() => setOpen(true)}
								onKeyDown={(e) => {
									if (e.key === "Escape") setOpen(false);
									if (e.key === "Enter" && showCreateOption) {
										e.preventDefault();
										handleCreate();
									}
									if (
										e.key === "Backspace" &&
										!search &&
										selectedIds.length > 0
									) {
										onChange(selectedIds.slice(0, -1));
									}
								}}
								placeholder={
									selectedTags.length === 0 ? searchPlaceholder : "Add More..."
								}
								disabled={disabled}
								className={cn(
									"flex-1 min-w-0 bg-transparent border-none outline-none",
									"text-h4",
									"text-ods-text-primary placeholder:text-ods-text-secondary",
									"disabled:cursor-not-allowed",
								)}
							/>

							{/* Clear all button — shown when tags are selected */}
							{selectedTags.length > 0 && !disabled && (
								<button
									type="button"
									onClick={handleClearAll}
									className="flex-shrink-0 flex items-center justify-center hover:opacity-70 transition-opacity [&_svg]:size-4 md:[&_svg]:size-6"
									aria-label="Clear all tags"
								>
									<XmarkCircleIcon className="text-ods-text-secondary" />
								</button>
							)}
						</label>
					</PopoverPrimitive.Anchor>

					{/* Dropdown */}
					<PopoverPrimitive.Content
						className={cn(
							"z-50 w-[var(--radix-popover-trigger-width)] mt-1",
							"bg-ods-card border border-ods-border rounded",
							"data-[state=open]:animate-in data-[state=closed]:animate-out",
							"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
							"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
							"data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
						)}
						sideOffset={4}
						align="start"
						onOpenAutoFocus={(e) => {
							e.preventDefault();
							inputRef.current?.focus();
						}}
						onInteractOutside={(e) => {
							if (containerRef.current?.contains(e.target as Node)) {
								e.preventDefault();
							}
						}}
					>
						<ScrollAreaPrimitive.Root className="overflow-hidden">
							<ScrollAreaPrimitive.Viewport className="max-h-60 w-full">
								<div role="listbox">
									{filtered.map((tag) => {
										const isSelected = selectedIds.includes(tag.id);
										const isEditing = editingId === tag.id;

										if (isEditing) {
											return (
												<div
													key={tag.id}
													className="flex items-center gap-1 px-2 py-1 border-b border-ods-border last:border-b-0"
												>
													<Input
														ref={editInputRef}
														value={editingName}
														onChange={(e) => setEditingName(e.target.value)}
														onKeyDown={(e) => {
															if (e.key === "Enter") confirmEdit();
															if (e.key === "Escape") cancelEdit();
														}}
														className="flex-1"
													/>
													<Button
														type="button"
														variant="transparent"
														size="icon"
														onClick={confirmEdit}
														disabled={isUpdating}
													>
														<CheckIcon size={14} className="text-ods-success" />
													</Button>
													<Button
														type="button"
														variant="transparent"
														size="icon"
														onClick={cancelEdit}
													>
														<XmarkIcon
															size={14}
															className="text-ods-text-secondary"
														/>
													</Button>
												</div>
											);
										}

										return (
											<div
												key={tag.id}
												role="option"
												aria-selected={isSelected}
												tabIndex={0}
												className={cn(
													"flex items-center h-11 md:h-12 px-4 cursor-pointer transition-colors border-b border-ods-border last:border-b-0",
													"text-h4",
													isSelected
														? "text-ods-accent"
														: "text-ods-text-primary",
													"hover:bg-ods-bg-hover group/item",
												)}
												onClick={() => toggleTag(tag.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														toggleTag(tag.id);
													}
												}}
											>
												<div className="flex items-center justify-between w-full">
													<span className="truncate">{tag.name}</span>
													<div className="flex items-center gap-1 shrink-0">
														{isSelected && (
															<CheckIcon
																className="text-ods-accent"
																size={20}
															/>
														)}
														{(onUpdateTag || onDeleteTag) && (
															<div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
																{onUpdateTag && (
																	<Button
																		type="button"
																		variant="transparent"
																		size="icon"
																		onClick={(e) => {
																			e.stopPropagation();
																			startEdit(tag.id, tag.name);
																		}}
																	>
																		<PencilIcon
																			size={14}
																			className="text-ods-text-secondary"
																		/>
																	</Button>
																)}
																{onDeleteTag && (
																	<Button
																		type="button"
																		variant="transparent"
																		size="icon"
																		onClick={(e) => {
																			e.stopPropagation();
																			handleDelete(tag.id);
																		}}
																		disabled={isDeleting}
																	>
																		<TrashIcon
																			size={14}
																			className="text-ods-error"
																		/>
																	</Button>
																)}
															</div>
														)}
													</div>
												</div>
											</div>
										);
									})}

									{showCreateOption && (
										<div
											role="option"
											tabIndex={0}
											className={cn(
												"flex items-center gap-2 h-11 md:h-12 px-4 cursor-pointer transition-colors text-h4",
												"hover:bg-ods-bg-hover",
												isCreating && "opacity-50 pointer-events-none",
											)}
											onClick={handleCreate}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													handleCreate();
												}
											}}
										>
											<PlusIcon
												size={16}
												className="text-ods-accent shrink-0"
											/>
											<span className="text-ods-accent truncate">
												Create &ldquo;{search.trim()}&rdquo;
											</span>
										</div>
									)}

									{filtered.length === 0 && !showCreateOption && (
										<div className="px-4 py-2 text-ods-text-secondary text-h6">
											No tags found
										</div>
									)}
								</div>
							</ScrollAreaPrimitive.Viewport>
							<ScrollAreaPrimitive.Scrollbar
								className="hidden"
								orientation="vertical"
							>
								<ScrollAreaPrimitive.Thumb />
							</ScrollAreaPrimitive.Scrollbar>
						</ScrollAreaPrimitive.Root>
					</PopoverPrimitive.Content>
				</PopoverPrimitive.Root>
			</div>
		</FieldWrapper>
	);
}
