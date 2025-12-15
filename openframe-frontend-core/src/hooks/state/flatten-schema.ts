/**
 * Schema Flattening Utilities for URL State Management
 *
 * Converts nested GraphQL input types to flat URL parameter mappings.
 * Example: { filter: { severity: [...] } } → URL params: ?severity=...
 */

import { VariableDefinition, JSType } from './graphql-parser'
import { GraphQLIntrospector } from './introspection'

/**
 * Flattened URL parameter configuration
 *
 * Maps URL parameter names to their GraphQL variable paths
 */
export interface FlattenedParam {
  /** URL parameter name (e.g., "severity") */
  urlParamName: string
  /** Path in GraphQL variables (e.g., "filter.severity") */
  graphqlPath: string
  /** JavaScript type for URL handling */
  type: JSType
  /** Default value for this parameter */
  defaultValue?: any
  /** Whether this parameter is required */
  required?: boolean
  /** Whether this parameter is an array */
  isArray?: boolean
}

/**
 * Flatten GraphQL query variables to URL parameter schema
 *
 * Takes top-level query variables and flattens nested input objects
 * to create a simple URL parameter mapping.
 *
 * @param queryVariables - Variables extracted from GraphQL query
 * @param introspector - Introspector instance with loaded schema
 * @returns Flattened parameter schema for URL handling
 *
 * @example
 * Input variables:
 * {
 *   search: { type: 'string', ... },
 *   filter: { type: 'object', graphqlTypeName: 'LogFilterInput' },
 *   cursor: { type: 'string', ... }
 * }
 *
 * Output schema:
 * {
 *   search: { urlParamName: 'search', graphqlPath: 'search', type: 'string' },
 *   severity: { urlParamName: 'severity', graphqlPath: 'filter.severity', type: 'array' },
 *   toolType: { urlParamName: 'toolType', graphqlPath: 'filter.toolType', type: 'array' },
 *   cursor: { urlParamName: 'cursor', graphqlPath: 'cursor', type: 'string' }
 * }
 *
 * URL: ?search=error&severity=critical&toolType=tactical&cursor=abc
 */
export async function flattenQueryVariables(
  queryVariables: Record<string, VariableDefinition>,
  introspector: GraphQLIntrospector
): Promise<Record<string, FlattenedParam>> {
  const flattened: Record<string, FlattenedParam> = {}

  for (const [varName, varDef] of Object.entries(queryVariables)) {
    // Primitive types or arrays - keep at top level
    if (varDef.type !== 'object') {
      flattened[varName] = {
        urlParamName: varName,
        graphqlPath: varName,
        type: varDef.isArray ? 'array' : varDef.type,
        required: varDef.required,
        isArray: varDef.isArray
      }
      continue
    }

    // Input object types - flatten fields to top level
    // This requires introspection to know the input type's fields
    if (introspector.isLoaded() && introspector.hasType(varDef.graphqlTypeName)) {
      const fields = introspector.getInputTypeFields(varDef.graphqlTypeName)

      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        flattened[fieldName] = {
          urlParamName: fieldName,
          graphqlPath: `${varName}.${fieldName}`,
          type: fieldDef.isArray ? 'array' : fieldDef.type,
          required: fieldDef.required,
          isArray: fieldDef.isArray
        }
      }
    } else {
      // Introspection not available or type not found
      // Keep as top-level object (will need manual handling)
      flattened[varName] = {
        urlParamName: varName,
        graphqlPath: varName,
        type: 'object',
        required: varDef.required,
        isArray: false
      }
    }
  }

  return flattened
}

/**
 * Merge default values into flattened schema
 *
 * @param schema - Flattened parameter schema
 * @param defaults - Default values keyed by URL param name
 * @returns Updated schema with default values
 */
export function mergeDefaults(
  schema: Record<string, FlattenedParam>,
  defaults: Record<string, any>
): Record<string, FlattenedParam> {
  const merged: Record<string, FlattenedParam> = {}

  for (const [key, param] of Object.entries(schema)) {
    merged[key] = {
      ...param,
      defaultValue: defaults[key] !== undefined ? defaults[key] : param.defaultValue
    }
  }

  return merged
}

/**
 * Validate that flattened schema has no conflicts
 *
 * Ensures that no two parameters map to the same URL param name
 *
 * @param schema - Flattened parameter schema
 * @throws Error if conflicts are detected
 */
export function validateSchema(schema: Record<string, FlattenedParam>): void {
  const urlParamNames = new Set<string>()

  for (const [key, param] of Object.entries(schema)) {
    if (urlParamNames.has(param.urlParamName)) {
      throw new Error(
        `[FlattenSchema] Conflict: Multiple parameters map to URL param "${param.urlParamName}"`
      )
    }
    urlParamNames.add(param.urlParamName)
  }
}

/**
 * Get all array-type parameters from schema
 *
 * Useful for knowing which URL params should use repeated values
 * (e.g., ?severity=error&severity=warning)
 *
 * @param schema - Flattened parameter schema
 * @returns Array parameter names
 */
export function getArrayParams(schema: Record<string, FlattenedParam>): string[] {
  return Object.entries(schema)
    .filter(([_, param]) => param.type === 'array' || param.isArray)
    .map(([key]) => key)
}

/**
 * Get required parameters from schema
 *
 * @param schema - Flattened parameter schema
 * @returns Required parameter names
 */
export function getRequiredParams(schema: Record<string, FlattenedParam>): string[] {
  return Object.entries(schema)
    .filter(([_, param]) => param.required)
    .map(([key]) => key)
}

/**
 * Check if a parameter should be included in URL
 *
 * Excludes:
 * - null/undefined values
 * - Empty arrays
 * - Default values (to keep URLs clean)
 *
 * @param value - Parameter value
 * @param param - Parameter configuration
 * @returns Whether to include in URL
 */
export function shouldIncludeInUrl(
  value: any,
  param: FlattenedParam
): boolean {
  // Null/undefined - exclude
  if (value === null || value === undefined) {
    return false
  }

  // Empty arrays - exclude
  if (Array.isArray(value) && value.length === 0) {
    return false
  }

  // Empty strings - exclude
  if (value === '') {
    return false
  }

  // Default values - exclude to keep URL clean
  if (param.defaultValue !== undefined && value === param.defaultValue) {
    return false
  }

  return true
}
