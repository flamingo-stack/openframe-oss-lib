/**
 * GraphQL AST Parser for URL State Management
 *
 * Extracts variable definitions from GraphQL DocumentNode at runtime
 * to automatically generate URL parameter handling.
 */

import {
  DocumentNode,
  VariableDefinitionNode,
  TypeNode,
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode,
  visit
} from 'graphql'

/**
 * JavaScript type that can be represented in URL parameters
 */
export type JSType = 'string' | 'number' | 'boolean' | 'array' | 'object'

/**
 * Variable definition extracted from GraphQL query
 */
export interface VariableDefinition {
  /** Variable name (e.g., "search", "filter") */
  name: string
  /** JavaScript type for URL parameter handling */
  type: JSType
  /** Whether the variable is required (non-null in GraphQL) */
  required: boolean
  /** Whether the variable is an array/list */
  isArray: boolean
  /** Original GraphQL type name (e.g., "String", "LogFilterInput") */
  graphqlTypeName: string
}

/**
 * Parsed type information from GraphQL TypeNode
 */
interface ParsedType {
  typeName: string
  isNonNull: boolean
  isList: boolean
}

/**
 * Extract all variable definitions from a GraphQL query
 *
 * @param query - GraphQL DocumentNode (from gql template tag)
 * @returns Record of variable definitions keyed by variable name
 *
 * @example
 * const LOGS_QUERY = gql`
 *   query GetLogs($search: String, $filter: LogFilterInput) { ... }
 * `
 *
 * const variables = extractVariablesFromQuery(LOGS_QUERY)
 * // {
 * //   search: { name: 'search', type: 'string', ... },
 * //   filter: { name: 'filter', type: 'object', graphqlTypeName: 'LogFilterInput' }
 * // }
 */
export function extractVariablesFromQuery(
  query: DocumentNode
): Record<string, VariableDefinition> {
  const variables: Record<string, VariableDefinition> = {}

  visit(query, {
    VariableDefinition(node: VariableDefinitionNode) {
      const name = node.variable.name.value
      const typeInfo = parseGraphQLType(node.type)

      variables[name] = {
        name,
        type: mapGraphQLTypeToJS(typeInfo.typeName),
        required: typeInfo.isNonNull,
        isArray: typeInfo.isList,
        graphqlTypeName: typeInfo.typeName
      }
    }
  })

  return variables
}

/**
 * Parse GraphQL TypeNode to extract type information
 * Handles NonNullType, ListType, and NamedType recursively
 *
 * @param typeNode - GraphQL type node from AST
 * @returns Parsed type information
 */
function parseGraphQLType(typeNode: TypeNode): ParsedType {
  let typeName = ''
  let isNonNull = false
  let isList = false

  // Unwrap NonNullType wrapper
  if (typeNode.kind === 'NonNullType') {
    isNonNull = true
    typeNode = typeNode.type
  }

  // Handle ListType
  if (typeNode.kind === 'ListType') {
    isList = true
    typeNode = typeNode.type

    // ListType can also be wrapped in NonNullType
    if (typeNode.kind === 'NonNullType') {
      typeNode = typeNode.type
    }
  }

  // Extract the base type name
  if (typeNode.kind === 'NamedType') {
    typeName = typeNode.name.value
  }

  return {
    typeName,
    isNonNull,
    isList
  }
}

/**
 * Map GraphQL scalar/input types to JavaScript types
 *
 * @param graphqlType - GraphQL type name (e.g., "String", "Int", "LogFilterInput")
 * @returns JavaScript type for URL parameter handling
 */
function mapGraphQLTypeToJS(graphqlType: string): JSType {
  // GraphQL scalar types
  const scalarTypeMap: Record<string, JSType> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean',
    'ID': 'string'
  }

  // Check if it's a known scalar
  if (scalarTypeMap[graphqlType]) {
    return scalarTypeMap[graphqlType]
  }

  // Unknown types are assumed to be input objects
  // These will be flattened using introspection
  return 'object'
}

/**
 * Check if a GraphQL type is a scalar type
 */
export function isScalarType(graphqlTypeName: string): boolean {
  const scalars = ['String', 'Int', 'Float', 'Boolean', 'ID']
  return scalars.includes(graphqlTypeName)
}

/**
 * Check if a GraphQL type is an input object type
 */
export function isInputObjectType(graphqlTypeName: string): boolean {
  return !isScalarType(graphqlTypeName)
}
