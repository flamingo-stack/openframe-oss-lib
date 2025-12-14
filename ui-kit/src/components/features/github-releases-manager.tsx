"use client";

import { ArrayEntryManager } from './array-entry-manager';
import { ExternalLink } from 'lucide-react';

export interface GitHubReleaseLink {
  github_release_url: string; // Full GitHub release URL
  display_order?: number;
}

interface GitHubReleasesManagerProps {
  releases: GitHubReleaseLink[];
  onChange: (releases: GitHubReleaseLink[]) => void;
  className?: string;
}

export function GitHubReleasesManager({
  releases,
  onChange,
  className = ''
}: GitHubReleasesManagerProps) {
  return (
    <ArrayEntryManager
      title="GitHub Releases"
      items={releases}
      onChange={onChange}
      fieldKey="github_release_url"
      placeholder="https://github.com/org/repo/releases/tag/v2.0.0"
      emptyMessage='No GitHub releases linked. Click "Add Release" to link releases.'
      addButtonText="Add Release"
      icon={<ExternalLink className="w-5 h-5 text-ods-text-secondary" />}
      className={className}
    />
  );
}
