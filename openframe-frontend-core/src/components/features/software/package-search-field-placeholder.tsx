'use client';

import { Autocomplete } from '../../ui';

export const PACKAGE_SEARCH_LABEL = 'Software Name';
export const PACKAGE_SEARCH_PLACEHOLDER = 'Search for Software';

/** The "Software Name" field while it cannot search: the search failed, or a read outside the field's own deferral. */
export function PackageSearchFieldPlaceholder({ error }: { error?: string }) {
  return (
    <Autocomplete
      label={PACKAGE_SEARCH_LABEL}
      labelVariant="large"
      options={[]}
      value={null}
      onChange={() => {}}
      placeholder={PACKAGE_SEARCH_PLACEHOLDER}
      disabled
      error={error}
      invalid={!!error}
    />
  );
}
