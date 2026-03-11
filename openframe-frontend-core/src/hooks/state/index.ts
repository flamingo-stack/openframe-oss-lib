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

export type { FlattenedParam } from './flatten-schema';
export {
  flattenQueryVariables,
  getArrayParams,
  getRequiredParams,
  mergeDefaults,
  shouldIncludeInUrl,
  validateSchema,
} from './flatten-schema';
// Type definitions
export type { JSType, VariableDefinition } from './graphql-parser';
// Utilities (for advanced use cases)
export {
  extractVariablesFromQuery,
  isInputObjectType,
  isScalarType,
} from './graphql-parser';

// Introspection
export { GraphQLIntrospector, introspector } from './introspection';
export {
  clearParams as clearVariablesParams,
  coerceValue,
  getNestedValue,
  mergeVariables,
  setNestedValue,
  urlParamsToVariables,
  validateVariables,
  variablesToUrlParams,
} from './url-converter';
export type {
  ParamSchema,
  UseApiParamsOptions,
  UseApiParamsReturn,
} from './use-api-params';
export { createSearchParams, useApiParams } from './use-api-params';
export type {
  CursorPaginationStateReturn,
  UseCursorPaginationStateOptions,
} from './use-cursor-pagination-state';
// Cursor pagination state management
export { useCursorPaginationState } from './use-cursor-pagination-state';
export type {
  UseQueryParamsOptions,
  UseQueryParamsReturn,
} from './use-query-params';
// Main hooks
export { useQueryParams } from './use-query-params';
