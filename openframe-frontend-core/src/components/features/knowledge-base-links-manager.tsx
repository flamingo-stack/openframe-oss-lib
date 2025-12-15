"use client";

import { ArrayEntryManager } from './array-entry-manager';
import { FileText } from 'lucide-react';

export interface KBLink {
  kb_article_path: string; // Relative path like /api/authentication/api-keys.md
  display_order?: number;
}

interface KnowledgeBaseLinksManagerProps {
  links: KBLink[];
  onChange: (links: KBLink[]) => void;
  className?: string;
}

export function KnowledgeBaseLinksManager({
  links,
  onChange,
  className = ''
}: KnowledgeBaseLinksManagerProps) {
  return (
    <ArrayEntryManager
      title="Knowledge Base Articles"
      items={links}
      onChange={onChange}
      fieldKey="kb_article_path"
      placeholder="Relative path (e.g., /api/authentication/api-keys.md)"
      emptyMessage='No knowledge base articles linked. Click "Add Article" to link articles.'
      addButtonText="Add Article"
      icon={<FileText className="w-5 h-5 text-ods-text-secondary" />}
      className={className}
    />
  );
}
