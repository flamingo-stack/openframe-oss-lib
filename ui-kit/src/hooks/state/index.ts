/**
 * URL State Management Hooks
 *
 * Runtime schema-driven URL parameter management for GraphQL and REST APIs.
 *
 * @example GraphQL
 * import { useQueryParams } from '@flamingo/ui-kit/hooks'
 *
 * const { variables, setParam } = useQueryParams(LOGS_QUERY)
 * const { data } = useQuery(LOGS_QUERY, { variables })
 *
 * @example REST
 * import { useApiParams } from '@flamingo/ui-kit/hooks'
 *
 * const { params, urlSearchParams } = useApiParams({
 *   search: { type: 'string', default: '' },
 *   page: { type: 'number', default: 1 }
 * })
 */

// Main hooks
export { useQueryParams } from './use-query-params'
export type {
  UseQueryParamsOptions,
  UseQueryParamsReturn
} from './use-query-params'

export { useApiParams, createSearchParams } from './use-api-params'
export type {
  ParamSchema,
  UseApiParamsOptions,
  UseApiParamsReturn
} from './use-api-params'

// Introspection
export { introspector, GraphQLIntrospector } from './introspection'

// Type definitions
export type { JSType, VariableDefinition } from './graphql-parser'
export type { FlattenedParam } from './flatten-schema'

// Cursor pagination state management
export { useCursorPaginationState } from './use-cursor-pagination-state'
export type {
  UseCursorPaginationStateOptions,
  CursorPaginationStateReturn
} from './use-cursor-pagination-state'

// Utilities (for advanced use cases)
export {
  extractVariablesFromQuery,
  isScalarType,
  isInputObjectType
} from './graphql-parser'

export {
  flattenQueryVariables,
  mergeDefaults,
  validateSchema,
  getArrayParams,
  getRequiredParams,
  shouldIncludeInUrl
} from './flatten-schema'

export {
  urlParamsToVariables,
  variablesToUrlParams,
  coerceValue,
  setNestedValue,
  getNestedValue,
  mergeVariables,
  clearParams as clearVariablesParams,
  validateVariables
} from './url-converter'
