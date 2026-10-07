import { BookTextIcon, FolderIcon } from '../../icons-v2-generated';

/** What a Knowledge Base item is. */
export type KnowledgeBaseItemType = 'ARTICLE' | 'FOLDER';

/**
 * The glyph for each Knowledge Base item type. Single source for the KB table
 * and Mingo's `@kb` / `@kbFolder` mention chips, so an article or folder reads
 * the same in the chat as on the Knowledge Base page.
 */
export const KNOWLEDGE_BASE_ITEM_ICON = {
  ARTICLE: BookTextIcon,
  FOLDER: FolderIcon,
} satisfies Record<KnowledgeBaseItemType, typeof BookTextIcon>;
