'use client';

import type { ReactNode } from 'react';
import { PageLayout } from '../../layout/page-layout';
import type { ActionsMenuGroup } from '../../ui/actions-menu';
import { Card } from '../../ui/card';
import { DeletedUserAvatar } from '../../ui/deleted-user-avatar';
import type { PageActionButton } from '../../ui/page-actions';
import { SquareAvatar } from '../../ui/square-avatar';
import { Tag } from '../../ui/tag';
import { type TicketAttachment, TicketAttachmentsList } from '../../ui/ticket-attachments-list';
import { TicketDetailSection } from '../../ui/ticket-detail-section';
import { TruncateText } from '../../ui/truncate-text';

export type KnowledgeBaseArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

const STATUS_VARIANT: Record<KnowledgeBaseArticleStatus, 'success' | 'warning' | 'grey'> = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'grey',
};

export interface KnowledgeBaseArticleAuthor {
  /** Display name; null: "Unknown". */
  name: string | null;
  /** A URL the browser can load as is. */
  imageUrl?: string;
  /** A deleted account: the red placeholder instead of the avatar, the name in the error colour. */
  deleted?: boolean;
}

export interface KnowledgeBaseArticleViewProps {
  title: string;
  /** "Back" over the title; left out, the page has none (a picture of the page). */
  onBack?: () => void;
  /** The header's buttons and the menu behind them, built by the host from the article's state. */
  actions?: PageActionButton[];
  menuActions?: ActionsMenuGroup[];
  tags?: readonly { id: string; label: string }[];
  author: KnowledgeBaseArticleAuthor;
  /** When the article last changed, already formatted by the host. */
  updatedLabel: string;
  status: KnowledgeBaseArticleStatus;
  /** The article's body: the host's markdown renderer over the content. */
  content: ReactNode;
  attachments?: TicketAttachment[];
  /** What the host adds under the article (assigned items, its dialogs). */
  children?: ReactNode;
  className?: string;
}

/**
 * One knowledge base article, open: its title and tags, who wrote it, when it
 * changed and its status, then the body and its attachments. Everything that
 * reads or changes the article (the query, publish, archive, move) is the
 * host's: it passes the article's fields, the buttons and the rendered body.
 */
export function KnowledgeBaseArticleView({
  title,
  onBack,
  actions,
  menuActions,
  tags = [],
  author,
  updatedLabel,
  status,
  content,
  attachments = [],
  children,
  className = 'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
}: KnowledgeBaseArticleViewProps) {
  return (
    <PageLayout
      title={title}
      backButton={onBack ? { label: 'Back', onClick: onBack } : undefined}
      actionsVariant="menu-primary"
      actions={actions}
      menuActions={menuActions}
      className={className}
    >
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-[var(--spacing-system-xsf)]">
          {tags.map(tag => (
            <Tag key={tag.id} label={tag.label} variant="outline" className="max-w-full" />
          ))}
        </div>
      )}

      <Card className="border-ods-border px-[var(--spacing-system-mf)] py-0">
        <div className="grid grid-cols-2 gap-x-[var(--spacing-system-mf)] content-lg:grid-cols-3">
          <div className="flex h-20 min-w-0 items-center gap-[var(--spacing-system-xsf)]">
            {author.deleted ? (
              <DeletedUserAvatar size="md" />
            ) : (
              <SquareAvatar
                src={author.imageUrl}
                fallback={author.name ?? 'A'}
                alt={author.name ?? 'Author'}
                size="md"
                variant="round"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <TruncateText className={author.deleted ? 'text-ods-error' : undefined}>
                {author.name ?? 'Unknown'}
              </TruncateText>
              <p className="truncate text-heading-5 text-ods-text-secondary">Author</p>
            </div>
          </div>

          <div className="flex h-20 min-w-0 flex-col justify-center">
            <TruncateText>{updatedLabel}</TruncateText>
            <p className="truncate text-heading-5 text-ods-text-secondary">Updated</p>
          </div>

          <div
            className="col-span-2 -mx-[var(--spacing-system-mf)] border-t border-ods-border content-lg:hidden"
            aria-hidden
          />

          <div className="flex h-20 min-w-0 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
            <Tag variant={STATUS_VARIANT[status]} label={status} />
            <p className="truncate text-heading-5 text-ods-text-secondary">Status</p>
          </div>
        </div>
      </Card>

      {content}

      {attachments.length > 0 && (
        <TicketDetailSection label="Attachments">
          <TicketAttachmentsList attachments={attachments} />
        </TicketDetailSection>
      )}

      {children}
    </PageLayout>
  );
}
