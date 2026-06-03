export {
  DocSearchBar,
  type DocSearchBarProps,
} from './doc-search-bar'
export {
  DocSearchResultRow,
  type DocSearchResultRowProps,
  type DocSearchResultRowEntry,
} from './doc-search-result-row'
export { formatRelativePath } from './format-relative-path'

// Hook + supporting helpers — moved from hub `hooks/use-docs.ts` so
// embedders can mount the search bar directly without re-implementing
// the debounced fetch + result navigation logic.
export {
  useDocSearch,
  type UseDocSearchConfig,
} from './use-doc-search'
export {
  resolveSearchResultAction,
  type SearchResultAction,
} from './resolve-search-result-action'
export { mapDocSearchResults } from './map-doc-search-results'
export type { DocSearchResult } from './types'
