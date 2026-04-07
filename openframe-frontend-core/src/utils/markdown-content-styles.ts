import { cn } from "./cn"

/**
 * Shared content styles for markdown rendering.
 * Used by both RichTextEditor (editing) and TicketDescriptionViewer (viewing)
 * to ensure visual consistency between create and view modes.
 */
export const markdownContentStyles = cn(
  "max-w-none",
  "text-[18px] font-medium leading-6 text-ods-text-primary",
  "font-['DM_Sans']",
  // Headings
  "[&_h1]:text-[28px] [&_h1]:font-semibold [&_h1]:leading-9 [&_h1]:mt-6 [&_h1]:mb-3",
  "[&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:leading-7 [&_h2]:mt-5 [&_h2]:mb-2",
  "[&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:leading-6 [&_h3]:mt-4 [&_h3]:mb-2",
  // Paragraphs
  "[&_p]:my-1",
  // Lists
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
  "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
  "[&_li]:my-0.5",
  "[&_li>p]:my-0",
  // Nested lists
  "[&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square]",
  // Task list (tiptap-specific, used by RichTextEditor)
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0",
  "[&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]]:items-start",
  "[&_li[data-type=taskItem]>label]:mt-0.5",
  "[&_li[data-type=taskItem]>div]:flex-1",
  // Blockquote
  "[&_blockquote]:border-l-2 [&_blockquote]:border-ods-border [&_blockquote]:pl-4 [&_blockquote]:my-2 [&_blockquote]:text-ods-text-secondary [&_blockquote]:italic",
  // Inline code
  "[&_code]:bg-ods-bg [&_code]:text-ods-accent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[14px] [&_code]:font-['Azeret_Mono']",
  // Code block
  "[&_pre]:bg-ods-bg [&_pre]:rounded-[6px] [&_pre]:p-4 [&_pre]:my-2 [&_pre]:overflow-x-auto",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-ods-text-primary",
  // Links
  "[&_a]:text-ods-accent [&_a]:underline [&_a]:cursor-pointer",
  // Horizontal rule
  "[&_hr]:border-ods-border [&_hr]:my-4",
  // Images
  "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-[6px] [&_img]:my-2",
  // Tables
  "[&_table]:border-collapse [&_table]:w-full [&_table]:my-2",
  "[&_th]:border [&_th]:border-ods-border [&_th]:bg-ods-bg [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[14px]",
  "[&_td]:border [&_td]:border-ods-border [&_td]:p-2 [&_td]:text-[14px]",
  // Text formatting
  "[&_strong]:font-bold",
  "[&_em]:italic",
  "[&_s]:line-through",
  "[&_u]:underline",
)
