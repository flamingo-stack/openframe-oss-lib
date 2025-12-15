/**
 * GraphQL Schema Introspection for URL State Management
 *
 * Fetches GraphQL schema via introspection query at runtime (works behind auth).
 * Caches schema in localStorage + memory for performance.
 */

import {
  getIntrospectionQuery,
  buildClientSchema,
  IntrospectionQuery,
  GraphQLSchema,
  GraphQLInputObjectType,
  GraphQLInputType,
  isInputObjectType
} from 'graphql'
import { VariableDefinition, JSType } from './graphql-parser'

/**
 * Schema cache structure stored in localStorage
 */
interface SchemaCache {
  schema: IntrospectionQuery
  timestamp: number
  version: string
}

/**
 * GraphQL Introspection Manager
 *
 * Singleton class that handles schema introspection with caching.
 * Fetches schema once per session and caches for 24 hours.
 */
export class GraphQLIntrospector {
  private schema: GraphQLSchema | null = null
  private cacheKey = 'graphql-schema-cache-v1'
  private cacheDuration = 24 * 60 * 60 * 1000  // 24 hours
  private schemaVersion = '1.0.0'

  /**
   * Fetch GraphQL schema via introspection query
   *
   * @param endpoint - GraphQL endpoint URL
   * @param headers - HTTP headers (e.g., authentication)
   * @param skipCache - Force fresh fetch, ignore cache
   *
   * @example
   * await introspector.fetchSchema(
   *   'http://localhost/api/graphql',
   *   { 'Authorization': 'Bearer token123' }
   * )
   */
  async fetchSchema(
    endpoint: string,
    headers: Record<string, string> = {},
    skipCache = false
  ): Promise<void> {
    // Check cache first (unless skipped)
    if (!skipCache) {
      const cached = this.loadFromCache()
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        try {
          this.schema = buildClientSchema(cached.schema)
          return
        } catch (error) {
          console.warn('[Introspector] Failed to build schema from cache:', error)
          // Continue to fetch fresh schema
        }
      }
    }

    // Fetch schema via introspection query
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          query: getIntrospectionQuery()
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const { data, errors } = await response.json()

      if (errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`)
      }

      if (!data) {
        throw new Error('No data returned from introspection query')
      }

      // Build and cache schema
      this.schema = buildClientSchema(data)
      this.saveToCache(data)
    } catch (error) {
      console.error('[Introspector] Failed to fetch schema:', error)
      throw error
    }
  }

  /**
   * Get fields from a GraphQL input object type
   *
   * @param typeName - Name of the input type (e.g., "LogFilterInput")
   * @returns Record of field definitions
   *
   * @example
   * const fields = introspector.getInputTypeFields('LogFilterInput')
   * // {
   * //   severity: { name: 'severity', type: 'array', ... },
   * //   toolType: { name: 'toolType', type: 'array', ... }
   * // }
   */
  getInputTypeFields(typeName: string): Record<string, VariableDefinition> {
    if (!this.schema) {
      return {}
    }

    const type = this.schema.getType(typeName)

    if (!type || !isInputObjectType(type)) {
      return {}
    }

    const fields: Record<string, VariableDefinition> = {}
    const typeFields = type.getFields()

    for (const [fieldName, field] of Object.entries(typeFields)) {
      const fieldType = this.unwrapType(field.type)

      fields[fieldName] = {
        name: fieldName,
        type: this.mapGraphQLTypeToJS(fieldType.typeName),
        required: fieldType.isNonNull,
        isArray: fieldType.isList,
        graphqlTypeName: fieldType.typeName
      }
    }

    return fields
  }

  /**
   * Check if a type exists in the schema
   */
  hasType(typeName: string): boolean {
    if (!this.schema) return false
    return this.schema.getType(typeName) !== undefined
  }

  /**
   * Get the schema (if loaded)
   */
  getSchema(): GraphQLSchema | null {
    return this.schema
  }

  /**
   * Check if schema is loaded
   */
  isLoaded(): boolean {
    return this.schema !== null
  }

  /**
   * Clear cached schema
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.cacheKey)
      this.schema = null
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Unwrap GraphQL type to get base type info
   * Handles NonNull and List wrappers
   */
  private unwrapType(type: GraphQLInputType): {
    typeName: string
    isNonNull: boolean
    isList: boolean
  } {
    let typeName = ''
    let isNonNull = false
    let isList = false
    let current: any = type

    // Unwrap NonNull wrapper
    if (current.toString().endsWith('!')) {
      isNonNull = true
      current = 'ofType' in current ? current.ofType : current
    }

    // Check for List wrapper
    if (current.toString().startsWith('[')) {
      isList = true
      current = 'ofType' in current ? current.ofType : current
    }

    // Handle inner NonNull (e.g., [String!])
    if (current.toString().endsWith('!')) {
      current = 'ofType' in current ? current.ofType : current
    }

    // Get base type name
    typeName = current.name || current.toString().replace(/[[\]!]/g, '')

    return { typeName, isNonNull, isList }
  }

  /**
   * Map GraphQL types to JavaScript types for URL handling
   */
  private mapGraphQLTypeToJS(graphqlType: string): JSType {
    const typeMap: Record<string, JSType> = {
      'String': 'string',
      'Int': 'number',
      'Float': 'number',
      'Boolean': 'boolean',
      'ID': 'string'
    }

    return typeMap[graphqlType] || 'object'
  }

  /**
   * Load schema from localStorage cache
   */
  private loadFromCache(): SchemaCache | null {
    try {
      const cached = localStorage.getItem(this.cacheKey)
      if (!cached) return null

      const parsed = JSON.parse(cached) as SchemaCache

      // Validate cache version
      if (parsed.version !== this.schemaVersion) {
        return null
      }

      return parsed
    } catch (error) {
      console.warn('[Introspector] Failed to load cache:', error)
      return null
    }
  }

  /**
   * Save schema to localStorage cache
   */
  private saveToCache(schema: IntrospectionQuery): void {
    try {
      const cache: SchemaCache = {
        schema,
        timestamp: Date.now(),
        version: this.schemaVersion
      }

      localStorage.setItem(this.cacheKey, JSON.stringify(cache))
    } catch (error) {
      console.warn('[Introspector] Failed to save cache:', error)
      // Ignore storage errors (e.g., quota exceeded)
    }
  }
}

/**
 * Singleton introspector instance
 *
 * Use this instance throughout the application to share schema cache
 *
 * @example
 * import { introspector } from '@flamingo/ui-kit/hooks/state'
 *
 * // Initialize after auth
 * await introspector.fetchSchema(endpoint, { Authorization: token })
 *
 * // Get input type fields
 * const fields = introspector.getInputTypeFields('LogFilterInput')
 */
export const introspector = new GraphQLIntrospector()
